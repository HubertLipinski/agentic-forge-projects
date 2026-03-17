import { promisify } from 'node:util';
import { exec as execCallback } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { access } from 'node:fs/promises';

const exec = promisify(execCallback);

/**
 * A custom error class for Git-related operations.
 * This helps in distinguishing Git errors from other runtime errors.
 */
class GitError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Error} [cause] - The original error that caused this one.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'GitError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Executes a shell command and returns its stdout.
 * Throws a GitError if the command fails.
 * @param {string} command - The command to execute.
 * @returns {Promise<string>} A promise that resolves with the command's stdout.
 * @throws {GitError} If the command execution fails.
 */
async function executeGitCommand(command) {
  try {
    const { stdout, stderr } = await exec(command);
    if (stderr && !stderr.startsWith('warning:')) {
      // Some git commands output to stderr for non-error info (e.g., progress).
      // We log it but don't throw unless it's a clear error.
      // A more robust solution might inspect exit codes, but this is a good start.
      console.warn(`Git command stderr: ${stderr.trim()}`);
    }
    return stdout.trim();
  } catch (error) {
    throw new GitError(`Failed to execute: '${command}'.\n${error.stderr || error.message}`, error);
  }
}

/**
 * Checks if the current directory is a Git repository.
 * @returns {Promise<boolean>} A promise that resolves to true if it's a Git repo, false otherwise.
 */
export async function isGitRepository() {
  try {
    // A lightweight way to check is to see if `.git` directory exists.
    // `git rev-parse --is-inside-work-tree` is another option but can be slower.
    const gitDir = resolve(process.cwd(), '.git');
    await access(gitDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches the root directory of the current Git repository.
 * @returns {Promise<string>} A promise that resolves with the absolute path to the repository root.
 * @throws {GitError} If not inside a Git repository.
 */
export async function getGitRoot() {
  const output = await executeGitCommand('git rev-parse --show-toplevel');
  if (!output) {
    throw new GitError('Could not determine the root of the Git repository. Are you in a git repo?');
  }
  return output;
}

/**
 * Fetches all local and remote branches.
 * @returns {Promise<string[]>} A promise that resolves with an array of unique branch names.
 */
export async function getBranches() {
  const output = await executeGitCommand('git branch --all --format="%(refname:short)"');
  if (!output) {
    return [];
  }

  const branches = output
    .split('\n')
    .map(branch => branch.trim())
    .filter(Boolean)
    // Deduplicate and filter out HEAD pointers
    .filter((branch, index, self) =>
      branch && !branch.includes('->') && self.indexOf(branch) === index
    )
    .sort();

  return branches;
}

/**
 * Fetches a list of all worktrees for the current repository.
 * @returns {Promise<Array<{path: string, head: string, branch: string, isMain: boolean}>>} A promise that resolves with an array of worktree objects.
 */
export async function getWorktrees() {
  // Using --porcelain format for stable, script-friendly output.
  const output = await executeGitCommand('git worktree list --porcelain');
  if (!output) {
    return [];
  }

  const worktrees = [];
  const entries = output.split('\n\n').filter(Boolean);

  for (const entry of entries) {
    const lines = entry.split('\n');
    const worktreeData = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        worktreeData.path = line.substring('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        worktreeData.head = line.substring('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        worktreeData.branch = line.substring('branch refs/heads/'.length);
      } else if (line.startsWith('prunable ')) {
        worktreeData.isPrunable = true;
        worktreeData.prunableReason = line.substring('prunable '.length);
      }
    }

    // The main worktree doesn't have a 'branch' line in porcelain output.
    // We identify it by the absence of this line.
    if (!worktreeData.branch) {
      worktreeData.isMain = true;
      // We need to get its branch name separately.
      try {
        const mainBranchOutput = await executeGitCommand('git symbolic-ref --short HEAD');
        worktreeData.branch = mainBranchOutput;
      } catch {
        // This can happen in a detached HEAD state.
        worktreeData.branch = `(detached HEAD at ${worktreeData.head.substring(0, 7)})`;
      }
    } else {
      worktreeData.isMain = false;
    }

    worktrees.push(worktreeData);
  }

  return worktrees;
}

/**
 * Creates a new worktree for a given branch at a specified path.
 * @param {string} path - The path where the new worktree will be created.
 * @param {string} branch - The branch to check out in the new worktree.
 * @returns {Promise<void>} A promise that resolves when the worktree is created.
 * @throws {GitError} If the `git worktree add` command fails.
 */
export async function addWorktree(path, branch) {
  // Using --no-track to prevent creating a tracking branch by default.
  // The user can set it up manually if needed. This keeps the command simple.
  await executeGitCommand(`git worktree add --no-track "${path}" "${branch}"`);
}

/**
 * Removes a worktree at a given path.
 * @param {string} path - The path of the worktree to remove.
 * @param {boolean} [force=false] - Whether to force removal even if the worktree has uncommitted changes.
 * @returns {Promise<void>} A promise that resolves when the worktree is removed.
 * @throws {GitError} If the `git worktree remove` command fails.
 */
export async function removeWorktree(path, force = false) {
  const forceFlag = force ? '--force' : '';
  await executeGitCommand(`git worktree remove ${forceFlag} "${path}"`);
}

/**
 * Prunes worktrees that are no longer valid (e.g., their branch has been deleted).
 * @returns {Promise<string>} A promise that resolves with the output of the prune command.
 */
export async function pruneWorktrees() {
  return await executeGitCommand('git worktree prune');
}