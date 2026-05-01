'use strict';

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { safeLoad } from 'js-yaml';
import { ConfigFileError } from '../errors.js';

/**
 * Parses the content of a configuration file based on its extension.
 * Supports JSON and YAML/YML formats.
 *
 * @param {string} content - The raw string content of the file.
 * @param {string} filePath - The path to the file, used for error reporting and determining the parser.
 * @returns {object} The parsed configuration object.
 * @throws {ConfigFileError} If the file format is unsupported or parsing fails.
 */
function parseFileContent(content, filePath) {
  const extension = extname(filePath).toLowerCase();

  try {
    switch (extension) {
      case '.json':
        // JSON.parse is generally faster for pure JSON files.
        return JSON.parse(content);

      case '.yaml':
      case '.yml':
        // js-yaml's safeLoad can also parse JSON, but we are explicit.
        return safeLoad(content, { filename: filePath });

      default:
        throw new ConfigFileError(`Unsupported file format: ${extension}`, { path: filePath });
    }
  } catch (error) {
    // Catch syntax errors from JSON.parse or safeLoad and wrap them.
    throw new ConfigFileError(
      `Failed to parse configuration file at '${filePath}': ${error.message}`,
      { cause: error, path: filePath }
    );
  }
}

/**
 * Asynchronously loads and parses a single configuration file from the given path.
 *
 * It gracefully handles cases where the file does not exist by returning an empty object,
 * which is a common requirement for optional configuration files (e.g., `config.local.json`).
 * For other errors, such as permission issues or parsing failures, it throws a `ConfigFileError`.
 *
 * @param {string} filePath - The absolute or relative path to the configuration file.
 * @returns {Promise<object>} A promise that resolves to the parsed configuration object,
 * or an empty object if the file does not exist.
 * @throws {ConfigFileError} If reading or parsing the file fails for reasons other than non-existence.
 */
export async function parseFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const config = parseFileContent(content, filePath);

    // Ensure that the root of the config file is an object.
    // Other types like arrays or primitives are not valid for merging.
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
      throw new ConfigFileError(
        `Configuration file '${filePath}' must resolve to an object, but got ${config === null ? 'null' : typeof config}.`,
        { path: filePath }
      );
    }

    return config;
  } catch (error) {
    // If the error is already a ConfigFileError, re-throw it directly.
    if (error instanceof ConfigFileError) {
      throw error;
    }

    // A common, non-fatal case: the file does not exist. We treat this as an empty config source.
    if (error.code === 'ENOENT') {
      return {};
    }

    // For other I/O errors (e.g., EACCES), wrap them in a custom error for better context.
    throw new ConfigFileError(
      `Failed to read configuration file at '${filePath}': ${error.message}`,
      { cause: error, path: filePath }
    );
  }
}