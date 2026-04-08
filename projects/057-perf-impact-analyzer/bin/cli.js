#!/usr/bin/env node

/**
 * @fileoverview The executable CLI entry point for the Performance Impact Analyzer.
 * This script uses 'yargs' to parse command-line arguments and 'ora' for spinners
 * during long operations. It loads configuration, delegates the core analysis
 * to the orchestrator, and presents the final report to the user.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';
import { loadConfig } from '../src/utils/config-loader.js';
import { runAnalysis } from '../src/orchestrator.js';
import { generateReport, hasSignificantRegression } from '../src/reporter/report-generator.js';
import logger from '../src/utils/logger.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Helper to get the version from package.json
const getVersion = () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
};

/**
 * The main CLI function. It parses arguments, orchestrates the analysis,
 * and handles process exit codes.
 */
async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .command('$0 <baseline> <feature>', 'Compare performance between two Git refs', yargs => {
      yargs
        .positional('baseline', {
          describe: 'The baseline Git ref (e.g., main, a commit SHA, or a tag)',
          type: 'string',
        })
        .positional('feature', {
          describe: 'The feature Git ref to compare (e.g., a feature branch)',
          type: 'string',
        });
    })
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to the configuration file (e.g., ./.perf-impact-analyzer.json)',
    })
    .option('repo', {
      alias: 'r',
      type: 'string',
      description: 'Path to the local Git repository',
      default: process.cwd(),
    })
    .option('json', {
      type: 'boolean',
      description: 'Output the report in JSON format',
      default: false,
    })
    .option('fail-on-regression', {
      type: 'boolean',
      description: 'Exit with a non-zero code if a significant regression is detected. Overrides config file setting.',
    })
    .option('debug', {
      type: 'boolean',
      description: 'Enable verbose debug logging',
      default: false,
    })
    .version('version', 'Show version number', getVersion())
    .alias('version', 'v')
    .alias('help', 'h')
    .help()
    .epilog('Copyright 2024 - For more information, visit the project repository.')
    .strict()
    .parse();

  if (argv.debug) {
    process.env.DEBUG = 'true';
  }

  const spinner = ora('Initializing Performance Impact Analyzer...').start();

  try {
    // 1. Load and validate configuration
    spinner.text = 'Loading configuration...';
    const userConfig = await loadConfig(argv.config);
    spinner.succeed('Configuration loaded successfully.');

    // CLI flags override config file settings for convenience
    const config = {
      ...userConfig,
      json: argv.json || userConfig.json,
      // `fail-on-regression` can be overridden from the command line.
      // The nullish coalescing operator handles the case where `argv.failOnRegression` is undefined.
      failOnRegression: argv.failOnRegression ?? userConfig.failOnRegression,
    };

    // 2. Run the full analysis
    const analysisOptions = {
      baselineRef: argv.baseline,
      featureRef: argv.feature,
      repoPath: argv.repo,
      config,
    };

    // The orchestrator will handle its own spinners for sub-tasks.
    spinner.stop();
    const results = await runAnalysis(analysisOptions);

    // 3. Generate and display the report
    const report = generateReport(results, config);
    logger.info(report);

    // 4. Determine exit code based on regression
    if (config.failOnRegression) {
      const regressionDetected = hasSignificantRegression(results.comparison, config.regressionThreshold);
      if (regressionDetected) {
        logger.error('A significant performance regression was detected.');
        process.exit(1);
      } else {
        logger.success('No significant performance regressions detected.');
      }
    }
  } catch (error) {
    // Ensure the spinner stops on failure and log the error message.
    spinner.stop();
    logger.error(error.message);
    if (process.env.DEBUG && error.stack) {
      logger.debug(`\n${error.stack}`);
    }
    process.exit(1);
  }
}

// Execute the main function and handle any unhandled promise rejections.
main().catch(error => {
  logger.error('An unexpected error occurred:');
  logger.error(error.message);
  if (process.env.DEBUG && error.stack) {
    logger.debug(`\n${error.stack}`);
  }
  process.exit(1);
});