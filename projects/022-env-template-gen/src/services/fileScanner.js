/**
 * @file src/services/fileScanner.js
 * @description Scans the filesystem for files matching specified glob patterns.
 * This service is responsible for finding all relevant source code files
 * that need to be parsed for environment variable usage.
 */

import { glob } from 'glob';
import { DEFAULT_SOURCE_PATTERN, DEFAULT_IGNORE_PATTERNS } from '../utils/constants.js';

/**
 * Finds all file paths that match the given source patterns, while excluding
 * files that match the ignore patterns. It provides a robust way to gather
 * the list of files to be parsed for environment variables.
 *
 * @async
 * @function findFiles
 * @param {object} options - The configuration options for the file scan.
 * @param {string[]} [options.patterns=[DEFAULT_SOURCE_PATTERN]] - An array of glob patterns specifying the files to include.
 * @param {string[]} [options.ignore=[...DEFAULT_IGNORE_PATTERNS]] - An array of glob patterns specifying files/directories to exclude.
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute file paths.
 * @throws {Error} If the glob operation fails for a non-permission-related reason.
 */
export async function findFiles({
  patterns = [DEFAULT_SOURCE_PATTERN],
  ignore = DEFAULT_IGNORE_PATTERNS,
} = {}) {
  // Ensure patterns and ignore are always arrays, providing sensible defaults.
  const sourcePatterns = Array.isArray(patterns) && patterns.length > 0 ? patterns : [DEFAULT_SOURCE_PATTERN];
  const ignorePatterns = Array.isArray(ignore) ? ignore : DEFAULT_IGNORE_PATTERNS;

  try {
    // The `glob` function from the 'glob' package is asynchronous and returns a promise.
    // We use `await` to get the result.
    // `absolute: true` ensures we get full paths, which is more reliable.
    // `nodir: true` ensures we only get files, not directories.
    // `windowsPathsNoEscape: true` is a good practice for cross-platform compatibility.
    const files = await glob(sourcePatterns, {
      ignore: ignorePatterns,
      absolute: true,
      nodir: true,
      windowsPathsNoEscape: true,
    });

    return files;
  } catch (error) {
    // Catch potential errors during the glob operation.
    // This could happen due to invalid patterns or other filesystem issues.
    // We log a specific, helpful error message and re-throw to allow the
    // calling function to handle the application's control flow (e.g., exit).
    console.error(`[Error] Failed to scan for files using glob patterns.`);
    console.error(`  Patterns: ${sourcePatterns.join(', ')}`);
    console.error(`  Ignored: ${ignorePatterns.join(', ')}`);
    throw new Error(`File scanning failed: ${error.message}`);
  }
}