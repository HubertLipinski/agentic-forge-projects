import { parse as dotenvParse } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { coerceType } from '../utils.js';
import { ConfigFileError } from '../errors.js';

/**
 * Expands a dot-separated string key into a nested object.
 * Example: 'DB.USER.NAME' becomes { DB: { USER: { NAME: ... } } }
 *
 * @param {object} obj - The object to which the key-value pair will be added.
 * @param {string} key - The dot-separated key (e.g., 'DB_USER_NAME').
 * @param {any} value - The value to set at the nested path.
 * @param {string} separator - The character used to separate path segments in the key.
 */
function setNestedProperty(obj, key, value, separator) {
  const keys = key.split(separator);
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const part = keys[i];
    // If the next part is a number, we might be creating an array
    const nextPartIsNumeric = /^\d+$/.test(keys[i + 1]);

    if (current[part] === undefined) {
      current[part] = nextPartIsNumeric ? [] : {};
    } else if (
      (nextPartIsNumeric && !Array.isArray(current[part])) ||
      (!nextPartIsNumeric && typeof current[part] !== 'object')
    ) {
      // Overwrite if the existing structure is not compatible
      // e.g., existing value is a primitive but we need to nest further.
      current[part] = nextPartIsNumeric ? [] : {};
    }
    current = current[part];
  }

  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;
}

/**
 * Parses a set of environment variables (from process.env or a .env file)
 * into a structured configuration object.
 *
 * @param {object} envVars - An object representing environment variables (e.g., process.env).
 * @param {object} options - Configuration options for parsing.
 * @param {string} [options.prefix] - A prefix to filter and strip from environment variable keys.
 * @param {string} [options.separator='__'] - The separator for nested keys (e.g., 'DB__USER').
 * @returns {object} A nested configuration object.
 */
function parseEnvVars(envVars, { prefix = '', separator = '__' }) {
  const config = {};
  const prefixString = prefix ? `${prefix}_` : '';

  for (const [key, value] of Object.entries(envVars)) {
    if (!key.startsWith(prefixString)) {
      continue;
    }

    const strippedKey = key.substring(prefixString.length);
    if (!strippedKey) {
      continue;
    }

    const coercedValue = coerceType(value);
    setNestedProperty(config, strippedKey, coercedValue, separator);
  }

  return config;
}

/**
 * Loads and parses environment variables from specified .env files and process.env.
 *
 * This function orchestrates the loading of variables from multiple sources:
 * 1. It reads and parses each specified `.env` file.
 * 2. It reads `process.env`.
 * 3. It merges them, with `process.env` taking highest precedence, followed by
 *    `.env` files in the order they are provided (earlier files are overridden by later ones).
 * 4. It then filters by prefix and transforms the flat key-value pairs into a
 *    nested configuration object.
 *
 * @param {object} options - Configuration options.
 * @param {string[]} [options.envFilePaths=[]] - An array of paths to .env files to load.
 * @param {boolean} [options.loadProcessEnv=true] - Whether to load variables from `process.env`.
 * @param {string} [options.prefix] - A prefix to filter environment variables (e.g., 'APP').
 * @param {string} [options.separator='__'] - The separator for creating nested objects (e.g., 'DB__USER').
 * @returns {Promise<object>} A promise that resolves to the parsed configuration object.
 */
export async function parseEnv({
  envFilePaths = [],
  loadProcessEnv = true,
  prefix = '',
  separator = '__',
}) {
  const allEnvVars = {};

  for (const filePath of envFilePaths) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = dotenvParse(content);
      Object.assign(allEnvVars, parsed);
    } catch (error) {
      // ENOENT is expected if a .env file is optional, so we don't throw.
      // Other errors (e.g., permission denied) should be thrown.
      if (error.code !== 'ENOENT') {
        throw new ConfigFileError(
          `Failed to read or parse .env file at '${filePath}': ${error.message}`,
          { cause: error, path: filePath }
        );
      }
    }
  }

  if (loadProcessEnv) {
    // process.env values override any values from .env files.
    Object.assign(allEnvVars, process.env);
  }

  return parseEnvVars(allEnvVars, { prefix, separator });
}