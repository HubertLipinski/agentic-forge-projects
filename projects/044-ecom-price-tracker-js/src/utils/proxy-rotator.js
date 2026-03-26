import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default path to the proxies configuration file.
const DEFAULT_PROXIES_PATH = path.resolve(__dirname, '..', '..', 'config', 'proxies.json');

/**
 * Custom error class for proxy-related issues.
 * This helps in distinguishing proxy errors from other operational errors.
 */
class ProxyError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [details] Additional details about the error.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProxyError';
    this.details = details;
  }
}

/**
 * Loads and validates a list of proxy server strings from a JSON file.
 *
 * @param {string} filePath The absolute path to the JSON file containing the proxy list.
 * @returns {Promise<string[]>} A promise that resolves to an array of proxy strings.
 * @throws {ProxyError} If the file cannot be read, is not valid JSON, or is not an array of strings.
 */
async function loadProxies(filePath) {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // It's not a critical error if the file doesn't exist; we can proceed without proxies.
      console.warn(`Warning: Proxy file not found at '${filePath}'. Proceeding without proxies.`);
      return [];
    }
    throw new ProxyError(`Failed to read proxy file: ${filePath}`, { cause: error });
  }

  let proxies;
  try {
    proxies = JSON.parse(content);
  } catch (error) {
    throw new ProxyError(`Failed to parse proxy file as JSON: ${filePath}`, { cause: error });
  }

  if (!Array.isArray(proxies)) {
    throw new ProxyError(`Proxy file content must be a JSON array: ${filePath}`);
  }

  if (proxies.some(p => typeof p !== 'string' || p.trim() === '')) {
    throw new ProxyError(`All items in the proxy array must be non-empty strings: ${filePath}`);
  }

  return proxies;
}

/**
 * Creates a proxy rotator instance that manages a pool of proxies.
 * It provides a method to get the next proxy in a round-robin fashion.
 * If no proxies are available, it gracefully returns null.
 *
 * @param {object} [options={}] Configuration options for the rotator.
 * @param {string} [options.filePath=DEFAULT_PROXIES_PATH] Path to the proxy list file.
 * @returns {Promise<object>} A promise that resolves to a proxy rotator instance.
 * The instance has a `getProxy()` method.
 */
export async function createProxyRotator({ filePath = DEFAULT_PROXIES_PATH } = {}) {
  const proxies = await loadProxies(filePath);
  let currentIndex = 0;

  if (proxies.length > 0) {
    console.log(`Successfully loaded ${proxies.length} proxies.`);
  }

  /**
   * Returns the next available proxy from the pool in a round-robin sequence.
   * If the proxy pool is empty, this method will always return `null`.
   *
   * @returns {string | null} The next proxy URL string, or null if no proxies are loaded.
   */
  const getProxy = () => {
    if (proxies.length === 0) {
      return null;
    }

    const proxy = proxies[currentIndex];
    // Move to the next index, wrapping around to the start if at the end.
    currentIndex = (currentIndex + 1) % proxies.length;

    return proxy;
  };

  return {
    getProxy,
    /**
     * @returns {number} The total number of proxies currently loaded.
     */
    get count() {
      return proxies.length;
    },
  };
}