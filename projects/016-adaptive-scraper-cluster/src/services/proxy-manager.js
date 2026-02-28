import { getLogger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { getRedisClient } from './redis-client.js';

/**
 * @fileoverview Manages a pool of proxies for web scraping requests.
 *
 * This service is responsible for loading, rotating, and tracking the health
 * of proxies defined in the application configuration. It provides a mechanism
 * to get a proxy for a request and to report back on the success or failure
 * of that request, allowing the system to adapt its proxy usage strategy.
 */

/**
 * Represents a proxy with its associated metadata and health statistics.
 * @typedef {object} Proxy
 * @property {string} url - The full URL of the proxy (e.g., 'http://user:pass@host:port').
 * @property {number} successCount - The number of successful requests made through this proxy.
 * @property {number} failureCount - The number of failed or blocked requests made through this proxy.
 * @property {number} lastUsed - A timestamp (in milliseconds) of when this proxy was last used.
 */

/**
 * The singleton ProxyManager instance.
 * @type {ProxyManager | null}
 */
let instance = null;

/**
 * Manages the lifecycle and rotation of a pool of proxies.
 *
 * This class encapsulates the logic for:
 * - Loading proxies from configuration.
 * - Selecting the next proxy to use based on a rotation strategy.
 * - Tracking the success and failure rates of each proxy.
 * - Persisting proxy stats to Redis for cluster-wide state.
 *
 * It is designed as a singleton to ensure a single source of truth for proxy
 * management across the application.
 */
class ProxyManager {
  /**
   * @private
   * @type {import('pino').Logger}
   */
  #logger;

  /**
   * @private
   * @type {import('ioredis').Redis}
   */
  #redis;

  /**
   * @private
   * @type {string}
   */
  #redisKeyPrefix;

  /**
   * The in-memory pool of proxy objects.
   * @private
   * @type {Proxy[]}
   */
  #pool = [];

  /**
   * The index of the next proxy to be used in the pool.
   * @private
   * @type {number}
   */
  #currentIndex = 0;

  /**
   * A flag to indicate if the manager has been initialized.
   * @private
   * @type {boolean}
   */
  #isInitialized = false;

  /**
   * Initializes the ProxyManager. This is a private constructor to enforce
   * the singleton pattern. Use `ProxyManager.getInstance()` instead.
   * @private
   */
  constructor() {
    this.#logger = getLogger().child({ service: 'ProxyManager' });
    const config = getConfig();

    if (!config.proxies || config.proxies.length === 0) {
      this.#logger.warn('No proxies found in configuration. ProxyManager will be disabled.');
      return;
    }

    this.#redis = getRedisClient();
    this.#redisKeyPrefix = config.redis.keyPrefix ?? 'asc:';

    // Initialize the pool with proxy objects from the config.
    // Stats will be loaded asynchronously.
    this.#pool = config.proxies.map((proxyUrl) => ({
      url: proxyUrl,
      successCount: 0,
      failureCount: 0,
      lastUsed: 0,
    }));

    this.#logger.info(`Initialized with ${this.#pool.length} proxies from configuration.`);
  }

  /**
   * Asynchronously loads proxy statistics from Redis.
   * This should be called after instantiation to hydrate the in-memory pool
   * with persisted state from previous runs.
   *
   * @returns {Promise<void>} A promise that resolves when stats are loaded.
   */
  async initialize() {
    if (this.#isInitialized || this.#pool.length === 0) {
      return;
    }

    this.#logger.debug('Loading proxy statistics from Redis...');
    try {
      const statKeys = this.#pool.map(proxy => `${this.#redisKeyPrefix}proxy:${proxy.url}:stats`);
      if (statKeys.length === 0) {
        this.#isInitialized = true;
        return;
      }

      const stats = await this.#redis.mget(statKeys);

      stats.forEach((statJson, index) => {
        if (statJson) {
          try {
            const savedStats = JSON.parse(statJson);
            this.#pool[index].successCount = savedStats.successCount ?? 0;
            this.#pool[index].failureCount = savedStats.failureCount ?? 0;
          } catch (e) {
            this.#logger.warn({ proxy: this.#pool[index].url, error: e.message },
              'Failed to parse stored stats for proxy. Resetting to zero.');
          }
        }
      });

      this.#logger.info('Successfully loaded proxy statistics from Redis.');
    } catch (error) {
      this.#logger.error({ err: error }, 'Failed to load proxy statistics from Redis. Starting with fresh stats.');
      // Continue with zeroed stats if Redis fails.
    } finally {
      this.#isInitialized = true;
    }
  }

  /**
   * Selects the next available proxy from the pool using a round-robin strategy.
   *
   * @returns {Proxy | null} The selected proxy object, or null if the pool is empty.
   */
  getNextProxy() {
    if (this.#pool.length === 0) {
      return null;
    }

    // Simple round-robin rotation.
    const proxy = this.#pool[this.#currentIndex];
    this.#currentIndex = (this.#currentIndex + 1) % this.#pool.length;

    // Update last used timestamp.
    proxy.lastUsed = Date.now();

    return proxy;
  }

  /**
   * Reports the outcome of a request made with a specific proxy.
   * This feedback is used to update the proxy's health statistics.
   *
   * @param {string} proxyUrl - The URL of the proxy that was used.
   * @param {boolean} wasSuccessful - True if the request succeeded, false if it failed or was blocked.
   * @returns {Promise<void>}
   */
  async reportResult(proxyUrl, wasSuccessful) {
    if (!proxyUrl || this.#pool.length === 0) {
      return;
    }

    const proxy = this.#pool.find(p => p.url === proxyUrl);
    if (!proxy) {
      this.#logger.warn({ proxyUrl }, 'Attempted to report result for an unknown proxy.');
      return;
    }

    if (wasSuccessful) {
      proxy.successCount++;
    } else {
      proxy.failureCount++;
    }

    // Asynchronously persist the updated stats to Redis.
    // This is a "fire-and-forget" operation from the caller's perspective,
    // but we handle errors internally.
    try {
      const key = `${this.#redisKeyPrefix}proxy:${proxy.url}:stats`;
      const value = JSON.stringify({
        successCount: proxy.successCount,
        failureCount: proxy.failureCount,
      });
      // Set with an expiration to automatically clean up old stats if a proxy is removed from config.
      // 30 days is a reasonable default.
      await this.#redis.set(key, value, 'EX', 60 * 60 * 24 * 30);
    } catch (error) {
      this.#logger.error({ err: error, proxyUrl }, 'Failed to persist proxy stats to Redis.');
    }
  }

  /**
   * Retrieves the current statistics for all proxies in the pool.
   *
   * @returns {Proxy[]} A deep copy of the current proxy pool with all stats.
   */
  getStats() {
    // Return a deep copy to prevent external modification of the internal state.
    return structuredClone(this.#pool);
  }

  /**
   * Gets the singleton instance of the ProxyManager.
   *
   * @returns {ProxyManager} The singleton instance.
   */
  static getInstance() {
    if (!instance) {
      instance = new ProxyManager();
    }
    return instance;
  }
}

/**
 * A singleton instance of the ProxyManager.
 * This ensures that proxy state and rotation are managed centrally.
 * @type {ProxyManager}
 */
const proxyManager = ProxyManager.getInstance();

export default proxyManager;