'use strict';

/**
 * @fileoverview Main public API for the structured-config-loader library.
 * This file exports the primary `loadConfig` function, which serves as the
 * single entry point for consumers of the library. It acts as a facade,
 * orchestrating the underlying loading, merging, and validation logic.
 *
 * @module src/index
 */

import { load } from './loader.js';

/**
 * Loads, merges, validates, and returns an application configuration object.
 *
 * This function is the main entry point for the library. It orchestrates the entire
 * configuration loading process by delegating to the core loader module. It provides a
 * simple, high-level API for consumers to get their final, immutable configuration.
 *
 * The process involves:
 * 1. Loading configuration from multiple sources (default object, files, environment variables, command-line arguments).
 * 2. Merging these sources in a predefined priority order (argv > env > files > defaults).
 * 3. Validating the merged configuration against an optional JSON Schema.
 * 4. Applying defaults and coercing types as defined in the schema.
 * 5. Returning a deeply frozen (immutable) configuration object to prevent runtime mutations.
 *
 * @public
 * @async
 * @function loadConfig
 * @param {object} [options={}] - Configuration options for the loading process.
 * @param {object} [options.schema] - A JSON Schema object to validate the final configuration.
 *   If provided, `ajv` will be used to validate the config, apply defaults, and coerce types.
 * @param {object} [options.defaults] - A plain object containing default configuration values.
 *   This source has the lowest priority.
 * @param {string[]} [options.files] - An explicit array of file paths to load. If not provided,
 *   the loader will search for default files (e.g., `config.json`, `config.yaml`) in the current working directory.
 * @param {object|boolean} [options.env=true] - Options for loading from environment variables.
 *   Set to `false` to disable. If an object, it can configure `files` (for .env), `prefix`, and `separator`.
 * @param {object|boolean} [options.argv=true] - Options for loading from command-line arguments.
 *   Set to `false` to disable. If an object, it can be used to pass custom configuration to `yargs-parser`.
 *
 * @returns {Promise<Readonly<object>>} A promise that resolves to the final, validated, and immutable configuration object.
 * @throws {ConfigLoaderError} Throws a subclass of `ConfigLoaderError` (e.g., `ConfigFileError`, `ConfigValidationError`)
 *   if any part of the process fails, providing detailed context about the error.
 *
 * @example
 * // Basic usage with automatic source discovery
 * import { loadConfig } from 'structured-config-loader';
 *
 * try {
 *   const config = await loadConfig({ schema: mySchema });
 *   console.log('Configuration loaded:', config);
 * } catch (error) {
 *   console.error('Failed to load configuration:', error);
 * }
 */
export const loadConfig = load;