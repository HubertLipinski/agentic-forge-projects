/**
 * @file src/config/loader.js
 * @description Loads and parses the .yml configuration file from a specified path, using the validator.
 *
 * This module is responsible for the I/O and parsing of the configuration file.
 * It reads the file content, uses `js-yaml` to parse it into a JavaScript object,
 * and then leverages the `validator` module to ensure the configuration's integrity.
 * It also defines and exports default configuration values that are merged with the
 * user-provided configuration, ensuring that the application can always run with a
 * sensible baseline.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { validateConfig } from './validator.js';
import logger from '../utils/logger.js';

/**
 * Default configuration values.
 * These are merged with the user's configuration to provide sensible fallbacks.
 *
 * - `merge`: The default merge strategy is 'merge'.
 * - `checks`: The default policy for CI checks is 'stable', which is safer than 'all' as it
 *   accommodates non-required, informational checks that might be pending or neutral.
 *
 * @type {Readonly<object>}
 */
const DEFAULT_RULE_CONFIG = Object.freeze({
  merge: 'merge',
  checks: 'stable',
});

/**
 * Merges user-defined rules with default values.
 * This ensures that each rule has a defined `merge` strategy and `checks` policy,
 * even if not explicitly specified by the user.
 *
 * @param {object[]} rules - The array of rule objects from the user's configuration.
 * @returns {object[]} A new array of rules with defaults applied.
 */
function applyDefaultRuleValues(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }
  // Use structuredClone for a deep copy to avoid mutating the original config object
  const clonedRules = structuredClone(rules);
  return clonedRules.map(rule => ({ ...DEFAULT_RULE_CONFIG, ...rule }));
}

/**
 * Loads, parses, and validates the configuration file from the given path.
 *
 * @param {string} configPath - The relative or absolute path to the configuration file.
 * @returns {Promise<object|null>} A promise that resolves to the validated and processed
 * configuration object, or `null` if the file cannot be read or is invalid.
 */
export async function loadConfig(configPath) {
  const absolutePath = path.resolve(process.cwd(), configPath);
  logger.info(`Attempting to load configuration from: ${absolutePath}`);

  let fileContent;
  try {
    fileContent = await readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.error(`Configuration file not found at path: ${absolutePath}`);
    } else {
      logger.error(`Failed to read configuration file: ${absolutePath}`, error);
    }
    return null;
  }

  let parsedConfig;
  try {
    parsedConfig = yaml.load(fileContent);
    // Handle empty or commented-out files which parse to null or undefined
    if (parsedConfig == null) {
      logger.error('Configuration file is empty or contains only comments.');
      return null;
    }
  } catch (error) {
    logger.error(`Failed to parse YAML in configuration file: ${absolutePath}`, error);
    return null;
  }

  const { isValid, errors } = validateConfig(parsedConfig);

  if (!isValid) {
    logger.error('Configuration validation failed with the following errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    return null;
  }

  logger.success('Configuration loaded and validated successfully.');

  // Apply default values to each rule for consistency
  const processedRules = applyDefaultRuleValues(parsedConfig.rules);

  return {
    ...parsedConfig,
    rules: processedRules,
  };
}