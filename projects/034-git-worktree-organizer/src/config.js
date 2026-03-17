import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { getGitRoot } from './utils/git.js';

/**
 * @typedef {object} GwoConfig
 * @property {string} worktreeDir - The directory where worktrees are stored, relative to the git root.
 */

/**
 * The name of the configuration file.
 * @type {string}
 */
const CONFIG_FILE_NAME = '.gworc';

/**
 * Default configuration values.
 * These are used if a config file is not found or a specific key is missing.
 * @type {GwoConfig}
 */
const DEFAULT_CONFIG = {
  worktreeDir: '.gwo',
};

/**
 * A custom error class for configuration-related issues.
 * This helps in distinguishing config errors from other runtime errors.
 */
class ConfigError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Error} [cause] - The original error that caused this one.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'ConfigError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Finds the absolute path to the configuration file (`.gworc`) in the git repository's root.
 *
 * @returns {Promise<string>} A promise that resolves with the absolute path to the config file.
 * @throws {import('./utils/git.js').GitError} If not inside a Git repository.
 */
async function getConfigFilePath() {
  const gitRoot = await getGitRoot();
  return resolve(gitRoot, CONFIG_FILE_NAME);
}

/**
 * Loads the configuration from the `.gworc` file in the project's root directory.
 * If the file doesn't exist, it returns the default configuration.
 * If the file is invalid JSON, it throws a `ConfigError`.
 *
 * @returns {Promise<GwoConfig>} A promise that resolves to the merged configuration object.
 * @throws {ConfigError} If the configuration file is malformed.
 */
export async function loadConfig() {
  const configPath = await getConfigFilePath();

  try {
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(fileContent);

    // Validate the parsed user config to ensure it's an object
    if (userConfig === null || typeof userConfig !== 'object' || Array.isArray(userConfig)) {
      throw new ConfigError(`Invalid configuration format in ${configPath}. Expected a JSON object.`);
    }

    // Merge defaults with user-provided config. User config takes precedence.
    const mergedConfig = { ...DEFAULT_CONFIG, ...userConfig };

    // Perform basic validation on critical keys
    if (typeof mergedConfig.worktreeDir !== 'string' || mergedConfig.worktreeDir.trim() === '') {
      throw new ConfigError(`Invalid 'worktreeDir' value in ${configPath}. It must be a non-empty string.`);
    }

    return mergedConfig;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Config file does not exist, which is a valid state. Return defaults.
      return { ...DEFAULT_CONFIG };
    }
    if (error instanceof SyntaxError) {
      // JSON parsing failed
      throw new ConfigError(`Failed to parse JSON in ${configPath}. Please check for syntax errors.`, error);
    }
    // Re-throw other errors, including our own ConfigError from validation
    throw error;
  }
}

/**
 * Saves a configuration object to the `.gworc` file in the project's root.
 * This will overwrite any existing configuration file.
 *
 * @param {Partial<GwoConfig>} configData - The configuration object to save.
 * @returns {Promise<void>} A promise that resolves when the file has been written.
 * @throws {ConfigError} If the data cannot be written.
 */
export async function saveConfig(configData) {
  const configPath = await getConfigFilePath();
  try {
    // The `null, 2` arguments format the JSON with an indentation of 2 spaces for readability.
    const fileContent = JSON.stringify(configData, null, 2);
    await fs.writeFile(configPath, fileContent, 'utf-8');
  } catch (error) {
    throw new ConfigError(`Failed to write configuration to ${configPath}.`, error);
  }
}