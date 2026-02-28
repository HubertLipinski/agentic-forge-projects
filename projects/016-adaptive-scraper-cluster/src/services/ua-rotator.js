/**
 * @fileoverview Provides a service for rotating User-Agent strings.
 *
 * This module is responsible for managing a list of User-Agent strings loaded
 * from the application's configuration. It provides a simple, efficient
 * mechanism to retrieve a random User-Agent for each outgoing request, which
 * is a fundamental technique for mimicking diverse clients and avoiding
 * simplistic bot detection.
 */

import { getLogger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';

/**
 * The singleton UserAgentRotator instance.
 * @type {UserAgentRotator | null}
 */
let instance = null;

/**
 * Manages and rotates a pool of User-Agent strings.
 *
 * This class encapsulates the logic for loading User-Agents from the
 * configuration and providing a random one upon request. It is designed as a
 * singleton to ensure that the list of User-Agents is loaded only once and
 * shared across the application, providing a single, consistent source for
 * this data.
 */
class UserAgentRotator {
  /**
   * @private
   * @type {import('pino').Logger}
   */
  #logger;

  /**
   * The in-memory pool of User-Agent strings.
   * @private
   * @type {string[]}
   */
  #userAgents = [];

  /**
   * Private constructor to enforce the singleton pattern.
   * Use `UserAgentRotator.getInstance()` to get the shared instance.
   *
   * It loads the User-Agent list from the application configuration. If the list
   * is missing or empty, it logs a warning and operates with an empty pool,
   * effectively disabling User-Agent rotation.
   * @private
   */
  constructor() {
    this.#logger = getLogger().child({ service: 'UserAgentRotator' });
    const config = getConfig();

    if (!config.userAgents || config.userAgents.length === 0) {
      this.#logger.warn(
        'The `userAgents` array in the configuration is missing or empty. User-Agent rotation will be disabled.'
      );
      this.#userAgents = [];
    } else {
      this.#userAgents = config.userAgents;
      this.#logger.info(`Initialized with ${this.#userAgents.length} User-Agents.`);
    }
  }

  /**
   * Retrieves a random User-Agent string from the configured pool.
   *
   * This method provides a simple and efficient way to get a different
   * User-Agent for each request. It uses a basic random selection from the
   * internal array.
   *
   * @returns {string | null} A randomly selected User-Agent string, or `null`
   * if the pool is empty.
   */
  getRandomUserAgent() {
    if (this.#userAgents.length === 0) {
      return null;
    }

    // This is a fast and effective way to get a random element.
    // Math.random() is sufficient for this non-cryptographic use case.
    const randomIndex = Math.floor(Math.random() * this.#userAgents.length);
    return this.#userAgents[randomIndex];
  }

  /**
   * Gets the total number of User-Agents currently loaded in the pool.
   *
   * @returns {number} The count of available User-Agents.
   */
  getPoolSize() {
    return this.#userAgents.length;
  }

  /**
   * Gets the singleton instance of the UserAgentRotator.
   *
   * This static method ensures that only one instance of the rotator exists
   * throughout the application's lifecycle, preventing redundant memory usage
   * and ensuring consistent behavior.
   *
   * @returns {UserAgentRotator} The singleton instance.
   */
  static getInstance() {
    if (!instance) {
      instance = new UserAgentRotator();
    }
    return instance;
  }
}

/**
 * A singleton instance of the UserAgentRotator.
 * Exporting the instance directly provides a convenient way for other modules
 * to access the rotator's functionality without needing to manage instances.
 *
 * @example
 * import uaRotator from './ua-rotator.js';
 * const userAgent = uaRotator.getRandomUserAgent();
 *
 * @type {UserAgentRotator}
 */
const uaRotator = UserAgentRotator.getInstance();

export default uaRotator;