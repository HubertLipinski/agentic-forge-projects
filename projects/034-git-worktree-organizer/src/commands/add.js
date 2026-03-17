import { resolve, join } from 'node:path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  getBranches,
  getWorktrees,
  getGitRoot,
  addWorktree,
  isGitRepository,
} from '../utils/git.js';
import { loadConfig } from '../config.js';

/**
 * Sanitizes a branch name to create a valid directory name.
 * Replaces slashes and other problematic characters with hyphens.
 * Example: 'feature/new-login' -> 'feature-new-login'
 *
 * @param {string} branchName - The name of the branch.
 * @returns {string} A sanitized string suitable for a directory name.
 */
function sanitizeBranchForPath(branchName) {
  // Replace slashes and other non-alphanumeric characters (except hyphens) with a hyphen.
  // Also handles multiple special characters in a row.
  return branchName.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
}

/**
 * Filters out branches that already have a corresponding worktree.
 *
 * @param {string[]} allBranches - An array of all available branch names.
 * @param {Array<{branch: string}>} existingWorktrees - An array of worktree objects.
 * @returns {string[]} An array of branch names that do not have a worktree.
 */
function getAvailableBranches(allBranches, existingWorktrees) {
  const worktreeBranches = new Set(existingWorktrees.map(wt => wt.branch));
  return allBranches.filter(branch => !worktreeBranches.has(branch));
}

/**
 * Interactively prompts the user to select a branch from a list of available branches.
 *
 * @param {string[]} availableBranches - The list of branches to choose from.
 * @returns {Promise<string>} A promise that resolves with the selected branch name.
 */
async function promptForBranch(availableBranches) {
  const { selectedBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBranch',
      message: 'Select a branch to create a worktree for:',
      choices: availableBranches,
      pageSize: 15, // Show more branches at once
      loop: false, // Don't loop around the list
    },
  ]);
  return selectedBranch;
}

/**
 * Implements the 'add' command logic.
 *
 * This function orchestrates the process of creating a new worktree. It can run in
 * interactive mode (prompting the user) or non-interactive mode (using a provided branch name).
 *
 * @param {string|undefined} branch - The name of the branch to create a worktree from. If undefined, prompts the user.
 * @param {object} options - Command-line options (currently unused but reserved for future use).
 */
export async function addCommand(branch, options) {
  try {
    if (!(await isGitRepository())) {
      console.error(chalk.red('Error: Not a Git repository.'));
      console.error(chalk.yellow('Please run this command from within a Git repository.'));
      process.exit(1);
    }

    const [allBranches, existingWorktrees, gitRoot, config] = await Promise.all([
      getBranches(),
      getWorktrees(),
      getGitRoot(),
      loadConfig(),
    ]);

    const availableBranches = getAvailableBranches(allBranches, existingWorktrees);

    if (availableBranches.length === 0) {
      console.log(chalk.yellow('All branches already have a worktree. Nothing to add.'));
      return;
    }

    let selectedBranch;

    if (branch) {
      // Non-interactive mode
      selectedBranch = branch;
      const fullBranchName = allBranches.find(b => b.endsWith(`/${branch}`) || b === branch);

      if (!fullBranchName) {
        console.error(chalk.red(`Error: Branch '${branch}' not found.`));
        process.exit(1);
      }
      if (!availableBranches.includes(fullBranchName)) {
        console.error(chalk.red(`Error: A worktree already exists for branch '${fullBranchName}'.`));
        process.exit(1);
      }
      selectedBranch = fullBranchName; // Use the full branch name (e.g., 'origin/main')
    } else {
      // Interactive mode
      selectedBranch = await promptForBranch(availableBranches);
    }

    const worktreeDirName = sanitizeBranchForPath(selectedBranch);
    const worktreeParentDir = resolve(gitRoot, config.worktreeDir);
    const worktreePath = join(worktreeParentDir, worktreeDirName);

    console.log(chalk.cyan(`Creating worktree for branch '${selectedBranch}'...`));

    await addWorktree(worktreePath, selectedBranch);

    console.log(chalk.green('✓ Worktree created successfully!'));
    console.log(`  Branch: ${chalk.bold(selectedBranch)}`);
    console.log(`  Path:   ${chalk.bold(worktreePath)}`);
    console.log(chalk.dim(`\nTo switch to the new worktree, run: cd ${worktreePath}`));

  } catch (error) {
    console.error(chalk.red('An error occurred while adding the worktree:'));
    console.error(chalk.red(error.message));
    // For GitError, the underlying stderr is already part of the message.
    // For other errors, log the stack for debugging if available.
    if (error.name !== 'GitError' && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}