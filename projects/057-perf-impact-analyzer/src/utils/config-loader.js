import fs from 'node:fs/promises';
import path from 'node:path';
import logger from './logger.js';

/**
 * @fileoverview Loads and validates the project-specific `.perf-impact-analyzer.json` configuration file.
 * This module is responsible for finding, reading, parsing, and validating the configuration
 * required to run the performance analysis. It also provides sensible defaults for optional settings.
 */

const DEFAULT_CONFIG_FILENAME = '.perf-impact-analyzer.json';

/**
 * Defines the default configuration values. These are merged with the user's
 * configuration, ensuring that all necessary options have a value.
 */
const DEFAULTS = {
  runs: 5,
  regressionThreshold: -5.0,
  failOnRegression: true,
  json: false,
};

/**
 * Validates the structure and types of the loaded configuration object.
 * Throws an error if the configuration is invalid, providing a clear
 * message about what is wrong.
 *
 * @param {object} config - The configuration object to validate.
 * @throws {Error} If the configuration is invalid.
 */
const validateConfig = (config) => {
  if (!config.benchmarkCommand || typeof config.benchmarkCommand !== 'string') {
    throw new Error('Configuration error: `benchmarkCommand` must be a non-empty string.');
  }

  if (!config.metrics || !Array.isArray(config.metrics) || config.metrics.length === 0) {
    throw new Error('Configuration error: `metrics` must be a non-empty array.');
  }

  for (const [index, metric] of config.metrics.entries()) {
    if (!metric.name || typeof metric.name !== 'string') {
      throw new Error(`Configuration error: Metric at index ${index} is missing a 'name' string.`);
    }
    if (!metric.regex || typeof metric.regex !== 'string') {
      throw new Error(`Configuration error: Metric "${metric.name}" is missing a 'regex' string.`);
    }
    try {
      // Test if the regex is valid.
      // eslint-disable-next-line no-new
      new RegExp(metric.regex);
    } catch (e) {
      throw new Error(`Configuration error: Metric "${metric.name}" has an invalid regular expression: ${e.message}`);
    }
  }

  if (typeof config.runs !== 'number' || !Number.isInteger(config.runs) || config.runs < 1) {
    throw new Error('Configuration error: `runs` must be an integer greater than or equal to 1.');
  }

  if (typeof config.regressionThreshold !== 'number') {
    throw new Error('Configuration error: `regressionThreshold` must be a number (e.g., -5.0 for a 5% drop).');
  }

  if (typeof config.failOnRegression !== 'boolean') {
    throw new Error('Configuration error: `failOnRegression` must be a boolean.');
  }
};

/**
 * Loads, parses, and validates the configuration file.
 * It searches for `.perf-impact-analyzer.json` in the specified directory,
 * merges it with default values, and validates the final configuration.
 *
 * @param {string} [configPath] - Optional path to a specific config file. If not provided,
 *   it searches for `.perf-impact-analyzer.json` in the current working directory.
 * @returns {Promise<object>} A promise that resolves to the validated configuration object.
 * @throws {Error} If the config file is not found, cannot be parsed, or is invalid.
 */
export async function loadConfig(configPath) {
  const resolvedPath = configPath
    ? path.resolve(process.cwd(), configPath)
    : path.resolve(process.cwd(), DEFAULT_CONFIG_FILENAME);

  logger.debug(`Attempting to load configuration from: ${logger.style.path(resolvedPath)}`);

  let rawConfig;
  try {
    rawConfig = await fs.readFile(resolvedPath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Configuration file not found at ${logger.style.path(resolvedPath)}. Please create a '${DEFAULT_CONFIG_FILENAME}' file or specify a path with the --config option.`
      );
    }
    throw new Error(`Failed to read configuration file: ${error.message}`);
  }

  let userConfig;
  try {
    userConfig = JSON.parse(rawConfig);
  } catch (error) {
    throw new Error(`Failed to parse JSON in configuration file ${logger.style.path(resolvedPath)}: ${error.message}`);
  }

  // Merge user config with defaults. User's values take precedence.
  const mergedConfig = { ...DEFAULTS, ...userConfig };

  try {
    validateConfig(mergedConfig);
  } catch (error) {
    // Re-throw validation errors as they are already descriptive.
    throw error;
  }

  logger.debug('Configuration loaded and validated successfully.');
  return mergedConfig;
}