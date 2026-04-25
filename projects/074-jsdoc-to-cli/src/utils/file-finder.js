/**
 * @fileoverview Utility for finding files based on glob patterns.
 *
 * This module abstracts the file-finding logic using the `glob` library.
 * It provides a robust, asynchronous function to resolve an array of glob
 * patterns into a flat list of absolute file paths, with proper error handling
 * and support for ignoring common directories like `node_modules`.
 *
 * @module src/utils/file-finder
 */

import { glob } from 'glob';
import path from 'node:path';

/**
 * A set of default glob patterns to ignore during file discovery.
 * This prevents accidental inclusion of files from dependency directories,
 * build outputs, or version control systems, which are generally not
 * intended to be part of the CLI.
 *
 * @type {Readonly<string[]>}
 */
const DEFAULT_IGNORE_PATTERNS = Object.freeze([
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
]);

/**
 * Finds all files matching the given glob patterns.
 *
 * This function asynchronously searches the filesystem for files that match the
 * provided patterns. It automatically ignores common directories like `node_modules`
 * and resolves all found paths to absolute paths to ensure consistency.
 *
 * @param {string[]} patterns - An array of glob patterns to search for (e.g., ['src/**\/*.js', 'lib/utils.js']).
 * @param {object} [options={}] - Optional configuration.
 * @param {string} [options.cwd=process.cwd()] - The current working directory in which to search. Defaults to the process's CWD.
 * @param {string[]} [options.ignore] - An array of additional glob patterns to ignore. These are combined with the default ignore patterns.
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute file paths matching the patterns.
 * @throws {Error} If the `patterns` argument is not a non-empty array of strings.
 * @throws {Error} If the glob search operation fails for any reason (e.g., permissions).
 */
export async function findFiles(patterns, { cwd = process.cwd(), ignore = [] } = {}) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new Error('The "patterns" argument must be a non-empty array of glob pattern strings.');
  }

  const allIgnorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...ignore];

  try {
    // The `glob` function from the 'glob' package returns absolute paths by default
    // when `absolute: true` is set. This is crucial for `jsdoc-api` to correctly
    // locate and parse the files regardless of where the CLI tool is executed.
    const files = await glob(patterns, {
      cwd,
      ignore: allIgnorePatterns,
      absolute: true,
      nodir: true, // Ensure we only get files, not directories
    });

    // The `glob` library with `absolute: true` already returns absolute paths.
    // However, as a defensive measure and for explicit clarity, we can ensure
    // each path is resolved. This also helps normalize path separators (e.g., `\` vs `/`).
    return files.map(file => path.resolve(file));
  } catch (error) {
    // Catch potential errors from the glob library, such as syntax errors in patterns
    // or file system access issues, and wrap them in a more informative error message.
    console.error(`[Error] Failed to find files for patterns: ${patterns.join(', ')}`);
    throw new Error(`File search failed: ${error.message}`);
  }
}