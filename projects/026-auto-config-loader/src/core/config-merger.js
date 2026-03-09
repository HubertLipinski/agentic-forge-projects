/**
 * @file src/core/config-merger.js
 * @description Orchestrates the merging of configurations from various sources,
 *              applying a predefined order of precedence.
 */

import { deepMerge } from '../utils/object-utils.js';
import { parseFiles } from '../parsers/file-parser.js';
import { parseEnvironment } from '../parsers/env-parser.js';

/**
 * Merges configurations from all sources according to a defined precedence order.
 * The order of precedence (from lowest to highest) is:
 * 1. Default configuration object provided by the user.
 * 2. Configuration files found in the user's home directory.
 * 3. Configuration files found in the project directory structure (files in deeper directories override files in parent directories).
 * 4. Configuration from `.env` files (values from `.env.<NODE_ENV>` override `.env`).
 * 5. Environment variables from `process.env` (filtered by prefix).
 *
 * @param {object} sources - An object containing categorized configuration sources.
 * @param {string[]} sources.homeFiles - A list of absolute paths to config files in the user's home directory.
 * @param {string[]} sources.projectFiles - A list of absolute paths to config files in the project, ordered from parent to child directory.
 * @param {string[]} sources.envFiles - A list of absolute paths to `.env` files, ordered by precedence.
 * @param {object} options - Configuration options for merging and parsing.
 * @param {object} [options.defaults={}] - A default configuration object.
 * @param {string} [options.envPrefix=''] - The prefix for filtering environment variables.
 * @param {string} [options.envSeparator='__'] - The separator for nesting in environment variables.
 * @returns {Promise<object>} A promise that resolves to the final, deeply merged configuration object.
 */
export async function mergeConfigurations(sources, options) {
  const {
    homeFiles = [],
    projectFiles = [],
    envFiles = [],
  } = sources;

  const {
    defaults = {},
    envPrefix = '',
    envSeparator = '__',
  } = options;

  // 1. Parse all file-based configurations in parallel for efficiency.
  // The `parseFiles` function handles reading and parsing JSON/YAML files.
  const [
    parsedHomeConfigs,
    parsedProjectConfigs,
  ] = await Promise.all([
    parseFiles(homeFiles),
    parseFiles(projectFiles),
  ]);

  // 2. Parse environment configurations.
  // This includes both `.env` files and `process.env`.
  const { fromProcessEnv, fromDotenvFiles } = await parseEnvironment({
    envFiles,
    prefix: envPrefix,
    separator: envSeparator,
  });

  // 3. Perform the cascading merge according to precedence rules.
  // `deepMerge` creates a new object, leaving the sources unmodified.
  // The order of arguments to `deepMerge` matters: later objects override earlier ones.

  const finalConfig = deepMerge(
    {}, // Start with an empty object to ensure immutability of sources.
    defaults, // Lowest precedence: user-provided defaults.
    ...parsedHomeConfigs, // Merge configs from the home directory.
    ...parsedProjectConfigs, // Merge project configs. Deeper files (later in the array) override shallower ones.
    fromDotenvFiles, // Config from .env files.
    fromProcessEnv, // Highest precedence: prefixed environment variables.
  );

  return finalConfig;
}