import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { configSchema, validate } from '../utils/ajv-schemas.js';
import { createLogger, getLogger } from '../utils/logger.js';

/**
 * @fileoverview Manages loading, validation, and access of application configuration.
 *
 * This module provides a robust, multi-layered configuration system for the
 * Adaptive Scraper Cluster. It follows a clear precedence order:
 *
 * 1. **Environment Variables**: Highest priority. Allows for dynamic overrides in
 *    different environments (e.g., Docker, CI/CD). Specific variables like
 *    `ASC_REDIS_HOST` override corresponding file settings.
 * 2. **Configuration File**: A JSON file specified by the `ASC_CONFIG_PATH`
 *    environment variable or a default `config/config.json`.
 * 3. **.env File**: Loads environment variables from a `.env` file in the project root,
 *    useful for local development.
 * 4. **Default Values**: Lowest priority. These are defined directly within the
 *    AJV `configSchema`.
 *
 * The loaded configuration is validated against a strict JSON schema to ensure
 * correctness and prevent runtime errors. The final, merged configuration is
 * cached in a singleton pattern to ensure consistent and efficient access
 * throughout the application's lifecycle.
 */

/**
 * The singleton configuration object.
 * It is populated once by `loadConfig()` and then reused for all subsequent
 * calls to `getConfig()`, ensuring a single source of truth.
 * @type {object | null}
 */
let configInstance = null;

/**
 * A promise that resolves with the loaded configuration.
 * This prevents race conditions where multiple parts of the app might try to
 * load the configuration simultaneously.
 * @type {Promise<object> | null}
 */
let loadConfigPromise = null;

/**
 * Finds the project root directory by searching upwards from the current file
 * for a `package.json` file.
 *
 * @returns {string} The absolute path to the project root.
 * @throws {Error} If `package.json` cannot be found.
 */
function findProjectRoot() {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));
  while (currentDir !== '/') {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      // Use fs.accessSync for a quick existence check.
      fs.access(packageJsonPath);
      return currentDir;
    } catch {
      // File not found, move up one directory.
      currentDir = path.dirname(currentDir);
    }
  }
  throw new Error('Could not find project root (package.json).');
}

/**
 * Loads configuration from a specified JSON file path.
 *
 * @param {string} configPath - The absolute path to the configuration file.
 * @returns {Promise<object>} The parsed configuration object from the file.
 * @throws {Error} If the file cannot be read or parsed.
 */
async function loadFromFile(configPath) {
  const logger = getLogger();
  try {
    logger.debug({ path: configPath }, 'Attempting to load configuration from file.');
    const fileContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // This is not an error if the file is optional, but we log it for debugging.
      logger.warn({ path: configPath }, 'Configuration file not found. Skipping.');
      return {};
    }
    logger.error({ path: configPath, err: error }, 'Failed to read or parse configuration file.');
    throw new Error(`Error loading configuration file at ${configPath}: ${error.message}`);
  }
}

/**
 * Merges environment variables into the configuration object.
 * Maps `ASC_SECTION_KEY` to `config.section.key`.
 *
 * @param {object} baseConfig - The configuration object to merge into.
 * @returns {object} The configuration object with environment variables applied.
 */
function mergeFromEnv(baseConfig) {
  const envConfig = {};
  const prefix = 'ASC_';

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix)) continue;

    const [section, ...rest] = key.substring(prefix.length).toLowerCase().split('_');
    const property = rest.reduce((acc, part, index) => {
        if (index === 0) return part;
        return acc + part.charAt(0).toUpperCase() + part.slice(1);
    }, '');

    if (!section || !property) continue;

    if (!envConfig[section]) {
      envConfig[section] = {};
    }

    // Attempt to parse numbers and booleans
    let parsedValue = value;
    if (!isNaN(value) && value.trim() !== '') {
      parsedValue = Number(value);
    } else if (value.toLowerCase() === 'true') {
      parsedValue = true;
    } else if (value.toLowerCase() === 'false') {
      parsedValue = false;
    }

    envConfig[section][property] = parsedValue;
  }

  // Deep merge envConfig into baseConfig
  for (const [section, properties] of Object.entries(envConfig)) {
    if (typeof baseConfig[section] === 'object' && baseConfig[section] !== null) {
      baseConfig[section] = { ...baseConfig[section], ...properties };
    } else {
      baseConfig[section] = properties;
    }
  }

  return baseConfig;
}

/**
 * Loads, merges, validates, and caches the application configuration.
 *
 * This is the main function that orchestrates the configuration loading process.
 * It ensures that configuration is loaded only once and that the final result
 * is valid and accessible throughout the application.
 *
 * @returns {Promise<object>} A promise that resolves with the final, validated configuration object.
 */
export function loadConfig() {
  if (loadConfigPromise) {
    return loadConfigPromise;
  }

  loadConfigPromise = (async () => {
    // Initialize a temporary logger for the config loading phase.
    // This allows logging before the final config is ready.
    const tempLogger = createLogger({
        level: process.env.ASC_LOGGING_LEVEL ?? 'info',
        pretty: process.env.ASC_LOGGING_PRETTY === 'true',
        name: 'ASC-ConfigLoader'
    });

    try {
      // 1. Load .env file (for local development)
      const projectRoot = findProjectRoot();
      dotenv.config({ path: path.join(projectRoot, '.env') });
      tempLogger.info('Loaded environment variables from .env file (if present).');

      // 2. Determine config file path
      const configPath = process.env.ASC_CONFIG_PATH
        ? path.resolve(process.env.ASC_CONFIG_PATH)
        : path.join(projectRoot, 'config', 'config.json');

      // 3. Load from file
      const fileConfig = await loadFromFile(configPath);
      tempLogger.info({ path: configPath }, 'Loaded configuration from file.');

      // 4. Merge environment variables (overwriting file config)
      const mergedConfig = mergeFromEnv(fileConfig);
      tempLogger.info('Merged configuration with environment variables.');

      // 5. Validate and apply defaults
      const { isValid, errors } = validate('asc/config', mergedConfig);
      if (!isValid) {
        tempLogger.fatal({ errors }, 'Configuration validation failed.');
        throw new Error(`Invalid configuration: ${errors}`);
      }

      // The validator modifies the object in place to add default values.
      configInstance = mergedConfig;
      tempLogger.info('Configuration successfully loaded and validated.');

      // Re-initialize the main logger with the final, validated configuration
      createLogger(configInstance.logging);
      getLogger().info('Logger re-initialized with final configuration.');

      return configInstance;
    } catch (error) {
      tempLogger.fatal({ err: error }, 'A critical error occurred during configuration loading.');
      // In case of a fatal config error, we should exit.
      process.exit(1);
    }
  })();

  return loadConfigPromise;
}

/**
 * Retrieves the singleton configuration object.
 *
 * If the configuration has not been loaded yet, this function will throw an error.
 * This enforces a pattern where `loadConfig()` must be called and awaited at the
 * application's entry point before any other module attempts to access the config.
 *
 * @throws {Error} If the configuration has not been initialized via `loadConfig()`.
 * @returns {object} The singleton configuration object.
 */
export function getConfig() {
  if (!configInstance) {
    throw new Error(
      'Configuration not initialized. Please call and await loadConfig() in your application entry point.',
    );
  }
  return configInstance;
}