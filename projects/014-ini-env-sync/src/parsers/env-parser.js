/**
 * @file src/parsers/env-parser.js
 * @description A module for parsing and stringifying .env file content.
 *
 * This parser is designed to handle the nuances of .env files, including comments,
 * various quoting styles, and special characters. It provides functions to
 * convert .env file content into a structured key-value object and to serialize
 * such an object back into a valid .env file string. This is a critical
 * component for the INI <-> .env synchronization process.
 */

import { readFile, writeFile } from 'node:fs/promises';

/**
 * Regular expression to parse a single line in a .env file.
 * It captures the key and value, handling different quoting styles.
 *
 * Breakdown of the regex:
 * ^\s*            - Start of the line, optional whitespace.
 * (?!#)           - Negative lookahead to ignore comment lines.
 * ([\w.-]+)       - Group 1: The key. Allows word characters, dots, and hyphens.
 * \s*=\s*         - The assignment operator '=', surrounded by optional whitespace.
 * (.*?)           - Group 2: The value. Non-greedy match for the rest of the line.
 * \s*$            - Optional whitespace until the end of the line.
 */
const LINE_REGEX = /^\s*(?!#)([\w.-]+)\s*=\s*(.*?)\s*$/;

/**
 * Parses the content of a .env file into a JavaScript key-value object.
 *
 * This function reads a file, splits it into lines, and processes each line.
 * It correctly handles:
 * - Key-value pairs separated by '='.
 * - Comments (lines starting with '#') and blank lines, which are ignored.
 * - Quoted values (single, double, or backticks), stripping the quotes.
 * - Unquoted values, trimming any trailing whitespace.
 * - Special characters within quoted strings.
 *
 * @param {string} filePath - The absolute or relative path to the .env file.
 * @returns {Promise<Record<string, string>>} A promise that resolves to the parsed key-value object.
 * @throws {Error} If the file cannot be read.
 * @throws {TypeError} If the filePath is not a valid string.
 */
export async function parseEnvFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new TypeError('A valid file path must be provided as a string.');
  }

  let fileContent;
  try {
    fileContent = await readFile(filePath, { encoding: 'utf-8' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      // If the file doesn't exist, it's equivalent to an empty .env file.
      return {};
    }
    // For other errors (e.g., permissions), re-throw with context.
    throw new Error(`Failed to read .env file at "${filePath}": ${error.message}`);
  }

  const data = {};
  const lines = fileContent.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(LINE_REGEX);

    if (!match) {
      continue; // Skip blank lines, comments, or malformed lines.
    }

    const [, key, rawValue] = match;
    let value = rawValue;

    // Handle quoted values. Check for matching quotes at start and end.
    const firstChar = value.charAt(0);
    const lastChar = value.charAt(value.length - 1);

    if (
      (firstChar === '"' && lastChar === '"') ||
      (firstChar === "'" && lastChar === "'") ||
      (firstChar === '`' && lastChar === '`')
    ) {
      // Strip the quotes.
      value = value.substring(1, value.length - 1);
    }

    data[key] = value;
  }

  return data;
}

/**
 * Determines if a string value needs to be quoted in a .env file.
 * Quoting is necessary if the value contains:
 * - Leading or trailing whitespace.
 * - The '#' character (to prevent it from being treated as a comment).
 * - The '=' character.
 * - Is an empty string.
 *
 * @param {string} value - The string value to check.
 * @returns {boolean} True if the value should be quoted, false otherwise.
 */
function needsQuotes(value) {
  if (value === '') {
    return true; // Empty strings should be quoted to be represented as `KEY=""`.
  }
  // Check for leading/trailing whitespace, or special characters.
  return (
    value.trim() !== value ||
    value.includes('#') ||
    value.includes('=')
  );
}

/**
 * Stringifies a JavaScript object into .env format and writes it to a file.
 *
 * This function converts a key-value object into a string compliant with the
 * .env format. It intelligently adds double quotes around values that contain
 * special characters, whitespace, or are empty, ensuring the output is robust.
 *
 * @param {string} filePath - The path where the .env file will be written.
 * @param {Record<string, string | number | boolean>} data - The object to stringify. Values will be converted to strings.
 * @returns {Promise<void>} A promise that resolves when the file has been successfully written.
 * @throws {Error} If the file cannot be written.
 * @throws {TypeError} If inputs are invalid.
 */
export async function stringifyEnvFile(filePath, data) {
  if (!filePath || typeof filePath !== 'string') {
    throw new TypeError('A valid file path must be provided as a string.');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Data to be stringified must be a non-null object.');
  }

  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    // Ensure the key is valid for .env format (basic check).
    if (!/^[\w.-]+$/.test(key)) {
      console.warn(`Skipping invalid key for .env format: "${key}"`);
      continue;
    }

    const stringValue = String(value ?? ''); // Coerce value to string, handling null/undefined.

    if (needsQuotes(stringValue)) {
      // Escape double quotes within the value before wrapping.
      const escapedValue = stringValue.replace(/"/g, '\\"');
      lines.push(`${key}="${escapedValue}"`);
    } else {
      lines.push(`${key}=${stringValue}`);
    }
  }

  const envString = lines.join('\n') + '\n'; // End with a newline for POSIX compliance.

  try {
    await writeFile(filePath, envString, { encoding: 'utf-8' });
  } catch (error) {
    throw new Error(`Failed to write .env file to "${filePath}": ${error.message}`);
  }
}