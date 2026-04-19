#!/usr/bin/env node

/**
 * @file src/cli.js
 * @description The main entry point for the command-line interface.
 * Parses arguments using 'yargs-parser', loads configuration, and runs the scanner.
 */

import yargsParser from 'yargs-parser';
import { createRequire } from 'node:module';
import { loadConfig } from '../config/config-loader.js';
import { scan } from '../core/scanner.js';
import logger from '../util/logger.js';
import { LINK_STATUS, EXIT_CODES } from '../util/constants.js';

// Using createRequire to safely import package.json in an ES module context.
const require = createRequire(import.meta.url);
const { version, description } = require('../../package.json');

/**
 * Displays the help message for the CLI tool, including usage, options, and examples.
 */
function displayHelp() {
  logger.log(`
${description}
Version: ${version}

Usage:
  link-checker [paths...] [options]

Arguments:
  paths                 One or more file or directory paths to scan.
                        Defaults to the current directory if not provided.

Options:
  --help, -h            Show this help message.
  --version, -v         Show the version number.
  --config <path>       Path to a custom configuration file.
  --timeout <ms>        Network request timeout in milliseconds.
                        (Default: 10000)
  --request-delay <ms>  Delay between each HTTP request in milliseconds.
                        (Default: 100)
  --user-agent <string> User-Agent string for network requests.
                        (Default: markdown-link-checker/x.y.z)
  --ignore <pattern>    A regex pattern for URLs to ignore. Can be used multiple times.
  --fail-on-broken      Exit with a non-zero code if any broken links are found.

Examples:
  # Scan all markdown files in the current directory
  link-checker

  # Scan a specific file and a directory
  link-checker ./README.md ./docs/

  # Ignore all links to a specific domain
  link-checker --ignore "https://github.com/.*"

  # Set a custom timeout and fail in CI if links are broken
  link-checker ./docs --timeout 5000 --fail-on-broken
  `);
}

/**
 * Generates and prints a summary report of the validation results to the console.
 * It categorizes links into valid, broken, and ignored, and provides detailed
 * information for broken links.
 *
 * @param {import('../validation/link-validator.js').ValidationResult[]} results - The array of validation results.
 * @returns {{valid: number, broken: number, ignored: number}} An object containing the counts of each link status.
 */
function generateReport(results) {
  const summary = {
    [LINK_STATUS.VALID]: [],
    [LINK_STATUS.BROKEN]: [],
    [LINK_STATUS.IGNORED]: [],
    [LINK_STATUS.SKIPPED]: [], // Although not used by scanner, good to have
  };

  for (const result of results) {
    if (summary[result.status]) {
      summary[result.status].push(result);
    }
  }

  const brokenLinks = summary[LINK_STATUS.BROKEN];
  const validCount = summary[LINK_STATUS.VALID].length;
  const brokenCount = brokenLinks.length;
  const ignoredCount = summary[LINK_STATUS.IGNORED].length;
  const totalCount = results.length;

  if (brokenCount > 0) {
    logger.header('Broken Links Found:');
    brokenLinks.forEach(link => {
      logger.error(link.url);
      logger.detail(`in ${link.file}:${link.line}`);
      const reason = link.statusCode ? `(Status: ${link.statusCode})` : `(Error: ${link.error})`;
      logger.detail(`Reason: ${reason}`);
    });
  }

  logger.header('Scan Summary:');
  logger.log(`Total links checked: ${totalCount}`);
  logger.success(`Valid links: ${validCount}`);
  logger.error(`Broken links: ${brokenCount}`);
  logger.warn(`Ignored links: ${ignoredCount}`);

  return {
    valid: validCount,
    broken: brokenCount,
    ignored: ignoredCount,
  };
}

/**
 * The main function that orchestrates the CLI application flow.
 * It parses arguments, loads configuration, runs the scanner,
 * generates a report, and sets the appropriate exit code.
 */
async function main() {
  const args = yargsParser(process.argv.slice(2), {
    alias: {
      help: ['h'],
      version: ['v'],
    },
    boolean: ['help', 'version', 'fail-on-broken'],
    string: ['config', 'timeout', 'request-delay', 'user-agent', 'ignore'],
  });

  if (args.version) {
    logger.log(version);
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (args.help) {
    displayHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }

  try {
    const config = await loadConfig(args);
    const paths = args._.length > 0 ? args._.map(String) : [process.cwd()];

    const results = await scan(paths, config);
    const report = generateReport(results);

    if (report.broken > 0 && args['fail-on-broken']) {
      logger.error('\nExiting with error code due to broken links found.');
      process.exit(EXIT_CODES.BROKEN_LINKS_FOUND);
    }

    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logger.error(`\nA critical error occurred: ${err.message}`);
    // For debugging, one might want to log the stack trace.
    // console.error(err.stack);
    process.exit(EXIT_CODES.ERROR);
  }
}

// Execute the main function.
main();