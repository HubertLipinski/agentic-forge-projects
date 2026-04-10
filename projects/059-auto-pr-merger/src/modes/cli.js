/**
 * @file src/modes/cli.js
 * @description The entry point for the CLI. Parses command-line arguments using yargs and invokes the processor.
 *
 * This script is executed when the `auto-pr-merger` is run from the command line.
 * It is responsible for:
 * 1. Defining and parsing CLI arguments using `yargs`, including repository, config path, and options like dry-run.
 * 2. Sourcing the `GITHUB_TOKEN` or `GH_TOKEN` from the environment.
 * 3. Loading and validating the configuration file specified via the arguments.
 * 4. Invoking the core `processRepository` function with the parsed parameters.
 * 5. Handling process exit codes based on the outcome of the operation.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadConfig } from '../config/loader.js';
import { processRepository } from '../core/processor.js';
import logger from '../utils/logger.js';
import { name as appName, version as appVersion } from '../../package.json';

/**
 * Configures and parses command-line arguments using yargs.
 *
 * @param {string[]} argv - The command-line arguments array (e.g., `process.argv`).
 * @returns {object} The parsed arguments object.
 */
function parseCliArgs(argv) {
  return yargs(hideBin(argv))
    .scriptName(appName)
    .usage('Usage: $0 --repo <owner>/<name> --config-path <path> [options]')
    .version(appVersion)
    .alias('v', 'version')
    .option('repo', {
      alias: 'r',
      type: 'string',
      description: 'The target repository in "owner/repo" format.',
      demandOption: true,
    })
    .option('config-path', {
      alias: 'c',
      type: 'string',
      description: 'Path to the YAML configuration file.',
      default: '.github/auto-merge.yml',
    })
    .option('dry-run', {
      type: 'boolean',
      description: 'Simulate the process without performing any merges.',
      default: false,
    })
    .option('concurrency', {
      type: 'number',
      description: 'Number of pull requests to process concurrently.',
      default: 5,
      coerce: val => {
        if (Number.isInteger(val) && val > 0) {
          return val;
        }
        logger.warn(`Invalid concurrency value '${val}'. Using default of 5.`);
        return 5;
      },
    })
    .check(argv => {
      const repoRegex = /^[a-zA-Z0-9-]+\/[a-zA-Z0-9-._]+$/;
      if (!repoRegex.test(argv.repo)) {
        throw new Error('Invalid --repo format. Must be "owner/repo".');
      }
      return true;
    })
    .help()
    .alias('h', 'help')
    .epilogue(
      'For more information, visit https://github.com/your-username/auto-pr-merger'
    ).argv;
}

/**
 * The main function for the CLI entry point.
 *
 * It orchestrates the entire process from parsing arguments to executing the merge logic
 * and setting the final process exit code.
 *
 * @returns {Promise<void>} A promise that resolves when the CLI command is complete.
 */
export async function runCli() {
  try {
    logger.info(`Starting Auto PR Merger CLI (v${appVersion})...`);

    // The Octokit client will throw an error if the token is missing,
    // which will be caught here. This provides an early, clear failure.
    if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
      throw new Error(
        'Authentication failed: GITHUB_TOKEN or GH_TOKEN environment variable is not set.'
      );
    }

    const argv = await parseCliArgs(process.argv);

    const [owner, repo] = argv.repo.split('/');
    const { configPath, dryRun, concurrency } = argv;

    const config = await loadConfig(configPath);
    if (!config) {
      // loadConfig logs detailed errors, so we just need to exit.
      throw new Error('Failed to load or validate configuration. Aborting.');
    }

    const summary = await processRepository({
      owner,
      repo,
      config,
      dryRun,
      concurrency,
    });

    if (summary.failed > 0) {
      // If any merge attempts failed, exit with a non-zero status code.
      logger.error('CLI execution finished with errors.');
      process.exit(1);
    } else {
      logger.success('CLI execution completed successfully.');
      process.exit(0);
    }
  } catch (error) {
    // Catch-all for any unhandled exceptions during the process.
    // This includes yargs validation errors, config loading failures, and Octokit client init failures.
    logger.error('An unexpected error occurred:', error);
    process.exit(1);
  }
}