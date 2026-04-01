/**
 * @file lib/retry.js
 * @description Manages the retry logic, including exponential backoff and attempt counting.
 * @module lib/retry
 */

import { RETRY_BACKOFF_STRATEGIES, DEFAULT_VALIDATOR_CONFIG } from './constants.js';
import { ConfigurationError } from './errors.js';

/**
 * A utility function that pauses execution for a specified duration.
 * It's a core component of the backoff strategy.
 *
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates the delay for the next retry attempt based on the chosen backoff strategy.
 *
 * This function supports 'fixed' and 'exponential' backoff strategies.
 * - **Fixed:** The delay is always the `initialDelayMs`.
 * - **Exponential:** The delay doubles with each attempt, starting from `initialDelayMs`.
 *   It is capped by `maxDelayMs`.
 *
 * A "jitter" factor is applied to the calculated delay to prevent thundering herd
 * problems, where multiple clients retry simultaneously. Jitter adds a random
 * amount of time (positive or negative) to the delay, spreading out the retry attempts.
 *
 * @param {object} options - The configuration for calculating the delay.
 * @param {number} options.attempt - The current attempt number (1-based).
 * @param {string} options.backoffStrategy - The name of the backoff strategy ('fixed' or 'exponential').
 * @param {number} options.initialDelayMs - The base delay in milliseconds.
 * @param {number} options.maxDelayMs - The maximum possible delay in milliseconds (for exponential backoff).
 * @param {number} options.jitter - A factor from 0 to 1 to randomize the delay.
 * @returns {number} The calculated delay in milliseconds, including jitter.
 * @throws {ConfigurationError} If an unknown backoff strategy is provided.
 */
export function calculateBackoffDelay({
  attempt,
  backoffStrategy,
  initialDelayMs,
  maxDelayMs,
  jitter,
}) {
  let baseDelay;

  switch (backoffStrategy) {
    case RETRY_BACKOFF_STRATEGIES.FIXED:
      baseDelay = initialDelayMs;
      break;

    case RETRY_BACKOFF_STRATEGIES.EXPONENTIAL:
      // Exponential backoff: initialDelay * 2^(attempt - 1)
      // The first attempt (attempt=1) has a delay based on initialDelayMs.
      baseDelay = initialDelayMs * Math.pow(2, attempt - 1);
      break;

    default:
      throw new ConfigurationError(`Unknown backoff strategy: "${backoffStrategy}"`);
  }

  // Cap the delay at the configured maximum.
  const cappedDelay = Math.min(baseDelay, maxDelayMs);

  // Apply jitter to the delay.
  // Jitter is a random value in the range: [-jitter * cappedDelay, +jitter * cappedDelay]
  // We calculate a random factor between (1 - jitter) and (1 + jitter) and multiply.
  // This prevents the delay from becoming negative or excessively large.
  const jitterFactor = (Math.random() * 2 - 1) * jitter; // Random value between -jitter and +jitter
  const randomizedDelay = cappedDelay * (1 + jitterFactor);

  // Ensure the delay is a non-negative integer.
  return Math.max(0, Math.round(randomizedDelay));
}

/**
 * Manages the state and logic for a single retry-enabled operation.
 * It tracks the number of attempts and orchestrates the delay between them.
 *
 * This class is designed to be instantiated for each high-level operation
 * that requires retries (e.g., a single call to `validator.validate()`).
 */
export class RetryManager {
  #maxRetries;
  #backoffStrategy;
  #initialDelayMs;
  #maxDelayMs;
  #jitter;
  #currentAttempt = 0;

  /**
   * Creates an instance of RetryManager.
   *
   * @param {object} [config={}] - Configuration for the retry logic.
   * @param {number} [config.maxRetries=DEFAULT_VALIDATOR_CONFIG.maxRetries] - The maximum number of retries.
   * @param {string} [config.backoffStrategy=DEFAULT_VALIDATOR_CONFIG.backoffStrategy] - The backoff strategy to use.
   * @param {number} [config.initialDelayMs=DEFAULT_VALIDATOR_CONFIG.initialDelayMs] - The initial delay for backoff.
   * @param {number} [config.maxDelayMs=DEFAULT_VALIDATOR_CONFIG.maxDelayMs] - The maximum delay for exponential backoff.
   * @param {number} [config.jitter=DEFAULT_VALIDATOR_CONFIG.jitter] - The jitter factor (0-1).
   */
  constructor(config = {}) {
    const finalConfig = { ...DEFAULT_VALIDATOR_CONFIG, ...config };

    this.#maxRetries = finalConfig.maxRetries;
    this.#backoffStrategy = finalConfig.backoffStrategy;
    this.#initialDelayMs = finalConfig.initialDelayMs;
    this.#maxDelayMs = finalConfig.maxDelayMs;
    this.#jitter = finalConfig.jitter;
    this.#currentAttempt = 0;
  }

  /**
   * Gets the current attempt number (1-based).
   * @returns {number} The current attempt number.
   */
  get currentAttempt() {
    return this.#currentAttempt;
  }

  /**
   * Checks if more retry attempts are allowed.
   * The total number of attempts is `maxRetries + 1` (1 initial + N retries).
   * @returns {boolean} `true` if another attempt can be made, `false` otherwise.
   */
  canRetry() {
    return this.#currentAttempt <= this.#maxRetries;
  }

  /**
   * Increments the attempt counter and, if more retries are allowed,
   * waits for the calculated backoff period before resolving.
   * This function should be called before executing the logic for the next attempt.
   *
   * @returns {Promise<void>} A promise that resolves when the backoff delay is complete.
   */
  async nextAttempt() {
    this.#currentAttempt += 1;

    if (!this.canRetry()) {
      // No need to wait if we've exceeded the max retries.
      // The calling logic will handle the final failure.
      return;
    }

    // Only wait if this is a retry attempt (i.e., not the very first attempt).
    if (this.#currentAttempt > 1) {
      const delayMs = calculateBackoffDelay({
        // The delay is calculated for the *upcoming* attempt, but based on the *failure* of the previous one.
        // We use `currentAttempt - 1` to represent the number of failures so far.
        attempt: this.#currentAttempt - 1,
        backoffStrategy: this.#backoffStrategy,
        initialDelayMs: this.#initialDelayMs,
        maxDelayMs: this.#maxDelayMs,
        jitter: this.#jitter,
      });

      if (delayMs > 0) {
        await delay(delayMs);
      }
    }
  }
}