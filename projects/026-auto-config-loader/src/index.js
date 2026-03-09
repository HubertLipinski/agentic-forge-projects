/**
 * @file src/index.js
 * @description The main module and public API for the Auto-Config Loader.
 *              This file exports a single function that finds, parses, merges,
 *              validates, and returns the final configuration object.
 */

import { findConfigFiles } from './core/config-finder.js';
import { mergeConfigurations } from './core/config-merger.js';
import { validateConfig } from './validator.js';
import { get } from './utils/object-utils.js';

/**
 * @typedef {object} LoadConfigOptions
 * @property {string} [startDir=process.cwd()] - The directory to start searching for config files.
 * @property {string} [stopDir] - The directory to stop searching upwards. Defaults to the filesystem root.
 * @property {string} [env=process.env.NODE_ENV] - The environment to use for loading environment-specific files (e.g., 'production').
 * @property {boolean} [searchHome=true] - Whether to search for config files in the user's home directory.
 * @property {object} [defaults={}] - A default configuration object with the lowest precedence.
 * @property {string} [envPrefix=''] - A prefix for environment variables to be loaded into the config.
 * @property {string} [envSeparator='__'] - The separator used to denote nesting in environment variable keys.
 * @property {object} [schema=null] - An optional schema object for validating the final configuration.
 */

/**
 * A wrapper class for the final configuration object, providing a convenient
 * `get` method for accessing nested properties using dot notation.
 */
class Config {
  /**
   * @param {object} configData - The raw, merged configuration object.
   */
  constructor(configData) {
    // Freeze the configuration object to make it immutable, preventing accidental modifications at runtime.
    Object.assign(this, configData);
    Object.freeze(this);
  }

  /**
   * Retrieves a nested value from the configuration using a dot-notation path.
   *
   * @example
   * const dbHost = config.get('database.host', 'localhost');
   *
   * @param {string} path - The dot-notation path to the desired value (e.g., 'database.host').
   * @param {any} [defaultValue=undefined] - The value to return if the path is not found.
   * @returns {any} The value at the specified path or the default value.
   */
  get(path, defaultValue = undefined) {
    return get(this, path, defaultValue);
  }
}

/**
 * Asynchronously finds, parses, merges, and validates application configuration
 * from multiple sources.
 *
 * This is the main entry point of the library. It orchestrates the entire process:
 * 1. Finds all relevant configuration files (`config.json`, `.env`, etc.) by searching
 *    upwards from `startDir`.
 * 2. Parses the found files (JSON, YAML, .env) and environment variables.
 * 3. Merges all sources into a single configuration object based on a predefined
 *    order of precedence.
 * 4. (Optional) Validates the final configuration against a provided schema.
 * 5. Returns an immutable `Config` instance.
 *
 * @param {LoadConfigOptions} [options={}] - Options to customize the loading process.
 * @returns {Promise<Config>} A promise that resolves to an immutable `Config` object.
 * @throws {ConfigValidationError} If schema validation fails.
 * @throws {Error} If a critical error occurs during file I/O or parsing.
 */
export async function loadConfig(options = {}) {
  const {
    startDir = process.cwd(),
    stopDir,
    env = process.env.NODE_ENV,
    searchHome = true,
    defaults = {},
    envPrefix = '',
    envSeparator = '__',
    schema = null,
  } = options;

  try {
    // Step 1: Find all relevant configuration files.
    // `findConfigFiles` searches the filesystem and returns categorized file paths
    // ordered by precedence (e.g., parent directory files first).
    const fileSources = await findConfigFiles({
      startDir,
      stopDir,
      env,
      searchHome,
    });

    // Step 2: Merge configurations from all sources.
    // `mergeConfigurations` orchestrates parsing and deep merging according to
    // the established precedence rules (env vars > .env files > project files > home files > defaults).
    const finalConfigObject = await mergeConfigurations(fileSources, {
      defaults,
      envPrefix,
      envSeparator,
    });

    // Step 3: (Optional) Validate the final configuration against the schema.
    // `validateConfig` will throw a `ConfigValidationError` if the config is invalid.
    if (schema) {
      validateConfig(finalConfigObject, schema);
    }

    // Step 4: Return the final configuration wrapped in a helper class.
    // The `Config` class provides the `get` method and makes the object immutable.
    return new Config(finalConfigObject);
  } catch (error) {
    // Re-throw the error to be handled by the application, but add context.
    // This ensures that critical configuration loading failures are not silent.
    console.error('[Auto-Config-Loader] Failed to load configuration:', error.message);
    throw error;
  }
}

// For convenience, we can also export a default function.
export default loadConfig;