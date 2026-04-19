/**
 * @file src/config/config-loader.js
 * @description Responsible for loading and merging configuration from a
 * `.linkcheckerrc.json` file and CLI arguments.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_TIMEOUT,
  DEFAULT_REQUEST_DELAY,
  DEFAULT_USER_AGENT,
  CONFIG_FILE_NAME,
} from '../util/constants.js';
import logger from '../util/logger.js';

/**
 * @typedef {object} AppConfig
 * @property {number} timeout - The timeout for HTTP/S requests in milliseconds.
 * @property {number} requestDelay - The delay between HTTP/S requests in milliseconds.
 * @property {string} userAgent - The User-Agent string for HTTP/S requests.
 * @property {string[]} ignorePatterns - An array of URL patterns (as strings) to ignore.
 * @property {RegExp[]} ignore - An array of compiled RegExp objects from ignorePatterns.
 */

/**
 * Defines the default configuration values for the application.
 * These are used as a base and can be overridden by a config file or CLI args.
 *
 * @returns {AppConfig} The default configuration object.
 */
function getDefaultConfig() {
  return {
    timeout: DEFAULT_TIMEOUT,
    requestDelay: DEFAULT_REQUEST_DELAY,
    userAgent: DEFAULT_USER_AGENT,
    ignorePatterns: [],
    ignore: [],
  };
}

/**
 * Loads configuration from a `.linkcheckerrc.json` file in the specified directory.
 * If the file doesn't exist, it returns an empty object.
 * If the file is malformed, it logs a warning and returns an empty object.
 *
 * @param {string} [basePath=process.cwd()] - The directory to search for the config file.
 * @returns {Promise<Partial<AppConfig>>} A promise that resolves to the configuration object from the file.
 */
async function loadConfigFile(basePath = process.cwd()) {
  const configPath = path.resolve(basePath, CONFIG_FILE_NAME);

  try {
    const fileContent = await fs.readFile(configPath, 'utf8');
    try {
      return JSON.parse(fileContent);
    } catch (parseError) {
      logger.warn(`Could not parse ${CONFIG_FILE_NAME}: ${parseError.message}. Using defaults.`);
      return {};
    }
  } catch (readError) {
    // If the file doesn't exist (ENOENT), it's not an error, just no config file.
    // For any other error (e.g., permissions), log a warning.
    if (readError.code !== 'ENOENT') {
      logger.warn(`Could not read ${CONFIG_FILE_NAME}: ${readError.message}. Using defaults.`);
    }
    return {};
  }
}

/**
 * Parses CLI arguments and maps them to a configuration object.
 * This function handles aliases and type conversions.
 *
 * @param {object} cliArgs - The raw arguments object from a parser like yargs-parser.
 * @returns {Partial<AppConfig>} A configuration object derived from CLI arguments.
 */
function parseCliArgs(cliArgs) {
  const config = {};

  if (cliArgs.timeout) {
    config.timeout = Number(cliArgs.timeout);
  }
  if (cliArgs['request-delay']) {
    config.requestDelay = Number(cliArgs['request-delay']);
  }
  if (cliArgs['user-agent']) {
    config.userAgent = cliArgs['user-agent'];
  }

  // The 'ignore' argument can be a single value or an array.
  // We normalize it to always be an array.
  if (cliArgs.ignore) {
    config.ignorePatterns = Array.isArray(cliArgs.ignore) ? cliArgs.ignore : [cliArgs.ignore];
  }

  return config;
}

/**
 * Compiles string-based regex patterns into actual RegExp objects.
 * Invalid patterns are logged and skipped.
 *
 * @param {string[]} patterns - An array of string patterns.
 * @returns {RegExp[]} An array of compiled RegExp objects.
 */
function compileIgnorePatterns(patterns = []) {
  if (!patterns || patterns.length === 0) {
    return [];
  }

  return patterns.reduce((acc, pattern) => {
    try {
      acc.push(new RegExp(pattern));
    } catch (e) {
      logger.warn(`Invalid ignore pattern regex: "${pattern}". Skipping.`);
    }
    return acc;
  }, []);
}

/**
 * Loads and merges configurations from defaults, a config file, and CLI arguments.
 * The merge order is: Defaults < Config File < CLI Arguments.
 *
 * @param {object} cliArgs - The raw arguments object from a parser like yargs-parser.
 * @returns {Promise<AppConfig>} A promise that resolves to the final, merged configuration object.
 */
export async function loadConfig(cliArgs = {}) {
  const defaultConfig = getDefaultConfig();
  const fileConfig = await loadConfigFile();
  const parsedCliConfig = parseCliArgs(cliArgs);

  // Merge configurations. `parsedCliConfig` values overwrite `fileConfig`,
  // which overwrite `defaultConfig`. Nullish coalescing is used to ensure
  // that a value of `0` or `false` from a higher-priority source is not
  // ignored.
  const mergedConfig = {
    ...defaultConfig,
    ...fileConfig,
    ...parsedCliConfig,
  };

  // The `ignorePatterns` array needs special handling to merge, not just overwrite.
  // We combine patterns from both file and CLI args, removing duplicates.
  const allIgnorePatterns = [
    ...(fileConfig.ignorePatterns || []),
    ...(parsedCliConfig.ignorePatterns || []),
  ];
  mergedConfig.ignorePatterns = [...new Set(allIgnorePatterns)];

  // Compile the final list of ignore patterns into RegExp objects.
  mergedConfig.ignore = compileIgnorePatterns(mergedConfig.ignorePatterns);

  return mergedConfig;
}