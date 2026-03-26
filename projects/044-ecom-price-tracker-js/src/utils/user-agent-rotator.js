import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default path to the user-agents configuration file.
const DEFAULT_USER_AGENTS_PATH = path.resolve(__dirname, '..', '..', 'config', 'user-agents.json');

/**
 * Custom error class for user-agent related issues.
 * This helps in distinguishing these errors from other operational errors.
 */
class UserAgentError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [details] Additional details about the error.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'UserAgentError';
    this.details = details;
  }
}

/**
 * Loads and validates a list of user-agent strings from a JSON file.
 *
 * @param {string} filePath The absolute path to the JSON file containing the user-agent list.
 * @returns {Promise<string[]>} A promise that resolves to an array of user-agent strings.
 * @throws {UserAgentError} If the file cannot be read, is not valid JSON, or is not an array of strings.
 */
async function loadUserAgents(filePath) {
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // It's not a critical error if the file doesn't exist; we can proceed with a default.
      console.warn(`Warning: User-agent file not found at '${filePath}'. A default user-agent will be used.`);
      return [];
    }
    throw new UserAgentError(`Failed to read user-agent file: ${filePath}`, { cause: error });
  }

  let userAgents;
  try {
    userAgents = JSON.parse(content);
  } catch (error) {
    throw new UserAgentError(`Failed to parse user-agent file as JSON: ${filePath}`, { cause: error });
  }

  if (!Array.isArray(userAgents)) {
    throw new UserAgentError(`User-agent file content must be a JSON array: ${filePath}`);
  }

  // Filter out any invalid entries to be more robust.
  const validUserAgents = userAgents.filter(ua => typeof ua === 'string' && ua.trim() !== '');

  if (validUserAgents.length !== userAgents.length) {
    console.warn(`Warning: Some invalid (empty or non-string) entries were found and removed from the user-agent list in '${filePath}'.`);
  }

  return validUserAgents;
}

/**
 * Creates a user-agent rotator instance that manages a pool of user-agents.
 * It provides a method to get a random user-agent from the pool.
 * If no user-agents are loaded, it falls back to a generic, modern user-agent string.
 *
 * @param {object} [options={}] Configuration options for the rotator.
 * @param {string} [options.filePath=DEFAULT_USER_AGENTS_PATH] Path to the user-agent list file.
 * @returns {Promise<object>} A promise that resolves to a user-agent rotator instance.
 * The instance has a `getUserAgent()` method.
 */
export async function createUserAgentRotator({ filePath = DEFAULT_USER_AGENTS_PATH } = {}) {
  const userAgents = await loadUserAgents(filePath);
  const defaultUserAgent = `ECommercePriceTrackerJS/1.0 (Node.js/${process.version}; +https://github.com/your-username/e-commerce-price-tracker-js)`;

  if (userAgents.length > 0) {
    console.log(`Successfully loaded ${userAgents.length} user-agents.`);
  }

  /**
   * Returns a random user-agent from the pool.
   * If the pool is empty, it returns a default project-specific user-agent string.
   *
   * @returns {string} A user-agent string.
   */
  const getUserAgent = () => {
    if (userAgents.length === 0) {
      return defaultUserAgent;
    }

    // Select a random user-agent from the list.
    const randomIndex = Math.floor(Math.random() * userAgents.length);
    return userAgents[randomIndex];
  };

  return {
    getUserAgent,
    /**
     * @returns {number} The total number of user-agents currently loaded.
     */
    get count() {
      return userAgents.length;
    },
  };
}