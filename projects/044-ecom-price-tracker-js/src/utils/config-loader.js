import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import siteConfigSchema from '../../config/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the absolute path to the 'sites' directory relative to this file.
// This makes the path resolution robust, regardless of where the script is run from.
const SITES_DIR = path.resolve(__dirname, '..', '..', 'sites');
const SUPPORTED_EXTENSIONS = ['.yaml', '.yml', '.json'];

/**
 * Custom error class for configuration-related issues.
 * This helps in distinguishing configuration errors from other operational errors.
 */
class ConfigError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [details] Additional details, like filename or validation errors.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ConfigError';
    this.details = details;
  }
}

/**
 * Validates a single site configuration object against the master schema.
 * Throws a ConfigError with detailed validation issues if the config is invalid.
 *
 * @param {object} config The parsed site configuration object.
 * @param {string} filename The name of the file from which the config was loaded.
 * @throws {ConfigError} If validation fails.
 */
const validateSiteConfig = (config, filename) => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(siteConfigSchema);
  const isValid = validate(config);

  if (!isValid) {
    const errorDetails = validate.errors
      .map(err => `  - ${err.instancePath || 'root'} ${err.message}`)
      .join('\n');
    throw new ConfigError(
      `Invalid configuration in '${filename}':\n${errorDetails}`,
      { filename, errors: validate.errors }
    );
  }
};

/**
 * Parses the raw content of a configuration file based on its extension.
 * Supports YAML (.yaml, .yml) and JSON (.json).
 *
 * @param {string} content The raw file content as a string.
 * @param {string} filename The name of the file for context in error messages.
 * @returns {object} The parsed configuration object.
 * @throws {ConfigError} If parsing fails or the file extension is unsupported.
 */
const parseConfigContent = (content, filename) => {
  const extension = path.extname(filename).toLowerCase();

  try {
    if (extension === '.json') {
      return JSON.parse(content);
    }
    if (extension === '.yaml' || extension === '.yml') {
      return yaml.load(content);
    }
  } catch (error) {
    throw new ConfigError(`Failed to parse configuration file '${filename}'.`, {
      filename,
      cause: error,
    });
  }

  // This case should ideally not be reached if the file filtering is correct.
  throw new ConfigError(`Unsupported configuration file format: '${filename}'.`);
};

/**
 * Loads, parses, and validates a single site configuration file.
 *
 * @param {string} filePath The absolute path to the configuration file.
 * @returns {Promise<object>} A promise that resolves to the validated configuration object.
 * @throws {ConfigError} If the file cannot be read, parsed, or validated.
 */
const loadAndValidateFile = async (filePath) => {
  const filename = path.basename(filePath);
  let content;

  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new ConfigError(`Could not read configuration file '${filename}'.`, {
      filename,
      cause: error,
    });
  }

  const config = parseConfigContent(content, filename);
  validateSiteConfig(config, filename);

  return config;
};

/**
 * Loads, parses, and validates all site configuration files from the `sites/` directory.
 * It identifies files by their extension, reads them, and validates against the schema.
 *
 * @returns {Promise<object[]>} A promise that resolves to an array of validated site configuration objects.
 * @throws {Error} If the `sites` directory cannot be accessed or contains no valid config files.
 */
export const loadSiteConfigs = async () => {
  let files;
  try {
    files = await fs.readdir(SITES_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration directory not found: ${SITES_DIR}`);
    }
    throw new Error(`Failed to read configuration directory: ${SITES_DIR}`, {
      cause: error,
    });
  }

  const configFiles = files.filter(file =>
    SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase())
  );

  if (configFiles.length === 0) {
    console.warn(`Warning: No configuration files found in ${SITES_DIR}. The scraper will have no sites to process.`);
    return [];
  }

  const configPromises = configFiles.map(file =>
    loadAndValidateFile(path.join(SITES_DIR, file))
  );

  // Using Promise.allSettled to gather all results, including errors,
  // allowing us to report all invalid configs at once.
  const results = await Promise.allSettled(configPromises);

  const validConfigs = [];
  const errors = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      validConfigs.push(result.value);
    } else {
      // Log specific config errors for better debugging.
      console.error(result.reason.message);
      errors.push(result.reason);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Failed to load ${errors.length} site configuration(s). Please check the logs above for details.`
    );
  }

  return validConfigs;
};