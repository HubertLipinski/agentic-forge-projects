import path from 'node:path';
import { readFile } from 'node:fs/promises';
import logger from '../ui/logger.js';

/**
 * @typedef {object} Config
 * @property {boolean} dryRun - If true, don't create tags or push.
 * @property {boolean} push - If true, push the new tag to the remote.
 * @property {string|boolean} prerelease - Prerelease identifier (e.g., 'alpha', 'rc').
 * @property {string} tagPrefix - Prefix for Git tags (e.g., 'v').
 * @property {string} remote - The Git remote to push to.
 * @property {string} changelogTitle - The title for the changelog section in the tag annotation.
 */

/**
 * Default configuration values.
 * These are the lowest priority and will be overridden by file or CLI configs.
 * @type {Config}
 */
const defaultConfig = {
  dryRun: false,
  push: false,
  prerelease: false,
  tagPrefix: 'v',
  remote: 'origin',
  changelogTitle: '# Changelog\n\n',
};

/**
 * Finds and reads a configuration file from the current working directory.
 * It first looks for a `.semverrc` file, then falls back to `package.json`.
 *
 * @param {string} cwd - The current working directory.
 * @returns {Promise<object|null>} The parsed configuration object, or null if no config file is found.
 */
async function loadConfigFromFile(cwd) {
  const semverrcPath = path.join(cwd, '.semverrc');

  try {
    const fileContent = await readFile(semverrcPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    // If .semverrc is not found or is unreadable, we silently proceed to check package.json
    if (error.code !== 'ENOENT') {
      logger.warn(`Could not read or parse .semverrc file: ${error.message}`);
    }
  }

  const packageJsonPath = path.join(cwd, 'package.json');
  try {
    const fileContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(fileContent);
    // The config can be under a specific key, e.g., "auto-semver-tagger"
    if (packageJson['auto-semver-tagger'] && typeof packageJson['auto-semver-tagger'] === 'object') {
      return packageJson['auto-semver-tagger'];
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`Could not read or parse package.json file: ${error.message}`);
    }
  }

  return null;
}

/**
 * Filters out undefined, null, and empty string values from the CLI arguments object.
 * This ensures that only explicitly provided CLI arguments are used for merging.
 *
 * @param {object} cliArgs - The arguments object from yargs.
 * @returns {object} A cleaned object with only defined CLI arguments.
 */
function cleanCliArgs(cliArgs) {
  const cleaned = {};
  for (const key in cliArgs) {
    // We check for `hasOwnProperty` and also filter out yargs' special keys '$0' and '_'
    if (Object.prototype.hasOwnProperty.call(cliArgs, key) && key !== '$0' && key !== '_') {
      const value = cliArgs[key];
      // Only include if the value is not nullish.
      // An empty string for `prerelease` is a valid value, so we don't filter it.
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}


/**
 * Loads and merges configurations from multiple sources.
 * The order of precedence is: CLI arguments > file config > default config.
 *
 * @param {object} cliArgs - The command-line arguments parsed by yargs.
 * @returns {Promise<Config>} The final, merged configuration object.
 */
export async function loadConfig(cliArgs) {
  const cwd = process.cwd();
  const fileConfig = await loadConfigFromFile(cwd) || {};
  const cleanedCliArgs = cleanCliArgs(cliArgs);

  // Merge configurations with the correct precedence.
  // `cleanedCliArgs` has the highest priority.
  const finalConfig = {
    ...defaultConfig,
    ...fileConfig,
    ...cleanedCliArgs,
  };

  // Ensure boolean values are correctly interpreted.
  // Yargs handles this well, but this is a defensive measure.
  finalConfig.dryRun = !!finalConfig.dryRun;
  finalConfig.push = !!finalConfig.push;

  // The `prerelease` flag can be a boolean (from CLI flag with no value) or a string.
  // If it's `true`, we default it to a standard prerelease identifier.
  if (finalConfig.prerelease === true) {
    finalConfig.prerelease = 'rc'; // Default pre-release name if flag is just present
  }

  return finalConfig;
}