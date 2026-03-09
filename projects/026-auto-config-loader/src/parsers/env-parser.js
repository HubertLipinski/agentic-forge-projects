/**
 * @file src/parsers/env-parser.js
 * @description Parses environment variables from `process.env` and .env files.
 *              Supports custom prefixes, mapping to nested objects, and type coercion.
 */

import { config as dotenvConfig } from 'dotenv';
import { set } from '../utils/object-utils.js';

/**
 * Parses a string value into a boolean, number, or its original string form.
 * - "true" / "false" (case-insensitive) become booleans.
 * - Numeric strings become numbers.
 * - Other strings remain as is.
 *
 * @param {string} value The string value to parse.
 * @returns {boolean|number|string} The parsed value.
 */
function coerceType(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const lowercasedValue = value.toLowerCase();
  if (lowercasedValue === 'true') {
    return true;
  }
  if (lowercasedValue === 'false') {
    return false;
  }

  // Check if it's a valid number (integer or float) and not an empty string
  if (value.trim() !== '' && !Number.isNaN(Number(value))) {
    // Check to prevent octal interpretation for strings like "010"
    if (!/^[0-9]/.test(value) || value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
      return value;
    }
    return Number(value);
  }

  return value;
}

/**
 * Parses an object of environment variables (like `process.env`) into a nested
 * configuration object. It filters variables by a given prefix, strips the prefix,
 * converts keys to a consistent format (lowercase, dot-separated), and coerces values.
 *
 * @example
 * // With prefix 'APP' and separator '__'
 * // { 'APP_DB__HOST': 'localhost', 'APP_DB__PORT': '5432' }
 * // becomes
 * // { db: { host: 'localhost', port: 5432 } }
 *
 * @param {object} envVars - The object containing environment variables (e.g., `process.env`).
 * @param {object} options - Configuration options.
 * @param {string} [options.prefix=''] - The prefix to filter environment variables by.
 * @param {string} [options.separator='__'] - The separator used in variable names to denote nesting.
 * @returns {object} A nested configuration object.
 */
function parsePrefixedEnv(envVars, { prefix = '', separator = '__' } = {}) {
  const config = {};
  const prefixString = prefix ? `${prefix}${separator}` : '';

  for (const key in envVars) {
    if (key.startsWith(prefixString)) {
      const unprefixedKey = key.substring(prefixString.length);
      const value = envVars[key];

      // Don't process empty keys that might result from a variable like `APP__=`
      if (!unprefixedKey) {
        continue;
      }

      // Convert the key to dot notation, e.g., 'DB_HOST' -> 'db.host'
      const path = unprefixedKey.toLowerCase().replace(new RegExp(separator, 'g'), '.');

      // Coerce type and set the value in the nested object
      set(config, path, coerceType(value));
    }
  }

  return config;
}

/**
 * Loads and parses variables from a `.env` file.
 * This function uses `dotenv` to read the file content into an object.
 * It does NOT modify `process.env`.
 *
 * @param {string} envPath - The absolute path to the .env file.
 * @returns {Promise<object>} A promise that resolves to an object of parsed key-value pairs.
 *                            Returns an empty object if the file doesn't exist or is empty.
 * @throws {Error} If there is an error reading or parsing the file.
 */
async function parseDotenvFile(envPath) {
  try {
    const result = dotenvConfig({ path: envPath });

    if (result.error) {
      // dotenv throws if the file is not found, but we treat that as a non-error case.
      // We only re-throw for actual parsing errors.
      if (result.error.code !== 'ENOENT') {
        throw new Error(`Failed to parse .env file at ${envPath}: ${result.error.message}`);
      }
      return {}; // File not found, return empty config
    }

    return result.parsed || {};
  } catch (error) {
    // Catch other potential errors during file processing.
    console.error(`[Auto-Config-Loader] Error processing .env file at ${envPath}:`, error);
    return {}; // Fail gracefully by returning an empty object.
  }
}

/**
 * Parses environment variables from both `process.env` and specified `.env` files.
 * The results are returned as two separate objects.
 *
 * @param {object} options - Configuration options for parsing.
 * @param {string[]} options.envFiles - An array of absolute paths to .env files to load.
 * @param {string} [options.prefix=''] - The prefix for filtering `process.env` variables.
 * @param {string} [options.separator='__'] - The separator for nesting in `process.env` variables.
 * @returns {Promise<{ fromProcessEnv: object, fromDotenvFiles: object }>} A promise that resolves to an
 *          object containing parsed configurations from `process.env` and the merged content of all .env files.
 */
export async function parseEnvironment({ envFiles = [], prefix = '', separator = '__' }) {
  // 1. Parse `process.env` based on prefix and separator
  const fromProcessEnv = parsePrefixedEnv(process.env, { prefix, separator });

  // 2. Parse all provided .env files
  const dotenvResults = await Promise.all(
    envFiles.map(filePath => parseDotenvFile(filePath))
  );

  // 3. Merge results from all .env files.
  // Files listed later in the array take precedence over earlier ones.
  const fromDotenvFiles = dotenvResults.reduce((acc, current) => {
    // Coerce types for values from .env files as well
    const coercedCurrent = {};
    for (const key in current) {
      coercedCurrent[key] = coerceType(current[key]);
    }
    return { ...acc, ...coercedCurrent };
  }, {});

  return { fromProcessEnv, fromDotenvFiles };
}