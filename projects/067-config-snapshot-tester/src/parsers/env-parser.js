/**
 * @fileoverview Parser for .env configuration files.
 *
 * This module is responsible for reading and parsing a .env file into a
 * standard JavaScript object. It uses the 'dotenv' library for parsing
 * and leverages the shared file-reading utilities to ensure consistent
 * error handling for I/O operations. It also provides specific error
 * feedback for .env syntax issues.
 */

import dotenv from 'dotenv';
import { readFileContent } from '../utils/file-utils.js';

/**
 * Parses a .env file content string into a JavaScript object.
 * This is a synchronous wrapper around `dotenv.parse` with enhanced error handling.
 *
 * The `dotenv` library automatically handles comments, quoted values, and
 * multiline variables, making it a robust choice for parsing.
 *
 * @param {string} content - The .env string content to parse.
 * @param {string} filePath - The original file path, used for context in error messages.
 * @returns {object} The parsed JavaScript object.
 * @throws {Error} Throws a detailed error if the .env content is malformed.
 */
function parseEnvContent(content, filePath) {
  try {
    // dotenv.parse takes a Buffer or string and returns an object with parsed keys and values.
    // It throws a `DotenvParseError` on syntax errors, which we can catch.
    const data = dotenv.parse(content);

    // Unlike JSON or YAML, .env files always produce a flat object of strings,
    // so we don't need to check the root type. An empty file results in an empty object,
    // which is a valid state.

    return data;
  } catch (error) {
    // Catch syntax errors from dotenv.parse and re-throw with more context.
    // The original error message is usually informative (e.g., "Line 5: Unexpected character").
    throw new Error(`Failed to parse .env file at "${filePath}". Reason: ${error.message}`);
  }
}

/**
 * Asynchronously reads a .env file from the specified path and parses it into a JavaScript object.
 *
 * This function orchestrates the file reading and parsing process, ensuring that
 * I/O errors and .env syntax errors are handled gracefully and reported with
 * helpful, user-friendly messages.
 *
 * @param {string} filePath - The path to the .env file.
 * @returns {Promise<object>} A promise that resolves to the parsed JavaScript object,
 *   where all values are strings.
 * @throws {Error} Throws if the file cannot be read or is not a valid .env file.
 */
export async function parseEnvFile(filePath) {
  const fileContent = await readFileContent(filePath);
  const parsedData = parseEnvContent(fileContent, filePath);
  return parsedData;
}