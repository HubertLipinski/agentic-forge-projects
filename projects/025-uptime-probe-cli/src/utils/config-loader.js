import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

/**
 * @typedef {object} EndpointConfig
 * @property {string} name - A unique, human-readable name for the endpoint.
 * @property {string} url - The full URL to probe (e.g., 'https://api.example.com/health').
 * @property {string} [method='GET'] - The HTTP method to use.
 * @property {Object.<string, string>} [headers] - Custom headers to send with the request.
 * @property {number} [timeout=10000] - Request timeout in milliseconds.
 */

/**
 * @typedef {object} ProbeConfig
 * @property {number} interval - The polling interval in seconds.
 * @property {EndpointConfig[]} endpoints - A list of endpoints to monitor.
 */

const DEFAULT_INTERVAL_SECONDS = 60;
const MIN_INTERVAL_SECONDS = 5;

/**
 * Validates the structure and content of a single endpoint configuration.
 * Throws a detailed error if validation fails.
 *
 * @param {any} endpoint - The endpoint object to validate.
 * @param {number} index - The index of the endpoint in the array, for error reporting.
 * @throws {Error} If the endpoint configuration is invalid.
 */
function validateEndpoint(endpoint, index) {
  if (typeof endpoint !== 'object' || endpoint === null || Array.isArray(endpoint)) {
    throw new Error(`Endpoint at index ${index} must be an object.`);
  }

  const { name, url, method, headers, timeout } = endpoint;

  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`Endpoint at index ${index} must have a non-empty 'name' string.`);
  }

  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error(`Endpoint "${name}" must have a non-empty 'url' string.`);
  }

  try {
    // Use URL constructor for robust validation
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (e) {
    throw new Error(`Endpoint "${name}" has an invalid 'url': ${url}`);
  }

  if (method !== undefined && typeof method !== 'string') {
    throw new Error(`Endpoint "${name}" has an invalid 'method'. It must be a string (e.g., 'GET', 'POST').`);
  }

  if (headers !== undefined) {
    if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) {
      throw new Error(`Endpoint "${name}" has invalid 'headers'. It must be an object of key-value pairs.`);
    }
    for (const key in headers) {
      if (typeof headers[key] !== 'string') {
        throw new Error(`Endpoint "${name}" has an invalid header value for '${key}'. All header values must be strings.`);
      }
    }
  }

  if (timeout !== undefined && (!Number.isInteger(timeout) || timeout <= 0)) {
    throw new Error(`Endpoint "${name}" has an invalid 'timeout'. It must be a positive integer (milliseconds).`);
  }
}

/**
 * Parses and validates the raw YAML content.
 *
 * @param {string} yamlContent - The raw YAML string from the config file.
 * @returns {ProbeConfig} The validated configuration object.
 * @throws {Error} If the YAML is invalid or the configuration structure is incorrect.
 */
function parseAndValidateConfig(yamlContent) {
  let config;
  try {
    config = YAML.parse(yamlContent);
  } catch (error) {
    throw new Error(`Failed to parse YAML configuration: ${error.message}`);
  }

  if (typeof config !== 'object' || config === null) {
    throw new Error('Configuration must be a YAML object.');
  }

  const { interval = DEFAULT_INTERVAL_SECONDS, endpoints } = config;

  if (!Number.isInteger(interval) || interval < MIN_INTERVAL_SECONDS) {
    throw new Error(`'interval' must be an integer of at least ${MIN_INTERVAL_SECONDS} seconds.`);
  }

  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    throw new Error("'endpoints' must be a non-empty array in the configuration file.");
  }

  const endpointNames = new Set();
  endpoints.forEach((endpoint, index) => {
    validateEndpoint(endpoint, index);
    if (endpointNames.has(endpoint.name)) {
      throw new Error(`Duplicate endpoint name found: "${endpoint.name}". Each endpoint must have a unique name.`);
    }
    endpointNames.add(endpoint.name);
  });

  return { interval, endpoints };
}

/**
 * Loads, parses, and validates the YAML configuration file.
 *
 * @param {string} configPath - The absolute or relative path to the configuration file.
 * @returns {Promise<ProbeConfig>} A promise that resolves with the validated configuration object.
 * @throws {Error} If the file cannot be read, parsed, or validated.
 */
export async function loadConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  let yamlContent;

  try {
    yamlContent = await fs.readFile(absolutePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found at: ${absolutePath}`);
    }
    throw new Error(`Failed to read configuration file: ${error.message}`);
  }

  try {
    return parseAndValidateConfig(yamlContent);
  } catch (validationError) {
    // Prepend file path to validation errors for better context
    throw new Error(`Invalid configuration in ${absolutePath}:\n- ${validationError.message}`);
  }
}