/**
 * @fileoverview Loads and validates the main application configuration file.
 * This module is responsible for reading a YAML or JSON file from disk,
 * parsing it, and validating its structure against a predefined JSON schema.
 * This ensures the application starts with a valid and predictable configuration,
 * preventing runtime errors due to malformed settings.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { configSchema } from './schema.js';
import logger from '../utils/logger.js';

// Initialize a dedicated AJV instance for config validation.
// Using a separate instance from the one in `validation.js` isolates
// config validation from request validation and allows for stricter settings.
const ajv = new Ajv({
  allErrors: true, // Report all errors, not just the first one
  useDefaults: true, // Apply default values from the schema to the config
  strict: 'log', // Log warnings for unknown keywords
});
addFormats(ajv);

/**
 * Compiles the main configuration schema into a validation function.
 * This is done once at startup for performance. If the schema is invalid,
 * the application will fail to start, which is the desired behavior for a
 * critical configuration error.
 */
const validateConfig = ajv.compile(configSchema);

/**
 * Parses the raw content of a configuration file based on its extension.
 * Supports YAML (.yml, .yaml) and JSON (.json) formats.
 *
 * @param {string} rawContent - The raw string content of the configuration file.
 * @param {string} filePath - The path to the configuration file, used to determine the format.
 * @returns {object} The parsed configuration object.
 * @throws {Error} If the file format is unsupported or parsing fails.
 */
function parseConfigContent(rawContent, filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.yml' || extension === '.yaml') {
    try {
      return yaml.load(rawContent);
    } catch (error) {
      logger.error({ err: error, filePath }, 'Failed to parse YAML configuration file.');
      throw new Error(`YAML parsing error in ${filePath}: ${error.message}`);
    }
  }

  if (extension === '.json') {
    try {
      return JSON.parse(rawContent);
    } catch (error) {
      logger.error({ err: error, filePath }, 'Failed to parse JSON configuration file.');
      throw new Error(`JSON parsing error in ${filePath}: ${error.message}`);
    }
  }

  throw new Error(`Unsupported configuration file format: ${extension}. Please use .yml, .yaml, or .json.`);
}

/**
 * Loads, parses, and validates the application configuration from a given file path.
 *
 * This is the main entry point for loading configuration. It orchestrates reading the file,
 * parsing it based on its extension, and validating the resulting object against the
 * official configuration schema.
 *
 * @param {string} configPath - The absolute or relative path to the configuration file.
 * @returns {Promise<object>} A promise that resolves with the validated configuration object.
 * @throws {Error} If the file cannot be read, parsed, or fails validation.
 */
export async function loadConfig(configPath) {
  logger.info({ configPath }, 'Loading configuration file...');

  let rawContent;
  try {
    rawContent = await fs.readFile(configPath, 'utf-8');
  } catch (error) {
    logger.error({ err: error, configPath }, 'Failed to read configuration file.');
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found at: ${configPath}`);
    }
    throw new Error(`Could not read configuration file: ${error.message}`);
  }

  const config = parseConfigContent(rawContent, configPath);

  if (!config) {
    throw new Error(`Configuration file is empty or invalid: ${configPath}`);
  }

  const isValid = validateConfig(config);

  if (!isValid) {
    const errorDetails = ajv.errorsText(validateConfig.errors);
    logger.error(
      { errors: validateConfig.errors, details: errorDetails },
      'Configuration validation failed.'
    );
    throw new Error(`Invalid configuration: ${errorDetails}`);
  }

  logger.info({ configPath }, 'Configuration loaded and validated successfully.');
  return config;
}