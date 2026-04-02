import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { HISTORY_FILE_PATHS } from './constants.js';

/**
 * @fileoverview A utility module to read shell history files asynchronously,
 * handling potential file access errors gracefully.
 */

/**
 * Checks if a file exists and is accessible.
 * This is a more robust check than `fs.exists` which is deprecated.
 *
 * @param {string} filePath The absolute path to the file.
 * @returns {Promise<boolean>} A promise that resolves to true if the file exists and is readable, false otherwise.
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch {
    // Catches errors like EACCES (permission denied) or ENOENT (not found)
    return false;
  }
}

/**
 * Attempts to find the first available shell history file from a predefined list.
 * It iterates through common history file locations and returns the path of the first one it finds and can read.
 *
 * @returns {Promise<string|null>} A promise that resolves to the path of the found history file, or null if none are found.
 */
export async function findHistoryFile() {
  // The order of this array determines the priority of shells to check.
  const searchOrder = [
    HISTORY_FILE_PATHS.zsh,
    HISTORY_FILE_PATHS.bash,
    HISTORY_FILE_PATHS.fish,
  ];

  for (const filePath of searchOrder) {
    if (await fileExists(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * Reads the content of a specified history file.
 * It reads the entire file into memory, splits it into an array of lines,
 * and returns the lines in reverse order (most recent first).
 *
 * @param {string} filePath The absolute path to the history file.
 * @param {number} [limit] An optional maximum number of lines to read from the end of the file.
 * @returns {Promise<string[]>} A promise that resolves to an array of command lines.
 * @throws {Error} If the file cannot be read due to permissions or other I/O issues.
 */
export async function readHistoryFile(filePath, limit) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('A valid file path must be provided.');
  }

  try {
    const content = await fs.readFile(filePath, { encoding: 'utf-8' });
    const lines = content.split('\n').filter(line => line.trim() !== '');

    // Reverse to get most recent commands first, which is more intuitive for `limit`.
    const reversedLines = lines.reverse();

    if (limit && typeof limit === 'number' && limit > 0) {
      return reversedLines.slice(0, limit);
    }

    return reversedLines;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`History file not found at path: ${filePath}`);
    }
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied. Cannot read history file: ${filePath}`);
    }
    // For other unexpected errors, re-throw a more informative error.
    throw new Error(`Failed to read history file at ${filePath}. Reason: ${error.message}`);
  }
}