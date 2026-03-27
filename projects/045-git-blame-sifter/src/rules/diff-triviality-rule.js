/**
 * @file src/rules/diff-triviality-rule.js
 * @module rules/diff-triviality-rule
 * @description Implements a rule to identify trivial commits by performing a
 * line-by-line diff between a commit and its parent to check for non-substantive changes.
 */

import { createPatch } from 'diff';
import { executeGitCommand, GitCommandError } from '../utils/git-executor.js';

/**
 * A cache to store the content of a file at a specific commit.
 * Key: `${commitHash}:${filePath}`, Value: file content string.
 * This avoids redundant `git show` calls for the same file version.
 * @type {Map<string, string>}
 */
const fileContentCache = new Map();

/**
 * A cache to store the result of a diff analysis.
 * Key: `${commitHash}:${filePath}`, Value: `{ isTrivial: boolean, reason: string }`.
 * This avoids re-computing the diff for the same commit and file.
 * @type {Map<string, {isTrivial: boolean, reason: string}>}
 */
const diffAnalysisCache = new Map();

/**
 * Fetches the content of a specific file at a given commit hash.
 *
 * @param {string} commitHash - The SHA of the commit.
 * @param {string} filePath - The path to the file within the repository.
 * @param {object} options - Execution options.
 * @param {string} options.repoPath - The file path to the Git repository.
 * @returns {Promise<string>} The content of the file.
 * @throws {GitCommandError} If the file does not exist at that commit or `git show` fails.
 */
async function getFileContentAtCommit(commitHash, filePath, { repoPath }) {
  const cacheKey = `${commitHash}:${filePath}`;
  if (fileContentCache.has(cacheKey)) {
    return fileContentCache.get(cacheKey);
  }

  try {
    // `git show HASH:path/to/file` is the command to get file content at a specific revision.
    const { stdout } = await executeGitCommand(
      ['show', `${commitHash}:${filePath}`],
      { cwd: repoPath }
    );
    fileContentCache.set(cacheKey, stdout);
    return stdout;
  } catch (error) {
    if (error instanceof GitCommandError) {
      // A common failure is when a file was created in this commit, so it doesn't exist in the parent.
      // The error message from git is usually "fatal: Path '...' does not exist in '...'".
      // We'll let the caller handle this specific case.
      throw error;
    }
    // For other errors (e.g., git not found), wrap and re-throw.
    throw new Error(`Failed to retrieve content for ${filePath} at commit ${commitHash}.`, { cause: error });
  }
}

/**
 * Analyzes a diff hunk to determine if it contains only whitespace or blank line changes.
 *
 * @param {import('diff').Hunk} hunk - A diff hunk object from the `diff` package.
 * @returns {boolean} `true` if the hunk contains only trivial changes, `false` otherwise.
 */
function isHunkTrivial(hunk) {
  for (const line of hunk.lines) {
    const changeType = line.charAt(0);
    const lineContent = line.substring(1).trim();

    if (changeType === '+' || changeType === '-') {
      // If the trimmed line content is not empty, it's a substantive change.
      if (lineContent !== '') {
        return false;
      }
    }
    // Lines starting with ' ' (context lines) are ignored.
  }
  // If we looped through all added/removed lines and they were all empty after trimming, the hunk is trivial.
  return true;
}

/**
 * The diff triviality rule function.
 * It checks if a commit's changes to a specific file are purely cosmetic (whitespace/blank lines).
 *
 * @async
 * @function diffTrivialityRule
 * @param {object} commit - The commit object from the blame parser.
 * @param {string} commit.hash - The commit's SHA hash.
 * @param {string} commit['previous-hash'] - The parent commit's SHA hash.
 * @param {string} commit['filename'] - The filename being blamed.
 * @param {object} context - The context object containing configuration and other data.
 * @param {object} context.config - The application's merged configuration.
 * @param {boolean} context.config.isTrivial - A flag to enable/disable this rule.
 * @param {string} context.repoPath - The absolute path to the repository being analyzed.
 * @returns {Promise<{isTrivial: boolean, reason: string|null}>} An object indicating if the commit is trivial and why.
 */
async function diffTrivialityRule(commit, context) {
  const { config, repoPath } = context;

  // If the rule is disabled in the config, do nothing.
  if (config?.isTrivial !== true) {
    return { isTrivial: false, reason: null };
  }

  // Defensive checks for required inputs from the blame parser.
  const { hash, 'previous-hash': parentHash, filename } = commit;
  if (!hash || !parentHash || !filename) {
    console.warn(`[DiffTrivialityRule] Commit is missing hash, parent hash, or filename. Cannot apply rule.`);
    return { isTrivial: false, reason: 'Incomplete commit data for diff analysis.' };
  }

  const cacheKey = `${hash}:${filename}`;
  if (diffAnalysisCache.has(cacheKey)) {
    return diffAnalysisCache.get(cacheKey);
  }

  try {
    // Fetch content for the file in the current commit and its parent.
    const [currentContent, parentContent] = await Promise.all([
      getFileContentAtCommit(hash, filename, { repoPath }),
      getFileContentAtCommit(parentHash, filename, { repoPath }).catch(err => {
        // If the file didn't exist in the parent, it's a file creation, which is never trivial.
        if (err instanceof GitCommandError && err.stderr.includes('does not exist in')) {
          return null;
        }
        // Re-throw other errors.
        throw err;
      }),
    ]);

    if (parentContent === null) {
      const result = { isTrivial: false, reason: 'File was created in this commit.' };
      diffAnalysisCache.set(cacheKey, result);
      return result;
    }

    // Generate a patch. We only need the hunks to analyze changes.
    const patch = createPatch(filename, parentContent, currentContent, '', '', { context: 0 });
    const hunks = patch.split('\n').slice(4); // Remove header lines
    
    // If there are no hunks, the files are identical (e.g., only metadata change). This is trivial.
    if (hunks.every(line => line.trim() === '' || line.startsWith('\\ No newline'))) {
      const result = { isTrivial: true, reason: 'No effective code changes detected in diff.' };
      diffAnalysisCache.set(cacheKey, result);
      return result;
    }

    // Use the `diff` package to parse the patch into structured hunks.
    const { parsePatch } = await import('diff');
    const [parsedDiff] = parsePatch(patch);

    if (!parsedDiff || !parsedDiff.hunks || parsedDiff.hunks.length === 0) {
      const result = { isTrivial: true, reason: 'No effective code changes detected in diff.' };
      diffAnalysisCache.set(cacheKey, result);
      return result;
    }

    // Check if all hunks in the diff are trivial.
    const allHunksAreTrivial = parsedDiff.hunks.every(isHunkTrivial);

    if (allHunksAreTrivial) {
      const result = { isTrivial: true, reason: 'Changes consist only of whitespace or blank lines.' };
      diffAnalysisCache.set(cacheKey, result);
      return result;
    }

    const result = { isTrivial: false, reason: null };
    diffAnalysisCache.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error(`[DiffTrivialityRule] Error processing commit ${hash} for file ${filename}: ${error.message}`);
    // Fail-safe: if the rule encounters an error, assume the change is not trivial.
    const result = { isTrivial: false, reason: `Rule failed to execute: ${error.message}` };
    diffAnalysisCache.set(cacheKey, result);
    return result;
  }
}

export { diffTrivialityRule };