/**
 * @file src/config/loader.js
 * @description Loads and validates the configuration file for schema-diff-sync.
 *
 * This module is responsible for reading a configuration file (YAML or JSON)
 * from a specified path, validating its contents, and returning a standardized
 * configuration object. It ensures that all required fields are present and
 * provides sensible defaults for optional ones.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

/**
 * Custom error class for configuration-related issues.
 */
class ConfigError extends Error {
  /**
   * @param {string} message The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Validates the structure and content of the parsed configuration object.
 *
 * @private
 * @param {object} config - The raw configuration object parsed from the file.
 * @throws {ConfigError} If the configuration is invalid.
 */
function _validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new ConfigError('Configuration file is empty or invalid.');
  }

  // Validate 'db' section
  if (!config.db || typeof config.db !== 'object') {
    throw new ConfigError("Configuration must include a 'db' object with connection details.");
  }

  const { type, ...connectionDetails } = config.db;
  if (!type) {
    throw new ConfigError("The 'db.type' field is required (e.g., 'postgres' or 'mysql').");
  }

  if (!['postgres', 'mysql'].includes(type.toLowerCase())) {
    throw new ConfigError(`Unsupported database type '${type}'. Must be 'postgres' or 'mysql'.`);
  }

  // Basic check for connection details
  const requiredKeys = ['host', 'user', 'password', 'database'];
  for (const key of requiredKeys) {
    if (connectionDetails[key] === undefined) {
      throw new ConfigError(`The 'db.${key}' field is required for the database connection.`);
    }
  }

  // Validate 'schemaFile'
  if (!config.schemaFile || typeof config.schemaFile !== 'string') {
    throw new ConfigError("The 'schemaFile' field, specifying the path to the schema definition, is required.");
  }
}

/**
 * Parses the raw content of a configuration file based on its extension.
 * Supports YAML (.yml, .yaml) and JSON (.json).
 *
 * @private
 * @param {string} rawContent - The raw string content of the configuration file.
 * @param {string} filePath - The path to the configuration file, used to determine the format.
 * @returns {object} The parsed configuration object.
 * @throws {ConfigError} If the file format is unsupported or parsing fails.
 */
function _parseConfigContent(rawContent, filePath) {
  const extension = path.extname(filePath).toLowerCase();

  try {
    if (extension === '.yml' || extension === '.yaml') {
      return yaml.load(rawContent);
    }
    if (extension === '.json') {
      return JSON.parse(rawContent);
    }
  } catch (parseError) {
    throw new ConfigError(`Failed to parse configuration file '${filePath}': ${parseError.message}`);
  }

  throw new ConfigError(`Unsupported configuration file format: '${extension}'. Please use .yml, .yaml, or .json.`);
}

/**
 * Loads, parses, and validates the configuration from the specified file path.
 *
 * This is the main exported function of the module. It orchestrates the entire
 * loading process, applies defaults, and resolves file paths relative to the
 * config file's location.
 *
 * @param {string} configPath - The path to the configuration file (e.g., 'db.yml').
 * @returns {Promise<object>} A promise that resolves to the validated and normalized configuration object.
 * @throws {ConfigError} If the file cannot be read, parsed, or validated.
 */
export async function loadConfig(configPath) {
  let rawContent;
  const absoluteConfigPath = path.resolve(configPath);

  try {
    rawContent = await readFile(absoluteConfigPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ConfigError(`Configuration file not found at '${absoluteConfigPath}'.`);
    }
    throw new ConfigError(`Failed to read configuration file '${absoluteConfigPath}': ${error.message}`);
  }

  const parsedConfig = _parseConfigContent(rawContent, absoluteConfigPath);
  _validateConfig(parsedConfig);

  // Normalize and apply defaults
  const configDir = path.dirname(absoluteConfigPath);

  const finalConfig = {
    db: {
      ...parsedConfig.db,
      type: parsedConfig.db.type.toLowerCase(),
    },
    // Resolve schemaFile path relative to the config file's directory
    schemaFile: path.resolve(configDir, parsedConfig.schemaFile),
    // Provide a default for the state file, also relative to the config file
    stateFile: path.resolve(configDir, parsedConfig.stateFile ?? '.schema-sync.state.json'),
  };

  return finalConfig;
}