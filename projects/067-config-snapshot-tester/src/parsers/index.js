/**
 * @fileoverview Factory module for selecting the correct configuration file parser.
 *
 * This module acts as a dispatcher, inspecting the file extension of a given
 * path and delegating the parsing task to the appropriate specialized parser
 * (JSON, YAML, or .env). It simplifies the process of handling multiple
 * configuration formats by providing a single, unified entry point.
 */

import path from 'node:path';
import { parseJsonFile } from './json-parser.js';
import { parseYamlFile } from './yaml-parser.js';
import { parseEnvFile } from './env-parser.js';

/**
 * A map of file extensions to their corresponding parsing functions.
 * This allows for easy extension to support new file types in the future.
 * The keys are the file extensions (including the dot), and the values are
 * async functions that take a file path and return a parsed object.
 *
 * @type {Readonly<Record<string, (filePath: string) => Promise<object>>>}
 */
const PARSER_MAP = Object.freeze({
  '.json': parseJsonFile,
  '.yaml': parseYamlFile,
  '.yml': parseYamlFile, // Both .yaml and .yml are common extensions for YAML
  '.env': parseEnvFile,
});

/**
 * A list of supported file extensions, derived from the PARSER_MAP keys.
 * Used for generating helpful error messages.
 *
 * @type {Readonly<string[]>}
 */
const SUPPORTED_EXTENSIONS = Object.freeze(Object.keys(PARSER_MAP));

/**
 * Selects the appropriate parser based on the file extension and parses the file.
 *
 * This function determines the file type from its extension, then calls the
 * corresponding parser to read and convert the file content into a JavaScript object.
 * It provides a single, consistent interface for parsing any supported config format.
 *
 * @param {string} filePath - The path to the configuration file to be parsed.
 * @returns {Promise<object>} A promise that resolves to the parsed JavaScript object.
 * @throws {Error} Throws an error if the file path is invalid, if the file extension
 *   is unsupported, or if any parsing-specific errors occur (e.g., syntax errors).
 */
export async function parseFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided. Expected a non-empty string.');
  }

  // Extract the file extension in a case-insensitive manner.
  // path.extname returns the extension from the last occurrence of the .
  const fileExtension = path.extname(filePath).toLowerCase();

  const parser = PARSER_MAP[fileExtension];

  if (!parser) {
    throw new Error(
      `Unsupported file type for "${filePath}". Supported extensions are: ${SUPPORTED_EXTENSIONS.join(', ')}.`
    );
  }

  // Delegate to the selected parser. The parser is responsible for reading
  // the file and handling format-specific parsing errors.
  try {
    const parsedData = await parser(filePath);
    return parsedData;
  } catch (error) {
    // Re-throw the error from the specific parser. These errors are already
    // designed to be user-friendly and context-rich. This catch block ensures
    // that any unexpected issues during the delegation are also handled,
    // though the primary error handling is within each parser module.
    throw error;
  }
}