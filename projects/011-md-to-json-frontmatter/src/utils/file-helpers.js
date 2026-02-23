/**
 * @file src/utils/file-helpers.js
 * @description File system utility functions for reading files and finding markdown files.
 * This module provides asynchronous helpers to interact with the file system,
 * specifically tailored for reading file content and discovering markdown files
 * within directories. It leverages modern Node.js APIs and robust error handling.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Asynchronously reads the content of a file.
 *
 * @async
 * @param {string} filePath - The absolute or relative path to the file.
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {Error} Throws an error if the file cannot be read (e.g., it doesn't exist,
 *                 or the process lacks permissions). The error message will be prefixed
 *                 for better context.
 */
export async function readFileContent(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid argument: `filePath` must be a non-empty string.');
  }

  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    // Provide a more user-friendly error message while preserving the original error info.
    const newError = new Error(`Failed to read file at '${filePath}': ${error.message}`);
    newError.cause = error; // Preserve original error for deeper debugging if needed
    newError.code = error.code; // Propagate system error codes like 'ENOENT'
    throw newError;
  }
}

/**
 * Asynchronously writes data to a file, creating parent directories if they don't exist.
 *
 * @async
 * @param {string} filePath - The path to the file where data will be written.
 * @param {string} content - The string content to write to the file.
 * @returns {Promise<void>} A promise that resolves when the file has been successfully written.
 * @throws {Error} Throws an error if the directory cannot be created or the file cannot be written.
 */
export async function writeFileWithDir(filePath, content) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid argument: `filePath` must be a non-empty string.');
  }
  if (typeof content !== 'string') {
    // Allow empty strings, but not other types.
    throw new Error('Invalid argument: `content` must be a string.');
  }

  try {
    const dirname = path.dirname(filePath);
    await fs.mkdir(dirname, { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    const newError = new Error(`Failed to write file at '${filePath}': ${error.message}`);
    newError.cause = error;
    newError.code = error.code;
    throw newError;
  }
}

/**
 * Checks if a given path is a directory.
 *
 * @async
 * @param {string} sourcePath - The path to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the path is a directory, false otherwise.
 * @throws {Error} Throws an error if `fs.stat` fails for reasons other than the path not existing.
 */
export async function isDirectory(sourcePath) {
  if (!sourcePath || typeof sourcePath !== 'string') {
    throw new Error('Invalid argument: `sourcePath` must be a non-empty string.');
  }

  try {
    const stats = await fs.stat(sourcePath);
    return stats.isDirectory();
  } catch (error) {
    // If the path doesn't exist, it's not a directory.
    if (error.code === 'ENOENT') {
      return false;
    }
    // For other errors (e.g., permissions), re-throw.
    const newError = new Error(`Failed to stat path '${sourcePath}': ${error.message}`);
    newError.cause = error;
    newError.code = error.code;
    throw newError;
  }
}