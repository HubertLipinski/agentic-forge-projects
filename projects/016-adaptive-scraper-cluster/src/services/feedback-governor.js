/**
 * @fileoverview Implements the Feedback Governor service for adaptive scraping.
 *
 * This module is the core of the adaptive behavior in the scraper cluster. It
 * analyzes the outcome of each scraping request (e.g., HTTP status, response body)
 * to detect if the scraper has been blocked or is facing anti-bot measures. Based
 * on this feedback, it dynamically adjusts the delay between subsequent requests
 * for a given target host, implementing an exponential backoff and cooldown strategy.
 * This helps the cluster to "behave" and avoid overwhelming a server, reducing the
 * likelihood of being permanently banned.
 */

import { getLogger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { getRedisClient } from './redis-client.js';

/**
 * Represents the state of throttling for a specific target host.
 * @typedef {object} HostState
 * @property {string} host - The hostname this state applies to.
 * @property {number} currentDelay - The current delay in milliseconds to apply before requests to this host.
 * @property {number} successfulRequestsInRow - A counter for consecutive successful requests.
 * @property {number} lastUpdated - Timestamp of the last update to this state.
 */

/**
 * The singleton FeedbackGovernor instance.
 * @type {FeedbackGovernor | null}
 */
let instance = null;

/**
 * Manages adaptive request throttling based on feedback from scrape attempts.
 *
 * This class encapsulates the logic for:
 * - Maintaining the current request delay for each target host.
 * - Analyzing a response to determine if it was successful or a block.
 * - Increasing the delay (backoff) when a block is detected.
 * - Gradually decreasing the delay (cooldown) after a series of successful requests.
 * - Persisting host state in Redis to share throttling information across the cluster.
 *
 * It is designed as a singleton to ensure a unified, cluster-wide view of host-specific
 * throttling policies.
 */
class FeedbackGovernor {
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
   * @private
   * @type {object}
   */
  #config;

  /**
   * An in-memory cache for host states to reduce Redis lookups.
   * Maps hostname to its HostState object.
   * @private
   * @type {Map<string, HostState>}
   */
  #hostStateCache = new Map();

  /**
   * Private constructor to enforce the singleton pattern.
   * Use `FeedbackGovernor.getInstance()` to get the shared instance.
   * @private
   */
  constructor() {
    this.#logger = getLogger().child({ service: 'FeedbackGovernor' });
    const appConfig = getConfig();
    this.#config = appConfig.governor;
    this.#redis = getRedisClient();
    this.#redisKeyPrefix = appConfig.redis.keyPrefix ?? 'asc:';

    this.#logger.info('FeedbackGovernor initialized with settings:', {
      initialDelay: this.#config.initialDelay,
      maxDelay: this.#config.maxDelay,
      backoffFactor: this.#config.backoffFactor,
      cooldownFactor: this.#config.cooldownFactor,
    });
  }

  /**
   * Generates the Redis key for a given hostname's state.
   * @private
   * @param {string} host - The target hostname.
   * @returns {string} The Redis key.
   */
  #getHostStateKey(host) {
    return `${this.#redisKeyPrefix}governor:host:${host}`;
  }

  /**
   * Retrieves the current throttling state for a given host.
   * It first checks an in-memory cache, then falls back to Redis. If no state
   * exists, it creates a default initial state.
   *
   * @param {string} host - The hostname to get the state for.
   * @returns {Promise<HostState>} The current state for the host.
   */
  async #getHostState(host) {
    // 1. Check in-memory cache first for performance.
    if (this.#hostStateCache.has(host)) {
      return this.#hostStateCache.get(host);
    }

    // 2. If not in cache, try to get from Redis.
    const key = this.#getHostStateKey(host);
    try {
      const stateJson = await this.#redis.get(key);
      if (stateJson) {
        const state = JSON.parse(stateJson);
        this.#hostStateCache.set(host, state); // Cache the retrieved state.
        return state;
      }
    } catch (error) {
      this.#logger.error({ err: error, host }, 'Failed to retrieve host state from Redis.');
    }

    // 3. If no state in Redis, create and return the initial state.
    const initialState = {
      host,
      currentDelay: this.#config.initialDelay,
      successfulRequestsInRow: 0,
      lastUpdated: Date.now(),
    };
    this.#hostStateCache.set(host, initialState); // Cache the new state.
    return initialState;
  }

  /**
   * Persists the updated state for a host to Redis and the in-memory cache.
   *
   * @private
   * @param {HostState} state - The state object to save.
   * @returns {Promise<void>}
   */
  async #setHostState(state) {
    state.lastUpdated = Date.now();
    this.#hostStateCache.set(state.host, state);

    const key = this.#getHostStateKey(state.host);
    try {
      // Set state with a 24-hour expiration to auto-clean old host data.
      await this.#redis.set(key, JSON.stringify(state), 'EX', 60 * 60 * 24);
    } catch (error) {
      this.#logger.error({ err: error, host: state.host }, 'Failed to persist host state to Redis.');
    }
  }

  /**
   * Analyzes a response to determine if it represents a block.
   * A block is detected if the status code matches the configured block codes,
   * or if the response body contains any of the configured block keywords.
   *
   * @param {number} statusCode - The HTTP status code of the response.
   * @param {string} body - The response body as a string.
   * @returns {boolean} `true` if the response is considered a block, `false` otherwise.
   */
  isBlocked(statusCode, body) {
    const { statusCodes, bodyKeywords } = this.#config.blockDetection;

    if (statusCodes.includes(statusCode)) {
      this.#logger.warn({ statusCode }, 'Block detected due to status code.');
      return true;
    }

    if (body && bodyKeywords.length > 0) {
      const lowercasedBody = body.toLowerCase();
      for (const keyword of bodyKeywords) {
        if (lowercasedBody.includes(keyword.toLowerCase())) {
          this.#logger.warn({ keyword }, 'Block detected due to body keyword.');
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Processes the outcome of a request and updates the host's throttling state.
   * If the request was successful, it may decrease the delay (cooldown).
   * If the request was blocked, it increases the delay (backoff).
   *
   * @param {string} host - The hostname of the target server.
   * @param {boolean} wasSuccessful - `true` if the request was successful, `false` if blocked.
   * @returns {Promise<void>}
   */
  async reportResult(host, wasSuccessful) {
    const state = await this.#getHostState(host);

    if (wasSuccessful) {
      state.successfulRequestsInRow++;
      // Cooldown logic: if we have a streak of successes, gradually reduce delay.
      // We check this every 10 successful requests to avoid rapid fluctuations.
      if (state.successfulRequestsInRow % 10 === 0 && state.currentDelay > this.#config.initialDelay) {
        const newDelay = Math.max(
          this.#config.initialDelay,
          Math.floor(state.currentDelay / this.#config.cooldownFactor)
        );
        if (newDelay < state.currentDelay) {
          this.#logger.info(
            { host, oldDelay: state.currentDelay, newDelay },
            'Cooldown: Reducing request delay due to sustained success.'
          );
          state.currentDelay = newDelay;
        }
      }
    } else {
      // Backoff logic: a block was detected. Reset success streak and increase delay.
      state.successfulRequestsInRow = 0;
      const newDelay = Math.min(
        this.#config.maxDelay,
        Math.ceil(state.currentDelay * this.#config.backoffFactor)
      );
      if (newDelay > state.currentDelay) {
        this.#logger.warn(
          { host, oldDelay: state.currentDelay, newDelay },
          'Backoff: Increasing request delay due to block detection.'
        );
        state.currentDelay = newDelay;
      }
    }

    await this.#setHostState(state);
  }

  /**
   * Gets the current required request delay for a specific host.
   * This is the value that the request dispatcher should wait for before
   * making the next request to this host.
   *
   * @param {string} host - The hostname to get the delay for.
   * @returns {Promise<number>} The delay in milliseconds.
   */
  async getDelayForHost(host) {
    const state = await this.#getHostState(host);
    return state.currentDelay;
  }

  /**
   * Gets the singleton instance of the FeedbackGovernor.
   *
   * @returns {FeedbackGovernor} The singleton instance.
   */
  static getInstance() {
    if (!instance) {
      instance = new FeedbackGovernor();
    }
    return instance;
  }
}

/**
 * A singleton instance of the FeedbackGovernor.
 * This ensures that throttling state is managed centrally across the application.
 * @type {FeedbackGovernor}
 */
const feedbackGovernor = FeedbackGovernor.getInstance();

export default feedbackGovernor;