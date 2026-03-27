/**
 * @file src/analysis/history-walker.js
 * @module analysis/history-walker
 * @description For a line blamed on a trivial commit, this module walks back
 * through the git history to find the previous substantive author.
 */

import { executeGitCommand, GitCommandError } from '../utils/git-executor.js';
import { runRuleEngine } from '../engine/rule-engine.js';
import { parsePorcelainBlame } from './blame-parser.js';

/**
 * A cache to store the results of history walks.
 * This is crucial for performance, as walking history for the same line/commit
 * combination multiple times is computationally expensive.
 *
 * Key: `${commitHash}:${filePath}:${lineNumber}`
 * Value: The substantive commit object found by walking back.
 *
 * @type {Map<string, object>}
 */
const historyWalkCache = new Map();

/**
 * Finds the substantive author and commit for a specific line of a file,
 * starting from a commit that has been identified as trivial. It recursively

 * walks backwards through the commit history for that line until it finds a
 * non-trivial commit or reaches the beginning of the file's history.
 *
 * This function is the core of the "sifting" process. It uses `git blame`
 * with the `--reverse` option to trace a line's origin backwards from a
 * specific commit.
 *
 * @async
 * @function findSubstantiveBlame
 * @param {object} initialCommit - The commit object (from the blame parser) that was deemed trivial.
 * @param {string} initialCommit.hash - The SHA of the trivial commit.
 * @param {number} originalLine - The line number in the file as it existed in the `initialCommit`.
 * @param {string} filePath - The path to the file being analyzed.
 * @param {object} context - The shared context object for the analysis.
 * @param {string} context.repoPath - The absolute path to the Git repository.
 * @param {object} context.config - The application's merged configuration.
 * @returns {Promise<object>} A promise that resolves to the substantive commit object.
 *   This object is the same format as the `BlameCommit` from the parser.
 *   If the history walk fails or reaches the end, it returns the `initialCommit`.
 */
export async function findSubstantiveBlame(initialCommit, originalLine, filePath, context) {
  const { repoPath, config } = context;
  const cacheKey = `${initialCommit.hash}:${filePath}:${originalLine}`;

  if (historyWalkCache.has(cacheKey)) {
    return historyWalkCache.get(cacheKey);
  }

  // Defensive checks for required parameters.
  if (!initialCommit?.hash || typeof originalLine !== 'number' || !filePath || !repoPath) {
    console.warn('[HistoryWalker] Invalid arguments for findSubstantiveBlame. Returning initial commit.');
    return initialCommit;
  }

  let currentCommit = initialCommit;
  let currentLine = originalLine;
  let depth = 0;
  const maxDepth = 20; // Safety valve to prevent infinite loops in weird git histories.

  try {
    while (depth < maxDepth) {
      // Find the parent commit for the current line.
      // `git blame --reverse` traces a line's history backwards.
      // `START..END` tells blame to look at the history *before* the `START` commit.
      // `-L n,n` specifies the exact line we are interested in within that commit's version of the file.
      const blameArgs = [
        'blame',
        '--porcelain',
        '--reverse',
        `${currentCommit.hash}^..${currentCommit.hash}`, // Look at the change introduced by this commit
        '-L', `${currentLine},${currentLine}`,
        '--',
        filePath,
      ];

      const { stdout } = await executeGitCommand(blameArgs, { cwd: repoPath });

      // If `git blame --reverse` returns empty output, it means we've reached the creation
      // of this line. The `currentCommit` is the substantive one.
      if (!stdout.trim()) {
        historyWalkCache.set(cacheKey, currentCommit);
        return currentCommit;
      }

      const { commits, lines } = parsePorcelainBlame(stdout);

      // There should be exactly one line of output for our query.
      if (lines.length === 0 || commits.size === 0) {
        console.warn(`[HistoryWalker] Unexpected empty blame result for ${filePath}:${currentLine} at ${currentCommit.hash}.`);
        historyWalkCache.set(cacheKey, currentCommit);
        return currentCommit;
      }

      const previousCommit = lines[0].commit;

      // Now, run the rule engine on this previous commit to see if it's trivial.
      const ruleResult = await runRuleEngine(previousCommit, context);

      if (!ruleResult.isTrivial) {
        // We found a substantive commit! This is the one we're looking for.
        historyWalkCache.set(cacheKey, previousCommit);
        return previousCommit;
      }

      // The previous commit was also trivial. We need to continue walking back.
      // Update our state for the next iteration of the loop.
      currentCommit = previousCommit;
      currentLine = lines[0].originalLine; // The line number in the parent commit's version.
      depth++;
    }

    if (depth >= maxDepth) {
      console.warn(`[HistoryWalker] Reached max recursion depth (${maxDepth}) for ${filePath}:${originalLine}. Aborting walk and returning last found trivial commit.`);
    }
  } catch (error) {
    if (error instanceof GitCommandError) {
      // Common errors: line doesn't exist, commit hash is invalid.
      // In these cases, we can't walk further, so the best we can do is return the last known commit.
      console.warn(`[HistoryWalker] Git error during history walk for ${filePath}:${originalLine} at ${initialCommit.hash}. Returning last known commit. Error: ${error.stderr}`);
    } else {
      // Unexpected error.
      console.error(`[HistoryWalker] Unexpected error during history walk for ${filePath}:${originalLine}.`, error);
    }
    // On any failure, we conservatively return the commit we started this iteration with.
    historyWalkCache.set(cacheKey, currentCommit);
    return currentCommit;
  }

  // If the loop finishes (e.g., max depth reached), return the last commit we processed.
  historyWalkCache.set(cacheKey, currentCommit);
  return currentCommit;
}

/**
 * Clears the internal cache for history walk results.
 * Useful for testing or long-running processes to manage memory.
 */
export function clearHistoryWalkerCache() {
  historyWalkCache.clear();
}