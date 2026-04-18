import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * @fileoverview Utility functions for file system operations.
 * This module provides robust, async-first helpers for reading and writing files,
 * with integrated error handling for common I/O issues.
 */

/**
 * Asynchronously reads the content of a file.
 *
 * @param {string} filePath - The absolute or relative path to the file.
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {Error} Throws a custom error if the file cannot be read, including cases
 *   where the file does not exist (ENOENT) or permissions are denied (EACCES).
 */
export async function readFileContent(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided. Expected a non-empty string.');
  }

  const absolutePath = path.resolve(filePath);
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found at path: ${absolutePath}`);
    }
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied to read file at path: ${absolutePath}`);
    }
    // For other unexpected errors, re-throw a more informative error.
    throw new Error(`Failed to read file at path: ${absolutePath}. Reason: ${error.message}`);
  }
}

/**
 * Asynchronously writes content to a file, creating the directory if it doesn't exist.
 * This ensures that writing to nested paths (e.g., 'snapshots/prod/config.snap') is reliable.
 *
 * @param {string} filePath - The absolute or relative path where the file should be written.
 * @param {string} content - The string content to write to the file.
 * @returns {Promise<void>} A promise that resolves when the file has been successfully written.
 * @throws {Error} Throws a custom error if the file cannot be written, for example,
 *   due to permission issues (EACCES).
 */
export async function writeFileContent(filePath, content) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided. Expected a non-empty string.');
  }
  if (typeof content !== 'string') {
    // Coerce to string for convenience, but log a warning for unexpected types.
    // In a stricter implementation, one might throw here.
    console.warn(`Warning: writeFileContent received non-string content. It will be stringified.`);
    content = String(content);
  }

  const absolutePath = path.resolve(filePath);
  try {
    // Ensure the directory exists before attempting to write the file.
    // `recursive: true` makes it behave like `mkdir -p`.
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf-8');
  } catch (error) {
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied to write file at path: ${absolutePath}`);
    }
    // For other unexpected errors, re-throw a more informative error.
    throw new Error(`Failed to write file at path: ${absolutePath}. Reason: ${error.message}`);
  }
}

/**
 * Checks if a file or directory exists at the given path.
 *
 * @param {string} filePath - The path to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the path exists, false otherwise.
 */
export async function pathExists(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }
    try {
        await fs.access(path.resolve(filePath));
        return true;
    } catch (error) {
        // fs.access throws if the path does not exist or is inaccessible.
        // We only care about existence, so we can treat errors as "does not exist".
        return false;
    }
}