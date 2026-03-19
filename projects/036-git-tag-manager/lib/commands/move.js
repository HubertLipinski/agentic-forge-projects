/**
 * @file lib/commands/move.js
 * @description Implements the 'move' command for the Git Tag Manager CLI.
 * This command allows moving an existing tag to a new commit, effectively
 * retagging. It ensures the old tag is deleted and the new one is created
 * on local and remote repositories.
 */

import chalk from 'chalk';
import {
  fetchTags,
  deleteLocalTag,
  deleteRemoteTag,
  createLocalTag,
  pushTag,
  getCommitForTag,
  validateCommit,
} from '../git-client.js';
import {
  printError,
  printInfo,
  printSuccess,
  printWarning,
  promptForConfirmation,
} from '../ui-helpers.js';

/**
 * Command configuration for yargs.
 * @type {import('yargs').CommandModule}
 */
export const command = 'move <tag> <to-commit> [remotes..]';
export const describe = 'Move a tag to a new commit hash';

/**
 * Builds the yargs options for the 'move' command.
 * @param {import('yargs').Argv} yargs - The yargs instance.
 * @returns {import('yargs').Argv} The configured yargs instance.
 */
export function builder(yargs) {
  return yargs
    .positional('tag', {
      describe: 'The tag to move (e.g., v1.2.3)',
      type: 'string',
    })
    .positional('to-commit', {
      describe: 'The target commit hash or reference (e.g., HEAD, a1b2c3d)',
      type: 'string',
    })
    .positional('remotes', {
      describe: 'A list of remote names to update (e.g., origin upstream)',
      type: 'string',
      default: [],
    })
    .option('force', {
      alias: 'f',
      describe: 'Allow overwriting the tag on remotes if it already exists',
      type: 'boolean',
      default: false,
    })
    .option('yes', {
      alias: 'y',
      describe: 'Skip interactive confirmation before moving the tag',
      type: 'boolean',
      default: false,
    })
    .option('dry-run', {
      alias: 'n',
      describe: 'Show which operations would be performed without executing them',
      type: 'boolean',
      default: false,
    });
}

/**
 * The main handler for the 'move' command.
 * Orchestrates validating, confirming, and moving the tag.
 * @param {object} argv - The parsed command-line arguments from yargs.
 * @returns {Promise<void>}
 */
export async function handler(argv) {
  try {
    const { tag, toCommit, remotes, force, yes: skipConfirmation, dryRun } = argv;

    if (dryRun) {
      printInfo(chalk.yellow.bold('*** DRY RUN MODE ENABLED ***'));
      printInfo('No actual git operations will be performed.\n');
    }

    // 1. Validate inputs
    printInfo(`Validating tag '${chalk.cyan(tag)}' and commit '${chalk.yellow(toCommit)}'...`);
    const allTags = await fetchTags(remotes, false); // Fetch without pruning
    if (!allTags.has(tag)) {
      throw new Error(`Tag '${tag}' not found locally or on specified remotes.`);
    }

    const [currentCommit, targetCommit] = await Promise.all([
      getCommitForTag(tag),
      validateCommit(toCommit),
    ]);

    if (currentCommit === targetCommit) {
      printInfo(`Tag '${chalk.cyan(tag)}' is already on commit ${chalk.yellow(targetCommit)}. No action needed.`);
      return;
    }

    // 2. Confirm with user
    const confirmed = await confirmMove(tag, currentCommit, targetCommit, remotes, skipConfirmation, dryRun);
    if (!confirmed) {
      printInfo('Move operation cancelled by user.');
      return;
    }

    // 3. Execute move
    await executeMove(tag, targetCommit, remotes, force, dryRun);

    printSuccess(chalk.bold(`\nSuccessfully moved tag '${chalk.cyan(tag)}' to commit ${chalk.yellow(targetCommit)}.`));
  } catch (error) {
    printError(`Failed to execute move command: ${error.message}`);
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Displays the planned move operation and prompts for user confirmation.
 * @param {string} tag - The tag being moved.
 * @param {string} fromCommit - The source commit hash.
 * @param {string} toCommit - The destination commit hash.
 * @param {string[]} remotes - The remotes to update.
 * @param {boolean} skipConfirmation - If true, skips the interactive prompt.
 * @param {boolean} dryRun - If true, indicates a dry run.
 * @returns {Promise<boolean>} True if the user confirms, false otherwise.
 */
async function confirmMove(tag, fromCommit, toCommit, remotes, skipConfirmation, dryRun) {
  if (skipConfirmation && !dryRun) {
    printInfo('Skipping confirmation as requested.');
    return true;
  }

  console.log('\n' + chalk.bold.underline('Tag Move Plan'));
  console.log(`  Tag:         ${chalk.cyan(tag)}`);
  console.log(`  From commit: ${chalk.red(fromCommit)}`);
  console.log(`  To commit:   ${chalk.green(toCommit)}`);
  if (remotes.length > 0) {
    console.log(`  Remotes:     ${remotes.map(r => chalk.magenta(r)).join(', ')}`);
  }
  console.log('');

  const action = dryRun ? 'Preview move operation?' : `Proceed with moving tag '${tag}'?`;
  return promptForConfirmation(action);
}

/**
 * Executes the sequence of Git commands to move the tag.
 * @param {string} tag - The tag to move.
 * @param {string} targetCommit - The destination commit hash.
 * @param {string[]} remotes - The list of remotes to update.
 * @param {boolean} force - Whether to force-push the tag to remotes.
 * @param {boolean} dryRun - If true, only logs the actions.
 * @returns {Promise<void>}
 */
async function executeMove(tag, targetCommit, remotes, force, dryRun) {
  printInfo('\nExecuting move operation...');

  // Step 1: Delete the local tag
  if (dryRun) {
    printInfo(`[DRY RUN] Would delete local tag: ${chalk.cyan(tag)}`);
  } else {
    await deleteLocalTag(tag);
    printSuccess(`Deleted local tag: ${chalk.cyan(tag)}`);
  }

  // Step 2: Delete the remote tags
  for (const remote of remotes) {
    if (dryRun) {
      printInfo(`[DRY RUN] Would delete remote tag on ${chalk.magenta(remote)}: ${chalk.cyan(tag)}`);
    } else {
      try {
        await deleteRemoteTag(remote, tag);
        printSuccess(`Deleted tag on ${chalk.magenta(remote)}: ${chalk.cyan(tag)}`);
      } catch (error) {
        // This is often not a critical failure, as the tag might not exist on all remotes.
        printWarning(`Could not delete tag on ${chalk.magenta(remote)} (it may not exist): ${error.shortMessage}`);
      }
    }
  }

  // Step 3: Create the new local tag
  if (dryRun) {
    printInfo(`[DRY RUN] Would create local tag: ${chalk.cyan(tag)} at ${chalk.yellow(targetCommit)}`);
  } else {
    await createLocalTag(tag, targetCommit);
    printSuccess(`Created new local tag: ${chalk.cyan(tag)} at ${chalk.yellow(targetCommit)}`);
  }

  // Step 4: Push the new tag to remotes
  for (const remote of remotes) {
    if (dryRun) {
      const forceFlag = force ? ' with --force' : '';
      printInfo(`[DRY RUN] Would push tag ${chalk.cyan(tag)} to ${chalk.magenta(remote)}${forceFlag}`);
    } else {
      await pushTag(remote, tag, force);
      printSuccess(`Pushed tag ${chalk.cyan(tag)} to ${chalk.magenta(remote)}`);
    }
  }
}