import { promises as fs } from 'node:fs';
import path from 'node:path';
import { findUp } from 'find-up';

/**
 * The name of the configuration file to search for.
 * @type {string}
 */
const CONFIG_FILE_NAME = '.blamesifterrc.json';

/**
 * The prefix for environment variables.
 * @type {string}
 */
const ENV_VAR_PREFIX = 'BLAME_SIFTER_';

/**
 * Default configuration values for the application.
 * These are the lowest precedence settings.
 *
 * @type {object}
 */
const DEFAULT_CONFIG = {
  // Rule configurations
  commitMessage: '^(chore|style|refactor|test|build|ci)(\\(.+\\))?:',
  ignoreAuthors: [],
  ignoreRevs: [],
  isTrivial: true,

  // File matching patterns
  include: ['**/*'],
  exclude: ['**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml'],

  // Output and behavior
  format: 'standard',
  'follow-aliases': true,
  'show-progress': true,
  interactive: false,

  // Command-specific options
  'blame-args': '',
};

/**
 * Finds and parses the `.blamesifterrc.json` configuration file.
 * It searches upwards from the given directory (or current working directory).
 *
 * @param {string} [searchFrom=process.cwd()] - The directory to start searching from.
 * @returns {Promise<object>} The parsed configuration object, or an empty object if not found.
 * @throws {Error} If the config file is found but is malformed JSON.
 */
async function loadConfigFromFile(searchFrom = process.cwd()) {
  const configPath = await findUp(CONFIG_FILE_NAME, { cwd: searchFrom });

  if (!configPath) {
    return {};
  }

  try {
    const fileContent = await fs.readFile(configPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Error parsing configuration file at ${configPath}: ${error.message}`);
    }
    // Handle file read errors (e.g., permissions)
    throw new Error(`Error reading configuration file at ${configPath}: ${error.message}`);
  }
}

/**
 * Loads configuration from environment variables.
 * Maps variables like `BLAME_SIFTER_COMMIT_MESSAGE` to `commitMessage`.
 *
 * @returns {object} An object containing configuration values from the environment.
 */
function loadConfigFromEnv() {
  const envConfig = {};
  for (const envVar in process.env) {
    if (envVar.startsWith(ENV_VAR_PREFIX)) {
      const key = envVar
        .substring(ENV_VAR_PREFIX.length)
        .toLowerCase()
        .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

      const value = process.env[envVar];

      // Attempt to parse JSON for arrays/booleans, otherwise use as string
      try {
        envConfig[key] = JSON.parse(value);
      } catch {
        envConfig[key] = value;
      }
    }
  }
  return envConfig;
}

/**
 * Converts kebab-case CLI arguments to camelCase to match internal config keys.
 *
 * @param {object} cliArgs - The arguments object from a CLI parser like yargs.
 * @returns {object} A new object with keys converted to camelCase.
 */
function normalizeCliArgs(cliArgs) {
  const normalized = {};
  for (const key in cliArgs) {
    // yargs provides both kebab-case and camelCase; we only want one.
    // We also skip special yargs keys `_` and `$0`.
    if (key.includes('-') || key === '_' || key === '$0') {
      continue;
    }
    normalized[key] = cliArgs[key];
  }
  return normalized;
}

/**
 * Loads and merges configuration from multiple sources with a defined precedence.
 * The precedence order is: CLI arguments > Environment variables > `.blamesifterrc.json` > Default values.
 *
 * @param {object} cliArgs - The raw arguments object from the CLI parser (e.g., yargs.argv).
 * @param {string} [searchPath=process.cwd()] - The directory to start searching for the config file.
 * @returns {Promise<object>} A promise that resolves to the final, merged configuration object.
 */
export async function loadConfig(cliArgs, searchPath = process.cwd()) {
  // 1. Start with default configuration (lowest precedence)
  const defaults = structuredClone(DEFAULT_CONFIG);

  // 2. Load config from `.blamesifterrc.json` file
  const fileConfig = await loadConfigFromFile(searchPath);

  // 3. Load config from environment variables
  const envConfig = loadConfigFromEnv();

  // 4. Normalize CLI arguments (highest precedence)
  const normalizedCli = normalizeCliArgs(cliArgs);

  // 5. Merge all configurations
  // The order of spreading ensures correct precedence.
  const finalConfig = {
    ...defaults,
    ...fileConfig,
    ...envConfig,
    ...normalizedCli,
  };

  return finalConfig;
}