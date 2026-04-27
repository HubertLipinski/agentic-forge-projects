/**
 * @file src/utils/file-reader.js
 * @description Utilities for finding and reading files from the filesystem.
 * This module provides functions to resolve file paths using glob patterns
 * and to read file contents asynchronously, with robust error handling.
 */

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { glob } from 'glob';

/**
 * A custom error class for file-related operations to provide more context.
 */
class FileError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Additional options.
   * @param {string} [options.path] The file path that caused the error.
   * @param {Error} [options.cause] The original error that was caught.
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'FileError';
    if (options.path) {
      this.path = options.path;
    }
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Asynchronously reads the content of a single file.
 *
 * @param {string} filePath - The absolute or relative path to the file.
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {FileError} If the file cannot be read (e.g., it doesn't exist, or permissions are denied).
 */
export async function readFileContent(filePath) {
  const absolutePath = resolve(filePath);
  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new FileError(`File not found at path: ${absolutePath}`, {
        path: absolutePath,
        cause: error,
      });
    }
    if (error.code === 'EACCES') {
      throw new FileError(`Permission denied for file: ${absolutePath}`, {
        path: absolutePath,
        cause: error,
      });
    }
    // For other unexpected I/O errors
    throw new FileError(`Failed to read file: ${absolutePath}`, {
      path: absolutePath,
      cause: error,
    });
  }
}

/**
 * Finds all file paths matching an array of glob patterns.
 * It ensures that all returned paths are unique and absolute.
 *
 * @param {string[]} patterns - An array of glob patterns to match against.
 * @param {object} [options={}] - Optional configuration.
 * @param {string} [options.cwd=process.cwd()] - The current working directory in which to search.
 * @param {string[]} [options.ignore=[]] - An array of glob patterns to ignore.
 * @returns {Promise<string[]>} A promise that resolves with an array of unique, absolute file paths.
 * @throws {Error} If the glob operation fails for an unexpected reason.
 */
export async function findFilesByGlob(patterns, options = {}) {
  const { cwd = process.cwd(), ignore = [] } = options;

  if (!Array.isArray(patterns) || patterns.length === 0) {
    return [];
  }

  try {
    // The `glob` function with `absolute: true` handles path resolution correctly.
    const filePaths = await glob(patterns, {
      cwd,
      ignore,
      nodir: true, // We only want files, not directories
      absolute: true, // Return absolute paths for consistency
      dot: true, // Include dotfiles in matches
    });

    // `glob` can return the same path if multiple patterns match it.
    // A Set ensures we only return unique paths.
    return [...new Set(filePaths)];
  } catch (error) {
    // This would be an unexpected error from the glob library itself.
    throw new Error(`An error occurred during file search: ${error.message}`, {
      cause: error,
    });
  }
}