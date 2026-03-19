/**
 * @file lib/commands/delete.js
 * @description Implements the 'delete' command for the Git Tag Manager CLI.
 * This command finds tags matching a semver range, allows for interactive
 * selection, and performs deletion on the local repository and specified remotes.
 */

import chalk from 'chalk';
import { fetchTags, deleteLocalTag, deleteRemoteTag } from '../git-client.js';
import { filterTagsBySemver } from '../tag-filter.js';
import {
  printError,
  printInfo,
  printSuccess,
  printWarning,
  promptForConfirmation,
  promptForTagSelection,
} from '../ui-helpers.js';

/**
 * Command configuration for yargs.
 * @type {import('yargs').CommandModule}
 */
export const command = 'delete [remotes..]';
export const describe = 'Delete tags matching a semver range from local and/or remotes';

/**
 * Builds the yargs options for the 'delete' command.
 * @param {import('yargs').Argv} yargs - The yargs instance.
 * @returns {import('yargs').Argv} The configured yargs instance.
 */
export function builder(yargs) {
  return yargs
    .positional('remotes', {
      describe: 'A list of remote names to delete tags from (e.g., origin upstream)',
      type: 'string',
      default: [],
    })
    .option('range', {
      alias: 'r',
      describe: 'A semantic versioning range to select tags for deletion',
      type: 'string',
      demandOption: true, // Deleting without a range is too dangerous
    })
    .option('yes', {
      alias: 'y',
      describe: 'Skip interactive confirmation and delete all matching tags',
      type: 'boolean',
      default: false,
    })
    .option('dry-run', {
      alias: 'n',
      describe: 'Show which tags would be deleted without actually deleting them',
      type: 'boolean',
      default: false,
    });
}

/**
 * The main handler for the 'delete' command.
 * Orchestrates finding, confirming, and deleting tags.
 * @param {object} argv - The parsed command-line arguments from yargs.
 * @returns {Promise<void>}
 */
export async function handler(argv) {
  try {
    const { remotes, range, yes: skipConfirmation, dryRun } = argv;

    if (dryRun) {
      printInfo(chalk.yellow.bold('*** DRY RUN MODE ENABLED ***'));
      printInfo('No actual delete operations will be performed.\n');
    }

    printInfo(`Fetching tags to find matches for range: ${chalk.cyan(range)}`);
    const allTags = await fetchTags(remotes);

    if (allTags.size === 0) {
      printInfo('No tags found locally or on the specified remotes.');
      return;
    }

    const matchingTags = filterTagsBySemver(Array.from(allTags), range);

    if (matchingTags.length === 0) {
      printInfo(`No tags found matching the semver range: ${chalk.cyan(range)}`);
      return;
    }

    const tagsToDelete = await getTagsToDelete(matchingTags, skipConfirmation);

    if (tagsToDelete.length === 0) {
      printInfo('No tags selected for deletion. Aborting.');
      return;
    }

    await executeDeletion(tagsToDelete, remotes, dryRun);
  } catch (error) {
    printError(`Failed to execute delete command: ${error.message}`);
    // For debugging purposes, log the full error in a non-production environment
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Determines the final list of tags to be deleted, either through interactive
 * selection or by confirming the full list.
 * @param {string[]} matchingTags - Tags that match the user's semver range.
 * @param {boolean} skipConfirmation - If true, skips all prompts.
 * @returns {Promise<string[]>} A promise that resolves to an array of tag names to delete.
 */
async function getTagsToDelete(matchingTags, skipConfirmation) {
  if (skipConfirmation) {
    printInfo('Skipping confirmation as requested. All matching tags will be targeted.');
    return matchingTags;
  }

  const selectedTags = await promptForTagSelection(
    matchingTags,
    'Select tags to delete (Space to select, Enter to confirm)',
  );

  if (selectedTags.length === 0) {
    return [];
  }

  console.log('\n' + chalk.bold('You have selected the following tags for deletion:'));
  selectedTags.forEach(tag => console.log(`  - ${chalk.cyan(tag)}`));

  const confirmed = await promptForConfirmation(
    `Are you sure you want to delete these ${selectedTags.length} tag(s) locally and from remotes?`,
  );

  return confirmed ? selectedTags : [];
}

/**
 * Executes the deletion of tags locally and on all specified remotes.
 * @param {string[]} tags - The list of tag names to delete.
 * @param {string[]} remotes - The list of remote names to delete from.
 * @param {boolean} dryRun - If true, only logs the actions that would be taken.
 * @returns {Promise<void>}
 */
async function executeDeletion(tags, remotes, dryRun) {
  printInfo(`\nStarting deletion process for ${tags.length} tag(s)...`);

  const results = {
    success: [],
    failed: [],
  };

  for (const tag of tags) {
    try {
      if (dryRun) {
        printInfo(`[DRY RUN] Would delete local tag: ${chalk.cyan(tag)}`);
      } else {
        await deleteLocalTag(tag);
        printSuccess(`Successfully deleted local tag: ${chalk.cyan(tag)}`);
      }

      for (const remote of remotes) {
        if (dryRun) {
          printInfo(`[DRY RUN] Would delete remote tag on ${chalk.magenta(remote)}: ${chalk.cyan(tag)}`);
        } else {
          await deleteRemoteTag(remote, tag);
          printSuccess(`Successfully deleted tag on ${chalk.magenta(remote)}: ${chalk.cyan(tag)}`);
        }
      }
      results.success.push(tag);
    } catch (error) {
      results.failed.push({ tag, error: error.message });
      printError(`Failed to delete tag ${chalk.red(tag)}: ${error.message}`);
      // In non-dry-run mode, a failure on one tag shouldn't stop others.
      // We log it and continue.
    }
  }

  console.log('\n' + chalk.bold.underline('Deletion Summary'));
  if (dryRun) {
    printInfo(`[DRY RUN] Would have attempted to delete ${tags.length} tag(s).`);
  } else {
    printSuccess(`Successfully deleted ${results.success.length} tag(s).`);
    if (results.failed.length > 0) {
      printWarning(`Failed to delete ${results.failed.length} tag(s):`);
      results.failed.forEach(({ tag, error }) => {
        console.log(`  - ${chalk.red(tag)}: ${chalk.dim(error)}`);
      });
    }
  }
}