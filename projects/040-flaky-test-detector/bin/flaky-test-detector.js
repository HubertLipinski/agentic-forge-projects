#!/usr/bin/env node

/**
 * @file bin/flaky-test-detector.js
 * @description The executable script for the CLI. It uses yargs to parse
 * command-line arguments and then invokes the main application logic.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { loadConfig } from '../src/config/loader.js';
import { run } from '../src/main.js';
import { DEFAULT_CONFIG, PARSER_PATTERNS } from '../src/config/constants.js';

/**
 * Configures and runs the yargs command-line argument parser.
 * This function defines all available CLI options, their descriptions,
 * types, and default values.
 *
 * @returns {object} The parsed command-line arguments object.
 */
function setupCLI() {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 --command "npm test" [options]')
    .help('help')
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .option('command', {
      alias: 'c',
      describe: 'The test command to execute.',
      type: 'string',
      demandOption: false, // Not strictly demanded here; validated after config merge
    })
    .option('runs', {
      alias: 'r',
      describe: 'The total number of times to run the test suite.',
      type: 'number',
      default: DEFAULT_CONFIG.runs,
    })
    .option('parallel', {
      alias: 'p',
      describe: 'The number of test runs to execute in parallel.',
      type: 'number',
      default: DEFAULT_CONFIG.parallel,
    })
    .option('parser', {
      describe: 'The test output parser to use.',
      type: 'string',
      choices: Object.keys(PARSER_PATTERNS),
      default: DEFAULT_CONFIG.parser,
    })
    .option('cwd', {
      describe: 'The working directory to run the command from.',
      type: 'string',
      default: DEFAULT_CONFIG.cwd,
    })
    .option('config', {
      describe: 'Path to a custom configuration file.',
      type: 'string',
      // Note: yargs doesn't directly use this; our loader logic handles it.
      // It's here for discoverability.
    })
    .option('interactive', {
      alias: 'i',
      describe: 'Run in interactive mode to configure the session.',
      type: 'boolean',
      default: false,
    })
    .option('exitOnFirstFailure', {
      describe: 'Stop all runs immediately after the first test suite failure.',
      type: 'boolean',
      default: DEFAULT_CONFIG.exitOnFirstFailure,
    })
    .option('showStable', {
      describe: 'Include stable tests in the final report.',
      type: 'boolean',
      default: false,
    })
    .epilogue(
      `For more information, visit https://github.com/your-username/flaky-test-detector`,
    )
    .fail((msg, err, yargs) => {
      // Custom failure handler for better error messages
      if (err) {
        // This handles internal yargs errors
        console.error(chalk.red.bold('Error:'), err.message);
        process.exit(1);
      }
      // This handles validation errors (e.g., invalid choice)
      console.error(chalk.red.bold('Error:'), msg);
      console.error(
        chalk.yellow('\nRun with --help for a list of available options.'),
      );
      process.exit(1);
    }).argv;
}

/**
 * The main execution function for the CLI.
 * It parses arguments, loads configuration, and starts the detector.
 * The process exit code is set based on whether flaky tests were found.
 */
async function main() {
  try {
    const cliArgs = setupCLI();
    const config = await loadConfig(cliArgs);

    // The `run` function returns `true` if flaky/failed tests are found or if an error occurs.
    const foundFlakyTests = await run(config);

    // Exit with a non-zero status code if flaky tests were detected,
    // which is useful for CI/CD pipeline integration.
    process.exit(foundFlakyTests ? 1 : 0);
  } catch (error) {
    console.error(chalk.red.bold(`\n[FATAL] An unhandled error occurred:`));
    console.error(chalk.red(error.message));
    // For debugging, you might want to uncomment the next line:
    // console.error(error.stack);
    process.exit(1);
  }
}

// Start the application
main();