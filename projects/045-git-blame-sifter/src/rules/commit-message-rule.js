/**
 * @file src/rules/commit-message-rule.js
 * @module rules/commit-message-rule
 * @description Implements a rule to identify trivial commits by matching their
 * summary line against a configurable regular expression pattern.
 */

import { fileURLToPath } from 'node:url';
import { executeGitCommand } from '../utils/git-executor.js';

/**
 * A cache to store commit message summaries.
 * The key is the commit hash (SHA), and the value is the summary string.
 * This avoids redundant `git show` calls for the same commit within a single run.
 * @type {Map<string, string>}
 */
const commitMessageCache = new Map();

/**
 * Fetches the summary (first line) of a commit message for a given commit hash.
 * It uses a local cache to avoid repeated Git calls for the same commit.
 *
 * @param {string} commitHash - The full SHA of the commit.
 * @param {object} options - Execution options.
 * @param {string} options.repoPath - The file path to the Git repository.
 * @returns {Promise<string>} The first line of the commit message.
 * @throws {Error} If the Git command fails or the commit has no message.
 */
async function getCommitSummary(commitHash, { repoPath }) {
  if (commitMessageCache.has(commitHash)) {
    return commitMessageCache.get(commitHash);
  }

  try {
    // Use `git show` with `--no-patch` and `--format=%s` to get only the subject line.
    // This is highly efficient.
    const { stdout } = await executeGitCommand(
      ['show', '--no-patch', '--format=%s', commitHash],
      { cwd: repoPath }
    );

    const summary = stdout.trim();
    if (summary === '') {
      // This is an edge case, but a commit could have an empty subject.
      // We still cache it to prevent re-fetching.
      commitMessageCache.set(commitHash, '');
      return '';
    }

    commitMessageCache.set(commitHash, summary);
    return summary;
  } catch (error) {
    // The git-executor already provides a detailed error. We add context.
    console.error(`Failed to retrieve commit summary for ${commitHash}: ${error.message}`);
    // Re-throw to allow the rule engine to handle the failure.
    throw new Error(`Could not get commit summary for ${commitHash}.`, { cause: error });
  }
}

/**
 * Creates a regular expression object from a string pattern.
 * This function handles potential syntax errors in user-provided patterns.
 *
 * @param {string} pattern - The regular expression pattern string.
 * @returns {RegExp} A compiled regular expression object.
 * @throws {Error} If the pattern is invalid.
 */
function createRegex(pattern) {
  try {
    // We add the 'i' flag for case-insensitive matching by default, which is
    // a sensible default for commit messages (e.g., 'Chore:' vs 'chore:').
    return new RegExp(pattern, 'i');
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid regular expression provided for commit message rule: "${pattern}". Details: ${e.message}`);
    }
    throw e; // Re-throw other unexpected errors
  }
}

/**
 * The commit message rule function.
 * It checks if a commit's summary line matches a configured regex pattern.
 *
 * @async
 * @function commitMessageRule
 * @param {object} commit - The commit object from the blame parser.
 * @param {string} commit.hash - The commit's SHA hash.
 * @param {object} context - The context object containing configuration and other data.
 * @param {object} context.config - The application's merged configuration.
 * @param {string} context.config.commitMessage - The regex pattern to match against the commit summary.
 * @param {string} context.repoPath - The absolute path to the repository being analyzed.
 * @returns {Promise<{isTrivial: boolean, reason: string|null}>} An object indicating if the commit is trivial and why.
 */
async function commitMessageRule(commit, context) {
  const { config, repoPath } = context;
  const pattern = config?.commitMessage;

  // If the rule is not configured, it cannot determine triviality.
  if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') {
    return { isTrivial: false, reason: null };
  }

  // Defensive check for required inputs
  if (!commit?.hash) {
    throw new Error('Commit object with a hash property is required for the commit message rule.');
  }
  if (!repoPath) {
    throw new Error('Repository path is required for the commit message rule.');
  }

  try {
    const summary = await getCommitSummary(commit.hash, { repoPath });
    const regex = createRegex(pattern);

    if (regex.test(summary)) {
      return {
        isTrivial: true,
        reason: `Commit message matches pattern: /${pattern}/i`,
      };
    }

    return { isTrivial: false, reason: null };
  } catch (error) {
    // Log the error but don't fail the entire process. Treat as non-trivial.
    // The error from getCommitSummary or createRegex is already descriptive.
    console.error(`[CommitMessageRule] Error processing commit ${commit.hash}: ${error.message}`);
    return {
      isTrivial: false,
      reason: `Rule failed to execute: ${error.message}`,
    };
  }
}

export { commitMessageRule };