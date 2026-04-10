/**
 * @file src/modes/action.js
 * @description The entry point for the GitHub Action. Reads inputs from the action environment and invokes the processor.
 *
 * This script is executed when the `auto-pr-merger` is run as a GitHub Action.
 * It is responsible for:
 * 1. Retrieving action inputs (like `config-path` and `dry-run`) using `@actions/core`.
 * 2. Sourcing the `GITHUB_TOKEN` from the action's environment.
 * 3. Determining the repository context (owner and repo) from the action's environment.
 * 4. Loading and validating the configuration file.
 * 5. Invoking the core `processRepository` function with the appropriate parameters.
 * 6. Setting the action's final status (success or failure) based on the outcome.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadConfig } from '../config/loader.js';
import { processRepository } from '../core/processor.js';
import logger from '../utils/logger.js';

/**
 * Retrieves and validates the inputs for the GitHub Action.
 *
 * @returns {{
 *   configPath: string,
 *   dryRun: boolean,
 *   concurrency: number
 * }} The action inputs.
 * @throws {Error} If a required input is missing or invalid.
 */
function getActionInputs() {
  const configPath = core.getInput('config-path', { required: true });
  const dryRun = core.getBooleanInput('dry-run', { required: false });
  const concurrency = parseInt(core.getInput('concurrency', { required: false }) || '5', 10);

  if (!configPath) {
    throw new Error("Input 'config-path' is required but was not provided.");
  }

  if (isNaN(concurrency) || concurrency < 1) {
    logger.warn(`Invalid 'concurrency' value. Falling back to default (5).`);
    return { configPath, dryRun, concurrency: 5 };
  }

  return { configPath, dryRun, concurrency };
}

/**
 * The main function for the GitHub Action entry point.
 *
 * It orchestrates the entire process from reading inputs to executing the merge logic
 * and setting the final action status.
 *
 * @returns {Promise<void>} A promise that resolves when the action is complete.
 */
export async function runAction() {
  try {
    logger.info('Starting Auto PR Merger action...');

    // The GITHUB_TOKEN is automatically available in the environment.
    // The Octokit client will pick it up. We just check for its presence.
    if (!process.env.GITHUB_TOKEN) {
      throw new Error(
        'GITHUB_TOKEN is not set. Please ensure the action is running with a valid token.'
      );
    }

    const { configPath, dryRun, concurrency } = getActionInputs();
    const { owner, repo } = github.context.repo;

    if (!owner || !repo) {
      throw new Error(
        'Could not determine repository owner and name from the GitHub context.'
      );
    }

    const config = await loadConfig(configPath);
    if (!config) {
      // loadConfig logs detailed errors, so we just need to fail the action.
      throw new Error('Failed to load or validate configuration.');
    }

    const summary = await processRepository({
      owner,
      repo,
      config,
      dryRun,
      concurrency,
    });

    // Set outputs for other actions to potentially use.
    core.setOutput('merged_count', summary.merged);
    core.setOutput('skipped_count', summary.skipped);
    core.setOutput('failed_count', summary.failed);

    if (summary.failed > 0) {
      // If any merge attempts failed, we consider the action to have failed.
      core.setFailed(`${summary.failed} pull request(s) failed to merge.`);
    } else {
      logger.success('Action completed successfully.');
    }
  } catch (error) {
    // Any unhandled exception will be caught here and fail the action.
    logger.error('An unexpected error occurred during action execution.', error);
    core.setFailed(error.message);
  }
}