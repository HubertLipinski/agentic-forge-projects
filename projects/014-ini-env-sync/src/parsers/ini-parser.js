/**
 * @file src/parsers/ini-parser.js
 * @description A module for parsing and stringifying INI file content.
 *
 * This module serves as a robust wrapper around the 'ini' package, providing
 * a standardized interface for handling INI data. It is designed to gracefully
 * handle file I/O, parsing errors, and the nuances of the INI format, including
 * sections. While the 'ini' package itself strips comments during parsing, this
 * module provides a clean API for converting INI content to and from a structured
 * JavaScript object.
 */

import { readFile, writeFile } from 'node:fs/promises';
import ini from 'ini';

/**
 * Parses the content of an INI file into a JavaScript object.
 *
 * This function reads a file from the specified path, then uses the 'ini'
 * package to parse its content. It handles file system errors and parsing
 * errors, providing clear, actionable error messages. The resulting object
 * represents the INI structure, with top-level keys and nested objects for sections.
 *
 * Example INI:
 * ```ini
 * key=value
 * [database]
 * host=localhost
 * ```
 *
 * Parsed Object:
 * ```js
 * {
 *   key: 'value',
 *   database: {
 *     host: 'localhost'
 *   }
 * }
 * ```
 *
 * @param {string} filePath - The absolute or relative path to the INI file.
 * @returns {Promise<object>} A promise that resolves to the parsed INI data as an object.
 * @throws {Error} If the file cannot be read or if the INI content is invalid.
 */
export async function parseIniFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new TypeError('A valid file path must be provided as a string.');
  }

  let fileContent;
  try {
    fileContent = await readFile(filePath, { encoding: 'utf-8' });
  } catch (error) {
    // Augment the file system error with more context.
    throw new Error(`Failed to read INI file at "${filePath}": ${error.message}`);
  }

  // Handle empty file gracefully, returning an empty object.
  if (fileContent.trim() === '') {
    return {};
  }

  try {
    // The 'ini' package's decode function is synchronous.
    const data = ini.decode(fileContent);
    return data;
  } catch (error) {
    // Catch potential parsing errors from the 'ini' library.
    throw new Error(`Failed to parse INI content from "${filePath}": ${error.message}`);
  }
}

/**
 * Stringifies a JavaScript object into INI format and writes it to a file.
 *
 * This function takes a structured object and converts it into a valid INI
 * file string using the 'ini' package. It supports nested objects, which are
 * translated into INI sections. The resulting string is then written to the
 * specified file path.
 *
 * @param {string} filePath - The path where the INI file will be written.
 * @param {object} data - The JavaScript object to stringify.
 * @param {object} [options={}] - Configuration options for stringification.
 * @param {boolean} [options.whitespace=true] - Adds whitespace around '=' for readability.
 * @returns {Promise<void>} A promise that resolves when the file has been successfully written.
 * @throws {Error} If the data cannot be stringified or the file cannot be written.
 */
export async function stringifyIniFile(filePath, data, options = {}) {
  if (!filePath || typeof filePath !== 'string') {
    throw new TypeError('A valid file path must be provided as a string.');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Data to be stringified must be a non-null object.');
  }

  const stringifyOptions = {
    whitespace: options.whitespace ?? true, // Default to true for better readability
  };

  let iniString;
  try {
    // The 'ini' package's encode function is synchronous.
    iniString = ini.encode(data, stringifyOptions);
  } catch (error) {
    // This is unlikely to happen with valid object input but is included for robustness.
    throw new Error(`Failed to stringify object to INI format: ${error.message}`);
  }

  try {
    await writeFile(filePath, iniString, { encoding: 'utf-8' });
  } catch (error) {
    // Augment the file system error with more context.
    throw new Error(`Failed to write INI file to "${filePath}": ${error.message}`);
  }
}