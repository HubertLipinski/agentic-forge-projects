/**
 * @file src/config-loader.js
 * @description Loads and validates the configuration from a JSON file, providing
 * defaults for sensitivity, time windows, and alert outputs.
 *
 * This module ensures that the application runs with a valid and complete
 * configuration, whether it's provided by a user file or by falling back
 * to sensible default values. It performs validation to catch common errors early.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {import('./alerter.js').AlerterConfig} AlerterConfig
 */

/**
 * @typedef {object} FrequencyAnalyzerConfig
 * @property {number} timeWindow - The time window in seconds to analyze log frequency.
 * @property {number} burstMultiplier - Factor by which current rate must exceed moving average to be a burst.
 * @property {number} minLogCount - Minimum logs in the window to trigger a burst anomaly.
 */

/**
 * @typedef {object} PatternAnalyzerConfig
 * @property {boolean} enabled - Whether to detect new, unseen log patterns.
 */

/**
 * @typedef {object} LogWatcherConfig
 * @property {string[]} paths - An array of file or directory paths to watch.
 * @property {number} maxConcurrentFileReads - The maximum number of files to process concurrently.
 */

/**
 * @typedef {object} AppConfig
 * @property {LogWatcherConfig} watcher - Configuration for the log file watcher.
 * @property {FrequencyAnalyzerConfig} frequencyAnalysis - Configuration for the frequency burst analyzer.
 * @property {PatternAnalyzerConfig} patternAnalysis - Configuration for the new pattern analyzer.
 * @property {AlerterConfig} alerter - Configuration for where to send alerts.
 * @property {number} pruneInterval - The interval in seconds for pruning old state data.
 */

/**
 * Defines the default configuration for the application.
 * These values are used when a user-provided configuration file
 * is missing or does not specify certain options.
 *
 * @type {AppConfig}
 */
const DEFAULT_CONFIG = {
  watcher: {
    paths: [], // Must be provided by the user via CLI or config file.
    maxConcurrentFileReads: 10,
  },
  frequencyAnalysis: {
    timeWindow: 60, // 60 seconds
    burstMultiplier: 10, // 10x the moving average
    minLogCount: 50, // At least 50 logs in the window to trigger
  },
  patternAnalysis: {
    enabled: true,
  },
  alerter: {
    output: 'stdout', // 'stdout' or 'file'
    filePath: './alerts.log',
  },
  pruneInterval: 300, // 5 minutes
};

/**
 * Deeply merges a user-provided configuration object into the default configuration.
 * It creates a new object, preserving the defaults for any keys not present in the user config.
 *
 * @param {object} userConfig - The partial or complete configuration from the user.
 * @returns {AppConfig} The final, merged configuration object.
 * @private
 */
function mergeConfigs(userConfig) {
  // Use structuredClone for a deep copy to avoid modifying the original DEFAULT_CONFIG object.
  const merged = structuredClone(DEFAULT_CONFIG);

  // A simple recursive merge helper.
  const merge = (target, source) => {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            Object.assign(target, { [key]: {} });
          }
          merge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
  };

  merge(merged, userConfig);
  return merged;
}

/**
 * Validates the final merged configuration to ensure all values are sane and of the correct type.
 * Throws a descriptive error if validation fails.
 *
 * @param {AppConfig} config - The configuration object to validate.
 * @throws {Error} If the configuration is invalid.
 * @private
 */
function validateConfig(config) {
  if (!Array.isArray(config.watcher.paths) || config.watcher.paths.length === 0) {
    throw new Error('Configuration Error: At least one log file or directory path must be specified in `watcher.paths`.');
  }

  if (typeof config.watcher.maxConcurrentFileReads !== 'number' || config.watcher.maxConcurrentFileReads < 1) {
    throw new Error('Configuration Error: `watcher.maxConcurrentFileReads` must be a number greater than 0.');
  }

  if (typeof config.frequencyAnalysis.timeWindow !== 'number' || config.frequencyAnalysis.timeWindow <= 0) {
    throw new Error('Configuration Error: `frequencyAnalysis.timeWindow` must be a positive number (seconds).');
  }

  if (typeof config.frequencyAnalysis.burstMultiplier !== 'number' || config.frequencyAnalysis.burstMultiplier <= 1) {
    throw new Error('Configuration Error: `frequencyAnalysis.burstMultiplier` must be a number greater than 1.');
  }

  if (typeof config.frequencyAnalysis.minLogCount !== 'number' || config.frequencyAnalysis.minLogCount < 0) {
    throw new Error('Configuration Error: `frequencyAnalysis.minLogCount` must be a non-negative number.');
  }

  if (typeof config.patternAnalysis.enabled !== 'boolean') {
    throw new Error('Configuration Error: `patternAnalysis.enabled` must be a boolean (true or false).');
  }

  if (config.alerter.output !== 'stdout' && config.alerter.output !== 'file') {
    throw new Error('Configuration Error: `alerter.output` must be either "stdout" or "file".');
  }

  if (config.alerter.output === 'file' && (typeof config.alerter.filePath !== 'string' || config.alerter.filePath.trim() === '')) {
    throw new Error('Configuration Error: `alerter.filePath` must be a valid path string when `alerter.output` is "file".');
  }

  if (typeof config.pruneInterval !== 'number' || config.pruneInterval <= 0) {
    throw new Error('Configuration Error: `pruneInterval` must be a positive number (seconds).');
  }
}

/**
 * Loads, merges, and validates the application configuration.
 *
 * The process is as follows:
 * 1. If a `configPath` is provided, it attempts to read and parse the JSON file.
 * 2. It merges the loaded configuration (if any) with the default configuration.
 * 3. It merges any `cliOverrides` (e.g., --file from command line) on top of that.
 * 4. It validates the final, merged configuration to ensure it's usable.
 *
 * @param {string | null} configPath - The absolute or relative path to a JSON configuration file.
 * @param {object} [cliOverrides={}] - An object with configuration values provided via CLI arguments, which take the highest precedence.
 * @returns {Promise<AppConfig>} A promise that resolves with the final, validated configuration object.
 * @throws {Error} If the config file cannot be read, is not valid JSON, or the final config fails validation.
 */
export async function loadConfig(configPath, cliOverrides = {}) {
  let userConfig = {};

  if (configPath) {
    try {
      const resolvedPath = path.resolve(process.cwd(), configPath);
      const fileContent = await fs.readFile(resolvedPath, 'utf-8');
      userConfig = JSON.parse(fileContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Configuration file not found at: ${configPath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file ${configPath}: ${error.message}`);
      }
      throw new Error(`Failed to read configuration file ${configPath}: ${error.message}`);
    }
  }

  // Merge order: defaults -> file config -> CLI overrides
  const mergedFromFile = mergeConfigs(userConfig);
  const finalConfig = mergeConfigs(mergedFromFile, cliOverrides);

  // If CLI provides `file` or `files` argument, it should populate `watcher.paths`.
  // This is a common override pattern.
  const cliPaths = cliOverrides.file || cliOverrides.files;
  if (cliPaths) {
    finalConfig.watcher.paths = Array.isArray(cliPaths) ? cliPaths : [cliPaths];
  }

  try {
    validateConfig(finalConfig);
  } catch (validationError) {
    // Re-throw validation errors to be handled by the application's entry point.
    throw validationError;
  }

  return finalConfig;
}