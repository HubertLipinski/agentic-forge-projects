/**
 * @file src/utils/config-loader.js
 * @description Loads and validates the transformation configuration from a JSON file.
 * This module uses Ajv to ensure the provided configuration conforms to the
 * defined JSON schema, preventing common errors and ensuring the pipeline
 * receives a valid set of instructions.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import configSchema from '../schemas/config-schema.js';

/**
 * A custom error class for configuration-related issues.
 * This helps in distinguishing configuration errors from other types of errors
 * in the application's error handling logic.
 */
class ConfigError extends Error {
  /**
   * @param {string} message - The primary error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The original error that caused this one.
   * @param {any} [options.details] - Additional details, like validation errors.
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ConfigError';
    if (options.details) {
      this.details = options.details;
    }
  }
}

// Initialize Ajv with the schema.
// We create a single instance and reuse it for performance.
const ajv = new Ajv({ allErrors: true, useDefaults: true });
const validate = ajv.compile(configSchema);

/**
 * Loads a JSON configuration file from the specified path, parses it,
 * and validates it against the predefined JSON schema.
 *
 * @async
 * @function loadAndValidateConfig
 * @param {string} configPath - The absolute or relative path to the JSON configuration file.
 * @returns {Promise<object>} A promise that resolves to the validated configuration object,
 *   with defaults applied where applicable.
 * @throws {ConfigError} If the file cannot be read, is not valid JSON, or fails schema validation.
 */
export async function loadAndValidateConfig(configPath) {
  if (!configPath || typeof configPath !== 'string') {
    throw new ConfigError('A valid path to the configuration file must be provided.');
  }

  const absolutePath = path.resolve(configPath);
  let fileContent;

  try {
    fileContent = await fs.readFile(absolutePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ConfigError(`Configuration file not found at: ${absolutePath}`, { cause: error });
    }
    throw new ConfigError(`Failed to read configuration file: ${absolutePath}`, { cause: error });
  }

  let config;
  try {
    config = JSON.parse(fileContent);
  } catch (error) {
    throw new ConfigError(`Configuration file is not valid JSON: ${absolutePath}`, { cause: error });
  }

  const isValid = validate(config);

  if (!isValid) {
    const errorDetails = ajv.errorsText(validate.errors, { separator: '\n- ', dataVar: 'config' });
    const errorMessage = `Configuration validation failed:\n- ${errorDetails}`;
    throw new ConfigError(errorMessage, { details: validate.errors });
  }

  // The `validate` function mutates the `config` object to apply defaults.
  // We return the mutated, now-validated object.
  return config;
}