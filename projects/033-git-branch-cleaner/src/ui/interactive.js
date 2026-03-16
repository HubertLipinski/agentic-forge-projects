/**
 * src/ui/interactive.js
 *
 * This module handles all interactive user prompts and formatted output for the
 * Git Branch Cleaner. It uses 'inquirer' for creating interactive lists and
 * 'chalk' for color-coding the output to make it clear and user-friendly.
 *
 * @module ui/interactive
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { getDaysSince } from '../utils/date.js';

/**
 * @typedef {import('../core/branch-lister.js').EnrichedBranchInfo} EnrichedBranchInfo
 * @typedef {import('../core/branch-deleter.js').DeletionResult} DeletionResult
 */

/**
 * A mapping of branch statuses to their corresponding chalk color functions.
 * This ensures consistent color-coding throughout the UI.
 * @type {Record<import('../core/branch-lister.js').BranchStatus, import('chalk').Chalk>}
 */
const STATUS_COLORS = {
  merged: chalk.green,
  stale: chalk.yellow,
  protected: chalk.cyan,
  current: chalk.blue.bold,
  active: chalk.white,
};

/**
 * Formats a single branch for display in a list.
 * It color-codes the status and includes relevant information like age.
 *
 * @param {EnrichedBranchInfo} branch - The branch information to format.
 * @returns {string} A formatted, colorized string for display.
 */
function formatBranchForDisplay(branch) {
  const statusColor = STATUS_COLORS[branch.status] || chalk.white;
  const statusText = `[${statusColor(branch.status.padEnd(9))}]`;

  const daysSinceCommit = getDaysSince(branch.lastCommitDate);
  const ageText =
    daysSinceCommit >= 0
      ? chalk.gray(`(${daysSinceCommit} days ago)`)
      : chalk.gray('(unknown age)');

  const nameText = chalk.bold(branch.name.padEnd(30));

  return `${statusText} ${nameText} ${ageText}`;
}

/**
 * Presents a list of deletable branches to the user and prompts them to select
 * which ones to delete.
 *
 * @param {EnrichedBranchInfo[]} branches - The list of branches that can be deleted.
 * @returns {Promise<EnrichedBranchInfo[]>} A promise that resolves with the array of branches selected by the user.
 */
export async function promptForBranchesToDelete(branches) {
  if (!branches || branches.length === 0) {
    console.log(chalk.green('✨ Your local repository is already clean! No branches to delete.'));
    return [];
  }

  console.log('The following branches can be cleaned up:');

  const choices = branches.map(branch => ({
    name: formatBranchForDisplay(branch),
    value: branch, // The full branch object is the value
    short: branch.name, // Used for display after selection
  }));

  try {
    const { selectedBranches } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedBranches',
        message: 'Select branches to delete (use spacebar to select, enter to confirm):',
        choices,
        pageSize: 15, // Show more items at once
        loop: false, // Prevent looping from top to bottom
      },
    ]);

    return selectedBranches;
  } catch (error) {
    // Inquirer can throw errors, e.g., if the process is terminated.
    console.error(chalk.red('\nAn error occurred during the interactive prompt. Aborting.'));
    // Return an empty array to gracefully stop the deletion process.
    return [];
  }
}

/**
 * Prompts the user for confirmation before performing a force-delete operation.
 * This is a critical safety check to prevent accidental data loss.
 *
 * @param {EnrichedBranchInfo[]} unmergedBranches - The list of unmerged branches targeted for force deletion.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the user confirms, `false` otherwise.
 */
export async function confirmForceDelete(unmergedBranches) {
  if (!unmergedBranches || unmergedBranches.length === 0) {
    // No unmerged branches selected, so no need for this confirmation.
    return true;
  }

  console.warn(chalk.yellow.bold('\n⚠️  WARNING: You are about to force-delete unmerged branches.'));
  console.warn(chalk.yellow('This action cannot be undone and may lead to loss of work.'));
  console.log('\nThe following unmerged branches will be force-deleted:');
  unmergedBranches.forEach(branch => {
    console.log(`  - ${chalk.bold(branch.name)}`);
  });

  try {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you absolutely sure you want to proceed?',
        default: false, // Default to 'no' for safety
      },
    ]);
    return confirmed;
  } catch (error) {
    console.error(chalk.red('\nAn error occurred during the confirmation prompt. Aborting.'));
    return false;
  }
}

/**
 * Displays the final results of the deletion process in a clear, summary format.
 * It separates successes from failures and provides the reason for each failure.
 *
 * @param {DeletionResult[]} results - The array of results from the branch-deleter module.
 * @param {boolean} isDryRun - Indicates if the operation was a dry run.
 */
export function displayDeletionResults(results, isDryRun) {
  if (results.length === 0) {
    // This case might happen if the user deselected all branches.
    console.log(chalk.yellow('\nNo branches were selected for deletion.'));
    return;
  }

  if (isDryRun) {
    console.log(chalk.cyan.bold('\n--- DRY RUN RESULTS ---'));
    console.log(chalk.cyan('No branches were actually deleted. The following actions would be taken:'));
  } else {
    console.log(chalk.green.bold('\n--- DELETION COMPLETE ---'));
  }

  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  if (successes.length > 0) {
    console.log(chalk.green(`\n✅ Successfully processed ${successes.length} branches:`));
    successes.forEach(result => {
      const message = isDryRun ? result.message : `Deleted branch ${result.branchName}`;
      console.log(`  - ${message}`);
    });
  }

  if (failures.length > 0) {
    console.log(chalk.red(`\n❌ Failed to process ${failures.length} branches:`));
    failures.forEach(result => {
      console.log(`  - ${chalk.bold(result.branchName)}: ${chalk.red(result.message)}`);
    });
  }

  console.log('\n✨ Cleanup finished.');
}