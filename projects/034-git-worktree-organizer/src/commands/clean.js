import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  getWorktrees,
  isGitRepository,
  removeWorktree,
  pruneWorktrees,
} from '../utils/git.js';

/**
 * Identifies worktrees that are considered "prunable" by Git.
 * A prunable worktree is one whose associated branch has been deleted.
 *
 * @param {Array<object>} worktrees - An array of worktree objects from `getWorktrees`.
 * @returns {Array<object>} An array of prunable worktree objects.
 */
function findPrunableWorktrees(worktrees) {
  // `git worktree list --porcelain` provides an explicit `prunable` field.
  // This is the most reliable way to determine if a worktree is stale.
  return worktrees.filter(wt => wt.isPrunable && !wt.isMain);
}

/**
 * Prompts the user for confirmation to remove a list of prunable worktrees.
 *
 * @param {Array<object>} prunableWorktrees - The list of worktrees to be removed.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the user confirms, `false` otherwise.
 */
async function confirmCleanup(prunableWorktrees) {
  console.log(chalk.yellow('The following worktrees are linked to deleted branches and can be cleaned up:'));

  // Display a clear list of what will be removed.
  prunableWorktrees.forEach(wt => {
    console.log(`  - ${chalk.strikethrough(wt.branch)} at ${chalk.dim(wt.path)}`);
  });
  console.log(''); // Add a blank line for readability.

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Proceed with removing these ${prunableWorktrees.length} worktree(s)?`,
      default: false,
    },
  ]);

  return confirmed;
}

/**
 * Implements the 'clean' command logic.
 *
 * This function identifies prunable worktrees (those whose branches have been deleted)
 * and removes them, either automatically in non-interactive mode or after user
 * confirmation in interactive mode.
 *
 * @param {object} options - Command-line options.
 * @param {boolean} [options.force=false] - If true, bypasses the confirmation prompt.
 */
export async function cleanCommand(options) {
  try {
    if (!(await isGitRepository())) {
      console.error(chalk.red('Error: Not a Git repository.'));
      console.error(chalk.yellow('Please run this command from within a Git repository.'));
      process.exit(1);
    }

    console.log(chalk.cyan('Checking for stale worktrees...'));

    // First, run `git worktree prune` to update Git's internal list of prunable worktrees.
    // This is a safe, non-destructive command that just cleans up metadata.
    await pruneWorktrees();

    // Now, fetch the updated list of worktrees, which will have correct `isPrunable` flags.
    const allWorktrees = await getWorktrees();
    const prunableWorktrees = findPrunableWorktrees(allWorktrees);

    if (prunableWorktrees.length === 0) {
      console.log(chalk.green('✓ No stale worktrees found. Everything is clean!'));
      return;
    }

    let shouldProceed = false;

    if (options.force) {
      // Non-interactive mode (e.g., CI/CD or scripting with --force flag)
      shouldProceed = true;
    } else {
      // Interactive mode: ask the user for confirmation.
      shouldProceed = await confirmCleanup(prunableWorktrees);
    }

    if (!shouldProceed) {
      console.log(chalk.yellow('Cleanup aborted by user.'));
      return;
    }

    console.log(chalk.cyan(`Removing ${prunableWorktrees.length} worktree(s)...`));

    const removalPromises = prunableWorktrees.map(wt =>
      removeWorktree(wt.path, true) // Use force=true to remove, as prunable worktrees can have untracked files.
        .then(() => {
          console.log(`  ${chalk.green('✓ Removed:')} ${chalk.dim(wt.path)}`);
          return { status: 'fulfilled', path: wt.path };
        })
        .catch(error => {
          console.error(`  ${chalk.red('✗ Failed to remove:')} ${chalk.dim(wt.path)}`);
          console.error(`    ${chalk.red(error.message.split('\n')[0])}`); // Show concise error
          return { status: 'rejected', path: wt.path, reason: error };
        })
    );

    const results = await Promise.all(removalPromises);
    const failedRemovals = results.filter(r => r.status === 'rejected');

    console.log(''); // Blank line for separation

    if (failedRemovals.length > 0) {
      console.error(chalk.red(`${failedRemovals.length} worktree(s) could not be removed.`));
      console.error(chalk.yellow('You may need to remove them manually.'));
      process.exit(1);
    } else {
      console.log(chalk.green.bold('✓ Cleanup complete. All stale worktrees have been removed.'));
    }

  } catch (error) {
    console.error(chalk.red('An error occurred during the cleanup process:'));
    console.error(chalk.red(error.message));
    if (error.name !== 'GitError' && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}