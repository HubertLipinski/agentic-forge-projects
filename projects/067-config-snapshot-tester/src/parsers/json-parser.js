/**
 * @fileoverview Parser for JSON configuration files.
 *
 * This module is responsible for reading and parsing a JSON file into a
 * standard JavaScript object. It leverages the file-reading utilities to
* ensure consistent error handling for I/O operations and provides specific
 * error feedback for JSON syntax issues.
 */

import { readFileContent } from '../utils/file-utils.js';

/**
 * Parses a JSON string into a JavaScript object.
 * This is a synchronous wrapper around `JSON.parse` with enhanced error handling.
 *
 * @param {string} content - The JSON string content to parse.
 * @param {string} filePath - The original file path, used for context in error messages.
 * @returns {object} The parsed JavaScript object.
 * @throws {Error} Throws a detailed error if the JSON content is malformed.
 */
function parseJsonContent(content, filePath) {
  try {
    // Using JSON.parse is the standard and most performant way to parse JSON.
    const data = JSON.parse(content);

    // A simple check to ensure the top-level structure is an object,
    // as configuration files are typically key-value stores.
    // While valid JSON can be a primitive (e.g., "string", 123, true, null) or an array,
    // for configuration purposes, a top-level object is expected.
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`The root of the JSON file must be an object. Found type: ${Array.isArray(data) ? 'array' : (data === null ? 'null' : typeof data)}.`);
    }

    return data;
  } catch (error) {
    // Catch syntax errors from JSON.parse and re-throw with more context.
    // The original error message from JSON.parse is often very helpful (e.g., "Unexpected token...").
    throw new Error(`Failed to parse JSON file at "${filePath}". Reason: ${error.message}`);
  }
}

/**
 * Asynchronously reads a JSON file from the specified path and parses it into a JavaScript object.
 *
 * This function orchestrates the file reading and parsing process, ensuring that
 * I/O errors and JSON syntax errors are handled gracefully and reported with
 * helpful, user-friendly messages.
 *
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<object>} A promise that resolves to the parsed JavaScript object.
 * @throws {Error} Throws if the file cannot be read, is not valid JSON, or if the
 *   root of the JSON is not an object.
 */
export async function parseJsonFile(filePath) {
  const fileContent = await readFileContent(filePath);
  const parsedData = parseJsonContent(fileContent, filePath);
  return parsedData;
}