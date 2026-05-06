/**
 * @file src/utils/file-system.js
 * @description Utility functions for file system operations, primarily for discovering
 * JavaScript source files within a project directory.
 *
 * This module is a crucial part of the initial setup phase, responsible for
 * gathering the target files that the parser and analyzer will process.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Checks if a given path exists and is a directory.
 *
 * @param {string} directoryPath - The absolute or relative path to the directory.
 * @returns {Promise<boolean>} A promise that resolves to true if the path is a directory, false otherwise.
 */
export async function isDirectory(directoryPath) {
  try {
    const stats = await fs.stat(directoryPath);
    return stats.isDirectory();
  } catch (error) {
    // ENOENT means the path doesn't exist, which is a valid case for this check.
    // Other errors (like permission denied) will be caught and result in false.
    if (error.code === 'ENOENT') {
      return false;
    }
    // For unexpected errors, re-throwing might be too aggressive for a simple check.
    // Logging the error and returning false is a safer default.
    console.error(
      `Error checking directory status for "${directoryPath}":`,
      error,
    );
    return false;
  }
}

/**
 * Recursively finds all JavaScript files ('.js', '.mjs', '.cjs') within a given directory.
 * It ignores 'node_modules' and dot-prefixed directories/files by default.
 *
 * @param {string} directoryPath - The starting directory path to search from.
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute paths to the found JavaScript files.
 * @throws {Error} If the provided directoryPath does not exist or is not a directory.
 */
export async function findJavaScriptFiles(directoryPath) {
  const absolutePath = path.resolve(directoryPath);

  if (!(await isDirectory(absolutePath))) {
    throw new Error(
      `Source path "${directoryPath}" is not a valid directory or does not exist.`,
    );
  }

  const files = [];
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(absolutePath, entry.name);

    // Skip common ignored directories and dotfiles/dot-directories
    if (
      entry.name === 'node_modules' ||
      entry.name.startsWith('.') ||
      entry.name === 'dist' ||
      entry.name === 'build'
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      try {
        // Recurse into subdirectories and concatenate results
        const subDirectoryFiles = await findJavaScriptFiles(entryPath);
        files.push(...subDirectoryFiles);
      } catch (error) {
        // Log and continue if a subdirectory is unreadable, preserving overall progress.
        console.warn(`Could not read directory "${entryPath}": ${error.message}`);
      }
    } else if (entry.isFile() && /\.(js|mjs|cjs)$/.test(entry.name)) {
      // Add file to the list if it's a JavaScript file
      files.push(entryPath);
    }
  }

  return files;
}