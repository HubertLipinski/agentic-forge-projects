import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSON5 from 'json5';
import logger from './logger.js';

/**
 * @file Handles reading and parsing files using 'json5' to support both JSON
 * and JSON5 formats. Includes error handling for invalid files.
 */

/**
 * Reads the content of a single file asynchronously.
 *
 * @param {string} filePath - The absolute or relative path to the file.
 * @returns {Promise<string>} A promise that resolves with the file's content as a UTF-8 string.
 * @throws {Error} Throws an error if the file cannot be read (e.g., does not exist, permissions issue).
 */
async function readFileContent(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    logger.verbose(`Successfully read file: ${filePath}`);
    return content;
  } catch (err) {
    logger.error(`Failed to read file: ${filePath}`);
    // Re-throw a more specific error to be handled by the caller.
    throw new Error(`Could not read file at '${filePath}'. Reason: ${err.message}`);
  }
}

/**
 * Parses a string containing JSON or JSON5 data into a JavaScript object.
 *
 * @param {string} content - The string content to parse.
 * @param {string} filePath - The path of the file being parsed (for logging purposes).
 * @returns {object} The parsed JavaScript object.
 * @throws {Error} Throws an error if the content is not valid JSON or JSON5.
 */
function parseJsonContent(content, filePath) {
  try {
    const data = JSON5.parse(content);
    // Ensure we always return an object, as merging non-objects is not supported.
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        logger.warn(`File '${filePath}' does not contain a root object. It will be skipped.`);
        return null;
    }
    logger.verbose(`Successfully parsed file: ${filePath}`);
    return data;
  } catch (err) {
    logger.error(`Failed to parse JSON5 from file: ${filePath}`);
    // Re-throw a more specific error to be handled by the caller.
    throw new Error(`Invalid JSON5 syntax in '${filePath}'. Reason: ${err.message}`);
  }
}

/**
 * Reads and parses a single JSON/JSON5 file from the given path.
 * This function orchestrates reading the file and then parsing its content.
 *
 * @param {string} filePath - The path to the JSON or JSON5 file.
 * @returns {Promise<object|null>} A promise that resolves with the parsed object,
 *   or null if the file content is not a valid object or an error occurs.
 */
export async function readAndParseFile(filePath) {
  const absolutePath = path.resolve(filePath);
  try {
    const content = await readFileContent(absolutePath);
    const data = parseJsonContent(content, absolutePath);
    return data;
  } catch (err) {
    // Errors from readFileContent and parseJsonContent are already logged.
    // We log a higher-level error here and return null to allow the process
    // to continue with other files if desired.
    logger.error(`Skipping file due to error: ${absolutePath}`);
    // Optionally log the detailed error stack in verbose mode for debugging.
    logger.verbose(err.stack);
    return null;
  }
}

/**
 * Reads and parses multiple JSON/JSON5 files from an array of file paths.
 * It filters out any files that could not be read or parsed, or that did not
 * contain a root object.
 *
 * @param {string[]} filePaths - An array of file paths to process.
 * @returns {Promise<object[]>} A promise that resolves with an array of successfully
 *   parsed JavaScript objects.
 */
export async function readAndParseFiles(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    logger.warn('No input files provided to read.');
    return [];
  }

  logger.verbose(`Reading and parsing ${filePaths.length} file(s)...`);

  const parsingPromises = filePaths.map(readAndParseFile);
  const results = await Promise.all(parsingPromises);

  // Filter out null results (from read/parse errors or non-object files)
  const validObjects = results.filter(data => data !== null);

  logger.verbose(`Successfully parsed ${validObjects.length} of ${filePaths.length} file(s).`);

  return validObjects;
}