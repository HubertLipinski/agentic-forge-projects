import fs from 'node:fs/promises';
import path from 'node:path';
import { cosmiconfig } from 'cosmiconfig';
import { DEFAULT_CONFIG } from '../constants.js';

/**
 * Loads configuration from a specified file path.
 * Supports JSON format.
 *
 * @param {string} filepath - The absolute path to the configuration file.
 * @returns {Promise<object|null>} The parsed configuration object, or null if the file doesn't exist or is invalid.
 */
async function loadConfigFromFile(filepath) {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File not found is a normal case, not an error.
      return null;
    }
    // For other errors (e.g., malformed JSON), throw a more informative error.
    throw new Error(`Error reading or parsing config file at ${filepath}: ${error.message}`);
  }
}

/**
 * Searches for and loads configuration using cosmiconfig.
 * Cosmiconfig will search for files like `.mutationrc.json`, `.mutationrc.js`,
 * or a `mutation` key in `package.json`.
 *
 * @returns {Promise<{config: object, filepath: string}|null>} The found config and its path, or null if not found.
 */
async function findAndLoadConfig() {
  // 'mutation' is the module name we'll look for in config files.
  // e.g., `.mutationrc.json` or `package.json`'s "mutation" property.
  const explorer = cosmiconfig('mutation', {
    searchPlaces: [
      'package.json',
      '.mutationrc',
      '.mutationrc.json',
      '.mutationrc.yaml',
      '.mutationrc.yml',
      '.mutationrc.js',
      '.mutationrc.cjs',
      'mutation.config.js',
      'mutation.config.cjs',
    ],
  });

  try {
    const result = await explorer.search();
    return result; // result is null if no config is found
  } catch (error) {
    // This could be due to a parsing error in a found config file.
    throw new Error(`Error searching for configuration: ${error.message}`);
  }
}

/**
 * Deeply merges multiple configuration objects.
 * The right-most objects have precedence.
 * Arrays are replaced, not merged.
 *
 * @param {...object} objects - The configuration objects to merge.
 * @returns {object} The merged configuration object.
 */
function deepMerge(...objects) {
  const result = {};
  for (const source of objects) {
    if (source && typeof source === 'object') {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          const sourceValue = source[key];
          const resultValue = result[key];

          if (
            sourceValue &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            resultValue &&
            typeof resultValue === 'object' &&
            !Array.isArray(resultValue)
          ) {
            result[key] = deepMerge(resultValue, sourceValue);
          } else {
            // Overwrite if not a nested object, or if it's an array
            result[key] = sourceValue;
          }
        }
      }
    }
  }
  return result;
}

/**
 * Cleans up CLI arguments, removing yargs-specific keys and camel-casing.
 *
 * @param {object} argv - The raw arguments object from yargs.
 * @returns {object} A clean configuration object derived from CLI args.
 */
function cleanCliArgs(argv) {
  const cleanedArgs = { ...argv };

  // Remove yargs-specific keys and aliases
  delete cleanedArgs._;
  delete cleanedArgs.$0;

  // Yargs might have both kebab-case and camelCase versions.
  // We only want the camelCase ones for consistency.
  // Example: if we have 'test-command' and 'testCommand', we remove 'test-command'.
  for (const key in cleanedArgs) {
    if (key.includes('-')) {
      delete cleanedArgs[key];
    }
  }

  return cleanedArgs;
}

/**
 * Loads and merges configuration from multiple sources with a defined precedence.
 *
 * The precedence is as follows (highest to lowest):
 * 1. Command-line arguments.
 * 2. Configuration file (`.mutationrc.json`, `package.json`, etc.).
 * 3. Default configuration.
 *
 * @param {object} cliArgs - The parsed command-line arguments from yargs.
 * @returns {Promise<object>} A single, merged configuration object.
 */
export async function loadConfig(cliArgs = {}) {
  const cosmiconfigResult = await findAndLoadConfig();
  const fileConfig = cosmiconfigResult ? cosmiconfigResult.config : {};

  // Clean up CLI arguments to only include user-provided options.
  const cleanedCliConfig = cleanCliArgs(cliArgs);

  // Merge configurations. The order determines precedence.
  // `cleanedCliConfig` is last, so it overrides everything else.
  const finalConfig = deepMerge(
    DEFAULT_CONFIG,
    fileConfig,
    cleanedCliConfig
  );

  // Ensure 'mutators' is always an array.
  if (typeof finalConfig.mutators === 'string') {
    finalConfig.mutators = finalConfig.mutators.split(',').map(m => m.trim());
  }

  // Ensure 'ignorePatterns' is always an array.
  if (typeof finalConfig.ignorePatterns === 'string') {
    finalConfig.ignorePatterns = finalConfig.ignorePatterns.split(',').map(p => p.trim());
  }

  return finalConfig;
}