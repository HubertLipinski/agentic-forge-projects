'use strict';

/**
 * @fileoverview The core orchestrator for the structured-config-loader.
 * This module is responsible for loading configuration from various sources,
 * merging them according to a defined priority, and validating the final result
 * against a JSON schema.
 *
 * @module src/loader
 */

import { resolve } from 'node:path';
import { SOURCE_PRIORITY, DEFAULT_CONFIG_FILES, DEFAULT_ENV_FILE } from '../constants.js';
import { deepMerge, makeImmutable } from '../utils.js';
import { parseFile } from './parsers/file.js';
import { parseEnv } from './parsers/env.js';
import { parseArgv } from './parsers/argv.js';
import { validateConfig } from './validator.js';
import { ConfigLoaderError } from '../errors.js';

/**
 * Loads configuration from all specified file paths.
 * If no paths are provided, it searches for default files in the current working directory.
 *
 * @param {string[] | undefined} filePaths - An array of file paths to load.
 * @returns {Promise<object>} A promise that resolves to the merged configuration from all files.
 */
async function loadFromFiles(filePaths) {
  const pathsToLoad = filePaths ?? DEFAULT_CONFIG_FILES.map(file => resolve(process.cwd(), file));

  const fileConfigs = await Promise.all(
    pathsToLoad.map(path => parseFile(path))
  );

  return deepMerge({}, ...fileConfigs);
}

/**
 * Loads configuration from environment variables.
 *
 * @param {object | boolean} envOptions - Options for environment variable parsing, or a boolean to enable/disable.
 * @returns {Promise<object>} A promise that resolves to the configuration from environment variables.
 */
async function loadFromEnv(envOptions) {
  if (envOptions === false) {
    return {};
  }

  const options = typeof envOptions === 'object' ? envOptions : {};
  const {
    load = true,
    files = [resolve(process.cwd(), DEFAULT_ENV_FILE)],
    prefix = '',
    separator = '__',
  } = options;

  if (load === false) {
    return {};
  }

  return parseEnv({
    envFilePaths: files,
    prefix,
    separator,
    loadProcessEnv: true, // Always include process.env when this source is enabled
  });
}

/**
 * Loads configuration from command-line arguments.
 *
 * @param {object | boolean} argvOptions - Options for argv parsing, or a boolean to enable/disable.
 * @returns {Promise<object>} A promise that resolves to the configuration from command-line arguments.
 */
async function loadFromArgv(argvOptions) {
  if (argvOptions === false) {
    return {};
  }

  const options = typeof argvOptions === 'object' ? argvOptions : {};
  const { load = true, ...yargsParserConfig } = options;

  if (load === false) {
    return {};
  }

  return parseArgv({ yargsParserConfig });
}

/**
 * Orchestrates the loading, merging, and validation of configuration from multiple sources.
 *
 * This is the main engine of the library. It follows a strict, deterministic process:
 * 1. Loads configuration from each enabled source (defaults, files, env, argv) in parallel.
 * 2. Sorts the loaded configurations based on the predefined `SOURCE_PRIORITY`.
 * 3. Deeply merges the sorted configurations, with higher priority sources overwriting lower ones.
 * 4. Validates the final merged configuration against the provided JSON schema.
 * 5. Applies schema defaults and coerces types during validation (powered by Ajv).
 * 6. Returns a deeply frozen (immutable) version of the final configuration object.
 *
 * @param {object} options - The main options object for loading configuration.
 * @param {object} [options.schema] - A JSON schema for validation.
 * @param {object} [options.defaults] - A default configuration object (lowest priority).
 * @param {string[]} [options.files] - An array of file paths to load.
 * @param {object|boolean} [options.env] - Options for loading from environment variables.
 * @param {object|boolean} [options.argv] - Options for loading from command-line arguments.
 * @returns {Promise<Readonly<object>>} A promise that resolves to the final, immutable configuration object.
 * @throws {ConfigLoaderError} If any part of the loading, merging, or validation process fails.
 */
export async function load(options = {}) {
  const {
    schema = null,
    defaults = {},
    files: filePaths,
    env: envOptions = true,
    argv: argvOptions = true,
  } = options;

  try {
    // Step 1: Load all sources concurrently for efficiency.
    const sources = await Promise.all([
      { config: defaults, priority: SOURCE_PRIORITY.DEFAULT },
      loadFromFiles(filePaths).then(config => ({ config, priority: SOURCE_PRIORITY.FILE })),
      loadFromEnv(envOptions).then(config => ({ config, priority: SOURCE_PRIORITY.ENV })),
      loadFromArgv(argvOptions).then(config => ({ config, priority: SOURCE_PRIORITY.ARGV })),
    ]);

    // Step 2: Sort sources by priority (ascending).
    sources.sort((a, b) => a.priority - b.priority);

    // Step 3: Deep merge all sources into a single configuration object.
    // The initial empty object `{}` ensures we don't mutate the original `defaults` object.
    const mergedConfig = deepMerge({}, ...sources.map(s => s.config));

    // Step 4: Validate the merged configuration.
    // This step also applies schema defaults and coerces types.
    // The `mergedConfig` object is mutated by Ajv during this process.
    validateConfig(mergedConfig, schema);

    // Step 5: Return a deeply frozen, immutable copy of the final config.
    return makeImmutable(mergedConfig);
  } catch (error) {
    // If the error is already one of our custom types, re-throw it.
    if (error instanceof ConfigLoaderError) {
      throw error;
    }
    // Otherwise, wrap it in a generic loader error for consistent error handling.
    throw new ConfigLoaderError(
      `An unexpected error occurred during configuration loading: ${error.message}`,
      { cause: error }
    );
  }
}