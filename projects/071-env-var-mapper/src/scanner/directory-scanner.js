/**
 * @file src/scanner/directory-scanner.js
 * @description Scans directories to find relevant JavaScript files for parsing.
 * This module uses `fast-glob` to efficiently search for files based on
 * supported extensions and user-defined ignore patterns, providing a list
 * of file paths to be processed by the parser.
 */

import fg from 'fast-glob';
import path from 'node:path';
import { SUPPORTED_FILE_EXTENSIONS } from '../utils/constants.js';

/**
 * Generates a glob pattern for matching supported file types within a directory.
 *
 * It creates a pattern like `directory/**/*.{js,mjs}` which `fast-glob` uses
 * to recursively find all files with the specified extensions.
 *
 * @param {string} directory - The base directory to scan.
 * @returns {string} A glob pattern string.
 */
const createGlobPattern = (directory) => {
  // Normalize the directory path to handle different OS separators (e.g., `\` vs `/`).
  const normalizedDirectory = path.normalize(directory);
  // Create a pattern part for extensions, e.g., '{js,mjs}'
  const extensionsPattern = `{${SUPPORTED_FILE_EXTENSIONS.join(',')}}`;
  // Combine into a full recursive glob pattern.
  return path.join(normalizedDirectory, '**', `*.${extensionsPattern}`).replace(/\\/g, '/');
};

/**
 * Scans a directory for JavaScript files (`.js`, `.mjs`) to be analyzed.
 *
 * It recursively searches the given directory path for files matching the
 * supported extensions. It respects a default set of ignored directories
 * (`node_modules`) and allows for additional user-provided ignore patterns.
 *
 * @param {string} directory - The path to the directory to scan.
 * @param {string[]} [ignorePatterns=[]] - An array of glob patterns to ignore during the scan.
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute file paths.
 *   Returns an empty array if no matching files are found.
 * @throws {Error} Throws if the directory path is invalid or if `fast-glob` encounters an error.
 */
export const findJavaScriptFiles = async (directory, ignorePatterns = []) => {
  if (!directory || typeof directory !== 'string') {
    throw new Error('Invalid directory provided. Expected a non-empty string.');
  }

  const globPattern = createGlobPattern(directory);

  // Default ignore patterns to avoid scanning dependency folders and other common noise.
  const defaultIgnores = ['**/node_modules/**'];

  // Combine default and user-provided ignore patterns, ensuring no duplicates.
  const combinedIgnore = [...new Set([...defaultIgnores, ...ignorePatterns])];

  try {
    // `fast-glob` options:
    // - `absolute: true`: Ensures all returned paths are absolute, which is crucial for
    //   consistent file reading and reporting, regardless of where the CLI is run from.
    // - `onlyFiles: true`: We are only interested in files, not directories.
    // - `dot: false`: Ignore files/directories starting with a dot (e.g., `.git`, `.vscode`).
    const filePaths = await fg(globPattern, {
      ignore: combinedIgnore,
      absolute: true,
      onlyFiles: true,
      dot: false,
    });

    return filePaths;
  } catch (error) {
    // Catch potential errors from fast-glob (e.g., malformed patterns, though unlikely here)
    // and provide a more user-friendly error message.
    const contextualError = new Error(`Failed to scan directory "${directory}": ${error.message}`);
    contextualError.cause = error; // Preserve original error for debugging.
    throw contextualError;
  }
};