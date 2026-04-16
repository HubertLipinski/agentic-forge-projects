/**
 * @file src/cli/parser.js
 * @description Command-line interface utility for parsing input data.
 *
 * This module provides a function to read numerical data from either a specified
 * file or from the standard input stream (stdin). It processes the raw text,
 * sanitizes it into an array of numbers, and returns it for statistical
 * processing. It's designed to be robust, handling I/O errors and malformed
 * data gracefully.
 */

import { promises as fs } from 'node:fs';
import { sanitizeNumericArray } from '../utils/validation.js';

/**
 * Reads all data from the standard input stream until it closes.
 *
 * @returns {Promise<string>} A promise that resolves with the complete content from stdin.
 * @private
 */
const readFromStdin = async () => {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  } catch (error) {
    // This is a defensive catch; errors during stdin read are rare but possible.
    console.error('Error: Failed to read from standard input.');
    throw error; // Re-throw to allow the caller to handle process exit.
  }
};

/**
 * Parses raw text content into an array of numbers.
 * The text is expected to contain numbers separated by whitespace (spaces, tabs, newlines).
 *
 * @param {string} content - The raw string content to parse.
 * @returns {Array<number>} An array of sanitized numbers.
 * @private
 */
const parseContent = (content) => {
  // Split by any whitespace character (space, tab, newline, etc.)
  const stringTokens = content.trim().split(/\s+/);
  // Sanitize the resulting array of string tokens.
  // This will convert valid numeric strings to numbers and filter out invalid entries.
  return sanitizeNumericArray(stringTokens);
};

/**
 * Parses numerical data from a file or standard input.
 *
 * If a `filePath` is provided, it reads and parses the content of that file.
 * If `filePath` is null or undefined, it reads and parses data from `stdin`.
 * The function handles file system errors, provides informative error messages,
 * and ensures the output is a sanitized array of numbers.
 *
 * @param {string | null | undefined} filePath - The path to the data file. If null, reads from stdin.
 * @returns {Promise<Array<number>>} A promise that resolves to a sanitized array of numbers.
 * @throws Will throw an error if the file cannot be read or if stdin fails.
 */
export const parseData = async (filePath) => {
  let rawContent;

  if (filePath) {
    try {
      rawContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`Error: File not found at '${filePath}'.`);
      } else if (error.code === 'EACCES') {
        console.error(`Error: Permission denied to read file at '${filePath}'.`);
      } else {
        console.error(`Error: An unexpected error occurred while reading the file: ${error.message}`);
      }
      // Re-throw to signal a fatal error to the CLI handler.
      throw error;
    }
  } else {
    // Check if stdin is a TTY. If so, no data is being piped.
    if (process.stdin.isTTY) {
        console.error('Error: No input file specified and no data piped to stdin.');
        // Throw a specific error to be caught by the CLI for a clean exit.
        throw new Error('NO_INPUT');
    }
    rawContent = await readFromStdin();
  }

  return parseContent(rawContent);
};