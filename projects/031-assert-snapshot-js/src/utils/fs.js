import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * @fileoverview Provides robust, promise-based file system utilities for
 * handling snapshot files. This module abstracts away the direct use of the
 * 'fs' module, providing higher-level functions for reading, writing, and
 * managing snapshot directories and files with integrated error handling.
 */

/**
 * Checks if a file exists at the given path.
 *
 * @param {string} filePath The absolute path to the file.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the file
 *   exists, and `false` otherwise. It does not reject on file-not-found errors.
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    // If the error is 'ENOENT' (Error NO ENTry), the file doesn't exist.
    // For any other error, we re-throw as it indicates a more serious problem
    // (e.g., permissions issues).
    if (error.code === 'ENOENT') {
      return false;
    }
    // Re-throwing preserves the original stack trace and error information.
    throw new Error(`Failed to check existence of file at ${filePath}: ${error.message}`, { cause: error });
  }
}

/**
 * Reads the content of a snapshot file.
 *
 * @param {string} filePath The absolute path to the snapshot file.
 * @returns {Promise<string>} A promise that resolves with the UTF-8 encoded
 *   content of the file.
 * @throws {Error} If the file cannot be read (e.g., it doesn't exist or
 *   there are permission issues).
 */
export async function readSnapshotFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    // Provide a more context-specific error message.
    throw new Error(`Failed to read snapshot file at ${filePath}: ${error.message}`, { cause: error });
  }
}

/**
 * Writes content to a snapshot file, creating parent directories if they
 * do not exist.
 *
 * @param {string} filePath The absolute path where the snapshot file will be written.
 * @param {string} content The string content to write to the file.
 * @returns {Promise<void>} A promise that resolves when the file has been
 *   successfully written.
 * @throws {Error} If the directory cannot be created or the file cannot be written.
 */
export async function writeSnapshotFile(filePath, content) {
  try {
    // Ensure the directory containing the snapshot file exists.
    // The `recursive: true` option prevents errors if the directory already exists.
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file with UTF-8 encoding.
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    // Provide a more context-specific error message.
    throw new Error(`Failed to write snapshot file to ${filePath}: ${error.message}`, { cause: error });
  }
}