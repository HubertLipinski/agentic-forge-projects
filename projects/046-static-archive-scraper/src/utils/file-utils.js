/**
 * @file src/utils/file-utils.js
 * @description File system utilities for saving content and creating directories.
 *
 * This module provides robust, asynchronous functions for interacting with the
 * local file system, which are essential for archiving the scraped website.
 * It handles creating nested directory structures and writing file content
 * with proper error handling.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Asynchronously saves content to a specified file path.
 *
 * This function ensures that the directory for the file exists before attempting
 * to write the file. If the directory structure does not exist, it will be
 * created recursively. This is a critical utility for mirroring the website's
 * directory structure on the local file system.
 *
 * The content can be a string (for text files like HTML, CSS, JS) or a Buffer
 * (for binary files like images, fonts).
 *
 * @param {string} filePath - The absolute path where the file should be saved.
 * @param {string | Buffer} content - The content to write to the file.
 * @returns {Promise<void>} A promise that resolves when the file has been successfully saved.
 * @throws {Error} Throws an error if directory creation or file writing fails for reasons
 *                 other than the directory already existing.
 */
export async function saveFile(filePath, content) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid argument: "filePath" must be a non-empty string.');
  }
  if (content === undefined || content === null) {
    throw new Error('Invalid argument: "content" cannot be null or undefined.');
  }

  try {
    // Ensure the directory for the file exists.
    // The `recursive: true` option makes this function idempotent; it won't
    // throw an error if the directory already exists.
    const directoryPath = path.dirname(filePath);
    await fs.mkdir(directoryPath, { recursive: true });

    // Write the file to the now-guaranteed directory.
    // This will overwrite the file if it already exists, which is the
    // desired behavior in case a resource is fetched more than once.
    await fs.writeFile(filePath, content);
  } catch (error) {
    // Provide a more informative error message by wrapping the original error.
    const errorMessage = `Failed to save file at "${filePath}". Reason: ${error.message}`;
    console.error(`[FileUtils] ${errorMessage}`);
    // Re-throw a new error to allow upstream callers to handle the failure.
    throw new Error(errorMessage, { cause: error });
  }
}

/**
 * Creates a directory structure recursively.
 *
 * This is a convenience wrapper around `fs.mkdir` with the `recursive: true`
 * option enabled by default. It's useful for ensuring a base output directory
 * exists before starting the crawl.
 *
 * @param {string} directoryPath - The path of the directory to create.
 * @returns {Promise<void>} A promise that resolves when the directory is created or if it already exists.
 * @throws {Error} Throws an error if the directory creation fails.
 */
export async function ensureDirectoryExists(directoryPath) {
  if (!directoryPath || typeof directoryPath !== 'string') {
    throw new Error('Invalid argument: "directoryPath" must be a non-empty string.');
  }

  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    const errorMessage = `Failed to create directory at "${directoryPath}". Reason: ${error.message}`;
    console.error(`[FileUtils] ${errorMessage}`);
    throw new Error(errorMessage, { cause: error });
  }
}