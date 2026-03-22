/**
 * @file src/config/loader.js
 * @description Handles loading and merging configuration from a config file,
 * CLI arguments, and default values.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stat } from 'node:fs/promises';
import { DEFAULT_CONFIG, CONFIG_FILE_NAME } from './constants.js';

/**
 * Checks if a file exists at the given path.
 * @param {string} filePath - The absolute path to the file.
 * @returns {Promise<boolean>} - True if the file exists, false otherwise.
 */
const fileExists = async (filePath) => {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    // For other errors (e.g., permission issues), re-throw.
    throw error;
  }
};

/**
 * Loads configuration from a `flaky-detector.config.js` file if it exists
 * in the specified directory.
 *
 * @param {string} cwd - The current working directory to search for the config file.
 * @returns {Promise<object>} A promise that resolves to the loaded configuration
 * object, or an empty object if the file doesn't exist.
 * @throws {Error} If the config file exists but has an error (e.g., syntax error,
 * invalid export).
 */
async function loadConfigFromFile(cwd) {
  const configPath = path.resolve(cwd, CONFIG_FILE_NAME);

  if (!(await fileExists(configPath))) {
    return {};
  }

  try {
    // Use pathToFileURL to ensure correct module loading on all OS, especially Windows.
    const configUrl = pathToFileURL(configPath).href;
    const module = await import(configUrl);

    if (module.default && typeof module.default === 'object') {
      return module.default;
    }

    throw new Error(
      `Configuration file at '${configPath}' must have a default export of type 'object'.`,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Syntax error in configuration file '${configPath}':\n${error.message}`,
      );
    }
    // Re-throw other import errors or the custom error from above.
    throw error;
  }
}

/**
 * Merges multiple configuration sources into a single configuration object.
 * The merge order is: defaults, file config, then CLI arguments.
 * Later sources override earlier ones.
 *
 * @param {object} defaults - The default configuration values.
 * @param {object} fileConfig - Configuration loaded from the config file.
 * @param {object} cliArgs - Configuration parsed from command-line arguments.
 * @returns {object} The final, merged configuration object.
 */
function mergeConfigs(defaults, fileConfig, cliArgs) {
  // Create a deep copy of defaults to avoid mutation.
  const baseConfig = structuredClone(defaults);

  // Merge file config, filtering out undefined values.
  const mergedFromFile = { ...baseConfig, ...fileConfig };
  Object.keys(mergedFromFile).forEach((key) => {
    if (fileConfig[key] === undefined) {
      mergedFromFile[key] = baseConfig[key];
    }
  });

  // Merge CLI args, which have the highest precedence.
  // We only consider CLI args that are explicitly provided (not yargs defaults).
  const finalConfig = { ...mergedFromFile };
  for (const key of Object.keys(cliArgs)) {
    // yargs sets keys for all options. We only want to override if the user
    // actually provided the argument. A simple check is to see if it's different
    // from the default, but a more robust way is needed if yargs API changes.
    // For now, we'll just check for non-null/undefined values that aren't aliases.
    // The '$0' and '_' keys are yargs-specific and should be ignored.
    if (key !== '_' && key !== '$0' && cliArgs[key] !== undefined) {
      finalConfig[key] = cliArgs[key];
    }
  }

  return finalConfig;
}

/**
 * Loads, merges, and validates the application configuration.
 *
 * It follows a specific precedence order:
 * 1. Default values (lowest precedence).
 * 2. Values from `flaky-detector.config.js`.
 * 3. Command-line arguments (highest precedence).
 *
 * @param {object} cliArgs - The arguments object parsed by yargs.
 * @returns {Promise<object>} A promise that resolves to the final, validated
 * configuration object.
 * @throws {Error} If required configuration (like `command`) is missing.
 */
export async function loadConfig(cliArgs) {
  // The CWD can be overridden by CLI, so we determine it first.
  const cwd = cliArgs.cwd || DEFAULT_CONFIG.cwd;

  const fileConfig = await loadConfigFromFile(cwd);
  const finalConfig = mergeConfigs(DEFAULT_CONFIG, fileConfig, cliArgs);

  // After merging, ensure the `cwd` is the one we resolved and used.
  finalConfig.cwd = cwd;

  // Final validation for required fields.
  if (!finalConfig.command) {
    throw new Error(
      'The `command` option is required. Please provide it via the CLI (`--command "npm test"`) or in a `flaky-detector.config.js` file.',
    );
  }

  return finalConfig;
}