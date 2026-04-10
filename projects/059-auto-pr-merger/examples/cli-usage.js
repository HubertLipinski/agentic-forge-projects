/**
 * @file examples/cli-usage.js
 * @description An example script demonstrating how to use the auto-pr-merger tool as a Node.js module.
 *
 * This script shows how to programmatically invoke the core processing logic of the
 * auto-pr-merger. This is useful for integrating the tool into custom CI/CD pipelines,
 * bots, or other automation scripts where the standard CLI or GitHub Action entry points
 * are not suitable.
 *
 * To run this example:
 * 1. Ensure you have the necessary dependencies installed (`npm install`).
 * 2. Set your GitHub token as an environment variable:
 *    `export GITHUB_TOKEN="your_personal_access_token"`
 *    (or `GH_TOKEN` on some systems).
 *    The token needs `repo` scope to read pull requests and merge them.
 * 3. Update the `TARGET_REPO` and `CONFIG_PATH` constants below to point to your
 *    test repository and configuration file.
 * 4. Execute the script from your terminal:
 *    `node examples/cli-usage.js`
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config/loader.js';
import { processRepository } from '../src/core/processor.js';
import logger from '../src/utils/logger.js';

// --- Configuration ---
// IMPORTANT: Replace with your repository details.
const TARGET_REPO = {
  owner: 'your-github-username',
  repo: 'your-test-repository',
};

// Path to the configuration file. This example uses the sample config in the project root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '..', '.github', 'auto-merge.yml');

// Set to `true` to simulate the process without actually merging any pull requests.
// This is highly recommended for initial setup and testing.
const IS_DRY_RUN = true;

/**
 * Main function to demonstrate programmatic usage.
 *
 * This function orchestrates the steps required to run the auto-merger:
 * 1. Validates the presence of a GitHub token.
 * 2. Loads and validates the configuration file.
 * 3. Invokes the core `processRepository` function with the specified options.
 * 4. Logs the results and exits with an appropriate status code.
 */
async function runExample() {
  logger.info('--- Starting Programmatic Auto PR Merger Example ---');

  // 1. Pre-flight check for GitHub token
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    logger.error(
      'Authentication failed. GITHUB_TOKEN or GH_TOKEN environment variable is not set.',
      new Error('Missing authentication token.')
    );
    process.exit(1);
  }

  // A simple check to prevent running on placeholder values.
  if (TARGET_REPO.owner === 'your-github-username') {
    logger.error(
      'Please update the TARGET_REPO constant in examples/cli-usage.js before running.',
      new Error('Configuration placeholder not replaced.')
    );
    process.exit(1);
  }

  try {
    // 2. Load the configuration
    const config = await loadConfig(CONFIG_PATH);
    if (!config) {
      // `loadConfig` logs detailed errors, so we just need to exit.
      throw new Error('Failed to load or validate configuration. Aborting.');
    }

    // 3. Invoke the core processor
    // This is the main function that contains all the business logic.
    const summary = await processRepository({
      owner: TARGET_REPO.owner,
      repo: TARGET_REPO.repo,
      config,
      dryRun: IS_DRY_RUN,
      concurrency: 3, // Optional: control how many PRs are processed in parallel
    });

    // 4. Log summary and determine exit code
    logger.info('Programmatic execution finished.');

    if (summary.failed > 0) {
      logger.error(`Execution completed with ${summary.failed} failed merge attempts.`);
      process.exit(1);
    } else {
      logger.success('Execution completed successfully.');
      process.exit(0);
    }
  } catch (error) {
    // Catch any unhandled errors from the process.
    logger.error('An unexpected error occurred during execution:', error);
    process.exit(1);
  }
}

// Execute the main function.
runExample();