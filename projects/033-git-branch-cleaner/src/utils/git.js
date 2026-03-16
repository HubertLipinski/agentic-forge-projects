import shell from 'shelljs';
import { EOL } from 'node:os';

/**
 * @typedef {object} GitBranchInfo
 * @property {string} name - The name of the branch.
 * @property {string} lastCommitDate - The ISO 8601 date string of the last commit.
 * @property {string} lastCommitHash - The hash of the last commit.
 * @property {boolean} isMerged - Whether the branch has been merged into the current branch.
 * @property {boolean} isCurrent - Whether this is the currently checked-out branch.
 */

/**
 * Executes a shell command and returns its output. Throws an error if the command fails.
 * @param {string} command - The command to execute.
 * @param {object} [options={}] - Options for shelljs.exec.
 * @returns {string} The stdout from the command.
 * @throws {Error} If the command exits with a non-zero status code.
 */
function executeGitCommand(command, options = {}) {
  const result = shell.exec(command, { silent: true, ...options });

  if (result.code !== 0) {
    const errorMessage = result.stderr.trim() || `Git command failed with exit code ${result.code}`;
    throw new Error(`Failed to execute: '${command}'.\nError: ${errorMessage}`);
  }

  return result.stdout.trim();
}

/**
 * Checks if the current directory is a Git repository.
 * @throws {Error} If not a Git repository.
 */
export function checkIsRepo() {
  try {
    // A lightweight command to check for a valid git repository.
    // 'git rev-parse --is-inside-work-tree' is a standard way to do this.
    executeGitCommand('git rev-parse --is-inside-work-tree');
  } catch (error) {
    throw new Error('Not a git repository. Please run this command from the root of a git repository.');
  }
}

/**
 * Fetches the name of the current Git branch.
 * @returns {string} The current branch name.
 */
export function getCurrentBranchName() {
  return executeGitCommand('git rev-parse --abbrev-ref HEAD');
}

/**
 * Fetches a list of all local branches that have been merged into the current HEAD.
 * @returns {Set<string>} A set of merged branch names.
 */
function getMergedBranches() {
  const output = executeGitCommand('git branch --merged');
  const branches = output
    .split(EOL)
    .map(branch => branch.trim().replace(/^\* /, '')) // Remove leading '*' and trim whitespace
    .filter(Boolean); // Filter out any empty lines

  return new Set(branches);
}

/**
 * Fetches detailed information for all local branches.
 *
 * It retrieves the branch name, last commit date, last commit hash, and merged status.
 *
 * @returns {Promise<GitBranchInfo[]>} A promise that resolves to an array of branch information objects.
 */
export async function getLocalBranches() {
  // Using a custom format with a unique separator to safely parse the output.
  const GIT_LOG_FORMAT = '%(refname:short)__SEP__%(committerdate:iso8601)__SEP__%(objectname)';
  const command = `git for-each-ref --format='${GIT_LOG_FORMAT}' refs/heads/`;

  const output = executeGitCommand(command);
  if (!output) {
    return []; // No local branches found
  }

  const mergedBranches = getMergedBranches();
  const currentBranch = getCurrentBranchName();

  const branchLines = output.split(EOL);

  const branches = branchLines.map(line => {
    const [name, lastCommitDate, lastCommitHash] = line.split('__SEP__');

    if (!name || !lastCommitDate || !lastCommitHash) {
      // This can happen with an unexpected git output format.
      // We'll log a warning but continue processing other branches.
      console.warn(`Warning: Could not parse branch information for line: "${line}"`);
      return null;
    }

    return {
      name,
      lastCommitDate,
      lastCommitHash,
      isMerged: mergedBranches.has(name),
      isCurrent: name === currentBranch,
    };
  });

  // Filter out any null entries from parsing errors
  return branches.filter(Boolean);
}

/**
 * Deletes a local Git branch.
 * @param {string} branchName - The name of the branch to delete.
 * @param {boolean} [force=false] - If true, uses force-delete (-D), otherwise uses safe-delete (-d).
 * @returns {{success: boolean, message: string}} An object indicating the result of the deletion.
 */
export function deleteBranch(branchName, force = false) {
  if (!branchName || typeof branchName !== 'string') {
    return { success: false, message: 'Invalid branch name provided.' };
  }

  const deleteFlag = force ? '-D' : '-d';
  const command = `git branch ${deleteFlag} ${shell.ShellString(branchName).toString()}`;

  try {
    const output = executeGitCommand(command);
    return { success: true, message: output };
  } catch (error) {
    // The error from executeGitCommand already contains a descriptive message from git stderr.
    return { success: false, message: error.message };
  }
}