/**
 * @file src/parsers/file-parser.js
 * @description Handles reading and parsing configuration files in JSON and YAML formats.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

/**
 * Custom error class for configuration file parsing errors.
 * This helps in distinguishing parsing-specific errors from generic I/O errors.
 */
class ConfigParseError extends Error {
  /**
   * @param {string} message The error message.
   * @param {string} filePath The path to the file that caused the error.
   * @param {Error} [cause] The original underlying error, if any.
   */
  constructor(message, filePath, cause) {
    super(message);
    this.name = 'ConfigParseError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

/**
 * Parses a file's content as JSON.
 *
 * @param {string} content - The string content of the file.
 * @param {string} filePath - The path to the file, used for error reporting.
 * @returns {object} The parsed JavaScript object.
 * @throws {ConfigParseError} If the JSON content is invalid.
 */
function parseJson(content, filePath) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new ConfigParseError(`Invalid JSON in file: ${filePath}`, filePath, error);
  }
}

/**
 * Parses a file's content as YAML.
 *
 * @param {string} content - The string content of the file.
 * @param {string} filePath - The path to the file, used for error reporting.
 * @returns {object} The parsed JavaScript object.
 * @throws {ConfigParseError} If the YAML content is invalid.
 */
function parseYaml(content, filePath) {
  try {
    const data = yaml.load(content);
    // js-yaml returns `undefined` for empty files and non-objects for some valid YAML.
    // We only want to deal with object-based configurations.
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      // Return an empty object for valid but non-object YAML (e.g., a single string, or an empty file)
      // to ensure consistency in what we merge.
      return {};
    }
    return data;
  } catch (error) {
    throw new ConfigParseError(`Invalid YAML in file: ${filePath}`, filePath, error);
  }
}

/**
 * Reads and parses a single configuration file based on its extension.
 * Supports `.json`, `.yaml`, and `.yml` files.
 *
 * @param {string} filePath - The absolute path to the configuration file.
 * @returns {Promise<object>} A promise that resolves to the parsed configuration object.
 *                            Returns an empty object if the file is empty or unparsable.
 * @throws {Error} If the file cannot be read (e.g., permission issues).
 */
async function parseFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  let content;

  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    // If the file doesn't exist, it's not an error in our use case.
    // The config-finder might find potential files that don't actually exist.
    if (error.code === 'ENOENT') {
      return {};
    }
    // For other errors like EACCES, re-throw as a more specific error.
    throw new Error(`Failed to read configuration file: ${filePath}`, { cause: error });
  }

  // If the file is empty, return an empty object to avoid parsing errors.
  if (content.trim() === '') {
    return {};
  }

  try {
    switch (extension) {
      case '.json':
        return parseJson(content, filePath);
      case '.yaml':
      case '.yml':
        return parseYaml(content, filePath);
      default:
        // This case should ideally not be reached if `config-finder` only returns supported file types.
        console.warn(`[Auto-Config-Loader] Unsupported file type skipped: ${filePath}`);
        return {};
    }
  } catch (error) {
    if (error instanceof ConfigParseError) {
      console.error(`[Auto-Config-Loader] ${error.message}`);
    } else {
      console.error(`[Auto-Config-Loader] An unexpected error occurred while parsing ${filePath}:`, error);
    }
    // Fail gracefully for a single malformed file by returning an empty object.
    return {};
  }
}

/**
 * Asynchronously reads and parses a list of configuration files.
 * The files are processed in parallel.
 *
 * @param {string[]} filePaths - An array of absolute paths to configuration files.
 * @returns {Promise<object[]>} A promise that resolves to an array of parsed configuration
 *                              objects, one for each file. The order of the resulting array
 *                              corresponds to the order of the input `filePaths`.
 */
export async function parseFiles(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return [];
  }

  const parsePromises = filePaths.map(filePath => parseFile(filePath));
  const results = await Promise.all(parsePromises);

  return results;
}