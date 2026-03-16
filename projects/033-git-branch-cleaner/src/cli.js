#!/usr/bin/env node

/**
 * src/cli.js
 *
 * This is the main entry point for the Git Branch Cleaner command-line application.
 * It uses 'commander' to parse command-line arguments and options, and then
 * orchestrates the core logic of the application by calling other modules.
 *
 * Responsibilities:
 * - Define the CLI command, its description, and all available options.
 * - Parse user-provided arguments.
 * - Validate and process options.
 * - Coordinate calls to the branch lister, interactive UI, and branch deleter.
 * - Handle top-level errors and present them to the user in a friendly format.
 *
 * @module cli
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getDeletableBranches } from '../core/branch-lister.js';
import { deleteBranches } from '../core/branch-deleter.js';
import {
  promptForBranchesToDelete,
  confirmForceDelete,
  displayDeletionResults,
} from '../ui/interactive.js';
import { checkIsRepo } from '../utils/git.js';

// Default configuration values
const DEFAULT_STALE_THRESHOLD_DAYS = 90;
const DEFAULT_EXCLUSION_LIST = ['main', 'master', 'develop', 'development', 'release'];

/**
 * The main asynchronous function that orchestrates the branch cleaning process.
 * @param {object} options - The options object provided by commander.
 */
async function run(options) {
  try {
    // 1. Initial setup and validation
    // Perform a quick check to ensure we're in a Git repository before doing anything else.
    checkIsRepo();

    const { days, force, dryRun, exclude } = options;
    const staleThresholdInDays = parseInt(days, 10);

    // Combine default exclusions with user-provided ones, ensuring no duplicates.
    const exclusionList = [...new Set([...DEFAULT_EXCLUSION_LIST, ...exclude])];

    const listerOptions = {
      staleThresholdInDays,
      exclusionList,
    };

    const filters = {
      includeMerged: true,
      includeStale: staleThresholdInDays > 0,
    };

    // 2. Fetch and filter branches
    console.log(chalk.blue('🔍 Analyzing local branches...'));
    const deletableBranches = await getDeletableBranches(listerOptions, filters);

    // 3. User interaction to select branches
    const branchesToProcess = await promptForBranchesToDelete(deletableBranches);

    if (branchesToProcess.length === 0) {
      // `promptForBranchesToDelete` already logs a message, so we can just exit.
      return;
    }

    // 4. Handle force-delete confirmation if necessary
    let isDeletionConfirmed = true;
    if (force) {
      const unmergedBranches = branchesToProcess.filter(
        branch => branch.status !== 'merged'
      );
      if (unmergedBranches.length > 0) {
        isDeletionConfirmed = await confirmForceDelete(unmergedBranches);
      }
    }

    if (!isDeletionConfirmed) {
      console.log(chalk.yellow('\n⚠️ Force-delete not confirmed. Aborting operation.'));
      return;
    }

    // 5. Execute deletion (or dry run)
    const deletionOptions = {
      force,
      dryRun,
    };

    const deletionResults = await deleteBranches(branchesToProcess, deletionOptions);

    // 6. Display final results
    displayDeletionResults(deletionResults, dryRun);

  } catch (error) {
    // Catch-all for any errors that bubble up from the underlying modules.
    console.error(chalk.red.bold('\n❌ An unexpected error occurred:'));
    console.error(chalk.red(error.message));
    // Provide a hint for common issues
    if (error.message.includes('git')) {
        console.error(chalk.yellow('\nPlease ensure Git is installed and you are in a valid Git repository.'));
    }
    process.exit(1);
  }
}

/**
 * Sets up the commander program and parses command-line arguments.
 */
function main() {
  const program = new Command();

  program
    .version('1.0.0', '-v, --version', 'Output the current version')
    .description('A CLI tool to find and interactively delete stale or merged local Git branches.')
    .option(
      '-d, --days <number>',
      'The number of days since the last commit to consider a branch "stale". Set to 0 to disable staleness check.',
      DEFAULT_STALE_THRESHOLD_DAYS.toString()
    )
    .option(
      '-f, --force',
      'Allow force-deletion of unmerged branches (requires confirmation).',
      false
    )
    .option(
      '--dry-run',
      'Preview which branches would be deleted without actually deleting them.',
      false
    )
    .option(
      '-e, --exclude <branches...>',
      'A list of branches to protect from deletion, in addition to defaults.',
      []
    )
    .action(run)
    .parseAsync(process.argv);
}

// Execute the main function
main();