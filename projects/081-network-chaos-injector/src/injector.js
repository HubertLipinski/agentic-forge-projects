/**
 * @file src/injector.js
 * @description The main programmatic API for the Network Chaos Injector.
 * This file exports the `Injector` class, which provides a builder-style API
 * for defining chaos rules and scenarios, and methods to start and stop the
 * chaos injection.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { start as startInterceptor, stop as stopInterceptor } from './core/interceptor.js';
import { validateConfig, ConfigValidationError } from './utils/config-validator.js';

/**
 * @typedef {object} Target
 * @property {string | RegExp} [host] - The target hostname to match (e.g., 'api.example.com').
 * @property {string | RegExp} [path] - The target URL path to match (e.g., '/users/123').
 * @property {string | RegExp} [method] - The HTTP method to match (e.g., 'GET', 'POST').
 */

/**
 * @typedef {object} Scenario
 * @property {string} type - The type of chaos to inject ('latency', 'error-response', 'packet-loss').
 * @property {object} options - Configuration specific to the scenario type.
 */

/**
 * @typedef {object} Rule
 * @property {Target} target - The criteria for matching an outgoing request.
 * @property {Scenario} scenario - The chaos scenario to apply if the request matches.
 * @property {number} [probability=1.0] - A number between 0 and 1 indicating the chance this rule will be applied.
 */

/**
 * The main class for configuring and controlling network chaos injection.
 * It uses a builder pattern to construct a set of chaos rules.
 *
 * @example
 * import { Injector, latency, errorResponse } from 'network-chaos-injector';
 *
 * const injector = new Injector();
 *
 * injector
 *   .addRule({
 *     target: { host: 'api.service1.com' },
 *     scenario: latency({ delay: 500 }),
 *     probability: 0.5
 *   })
 *   .addRule({
 *     target: { host: 'api.service2.com', method: 'POST' },
 *     scenario: errorResponse({ statusCode: 503 })
 *   });
 *
 * // In your test setup
 * beforeAll(() => {
 *   injector.start();
 * });
 *
 * // In your test teardown
 * afterAll(() => {
 *   injector.stop();
 * });
 */
export class Injector {
  #rules;
  #isActive;

  /**
   * Constructs a new Injector instance.
   */
  constructor() {
    /**
     * @private
     * @type {Rule[]}
     */
    this.#rules = [];
    /**
     * @private
     * @type {boolean}
     */
    this.#isActive = false;
  }

  /**
   * Adds a single chaos rule to the injector.
   * This method is chainable.
   *
   * @param {Rule} rule - The rule object to add.
   * @returns {this} The Injector instance for chaining.
   * @throws {ConfigValidationError} If the rule object has an invalid structure.
   */
  addRule(rule) {
    if (this.#isActive) {
      throw new Error('Cannot add rules while the injector is active. Call stop() first.');
    }

    // Validate the individual rule by wrapping it in a temporary config structure.
    const tempConfig = { rules: [rule] };
    const { isValid, error } = validateConfig(tempConfig);

    if (!isValid) {
      // Adjust the error path to remove the temporary wrapper.
      if (error.path) {
        error.path = error.path.replace(/^rules\[0\]\.?/, '');
        if (error.path === '') error.path = 'root';
      }
      throw new ConfigValidationError(error.message.replace(`Invalid configuration at '${error.path}': `, ''), error.path);
    }

    this.#rules.push(rule);
    return this;
  }

  /**
   * Replaces all existing rules with a new set of rules.
   * This is useful for loading a complete configuration from an object.
   * This method is chainable.
   *
   * @param {Rule[]} rules - An array of rule objects.
   * @returns {this} The Injector instance for chaining.
   * @throws {ConfigValidationError} If the configuration is invalid.
   */
  loadRules(rules) {
    if (this.#isActive) {
      throw new Error('Cannot load rules while the injector is active. Call stop() first.');
    }

    const config = { rules };
    const { isValid, error } = validateConfig(config);

    if (!isValid) {
      throw error;
    }

    // Use structuredClone for a deep copy to prevent external mutations
    // after the rules have been loaded.
    this.#rules = structuredClone(rules);
    return this;
  }

  /**
   * Clears all configured rules from the injector.
   * This method is chainable.
   *
   * @returns {this} The Injector instance for chaining.
   */
  clearRules() {
    if (this.#isActive) {
      throw new Error('Cannot clear rules while the injector is active. Call stop() first.');
    }
    this.#rules = [];
    return this;
  }

  /**
   * Starts the chaos injection by patching the native `http` and `https` modules.
   * If the injector is already active, this method does nothing.
   *
   * @throws {Error} If no rules have been configured.
   */
  start() {
    if (this.#isActive) {
      console.warn('[network-chaos-injector] Warning: start() called but injector is already active.');
      return;
    }

    if (this.#rules.length === 0) {
      // Starting with no rules is a no-op and likely a mistake by the user.
      // We enforce this to prevent silent failures in tests.
      throw new Error('Cannot start injector with no rules configured. Use addRule() or loadRules() to add at least one rule.');
    }

    // The interceptor needs a context object with the rules.
    const context = {
      // Provide a deep clone to the interceptor to prevent it from being
      // mutated, and to prevent mutations in the interceptor from affecting
      // the injector's state.
      rules: structuredClone(this.#rules),
    };

    try {
      startInterceptor(context);
      this.#isActive = true;
    } catch (error) {
      console.error('[network-chaos-injector] Failed to start interceptor:', error);
      // Ensure we clean up if patching fails part-way.
      stopInterceptor();
      this.#isActive = false;
      // Re-throw to make the failure visible to the caller.
      throw error;
    }
  }

  /**
   * Stops the chaos injection and restores the original `http` and `https` module functions.
   * If the injector is not active, this method does nothing.
   */
  stop() {
    if (!this.#isActive) {
      return;
    }

    try {
      stopInterceptor();
    } catch (error) {
      // This is a critical failure, as it might leave the application in a patched state.
      console.error(
        '[network-chaos-injector] CRITICAL: Failed to stop interceptor and restore original modules. The application may be in an unstable state.',
        error
      );
      // We still update our internal state, but the user must be aware of the problem.
    } finally {
      this.#isActive = false;
    }
  }

  /**
   * Returns a copy of the currently configured rules.
   * @returns {Rule[]} A deep copy of the internal rules array.
   */
  getRules() {
    return structuredClone(this.#rules);
  }

  /**
   * Checks if the injector is currently active (i.e., between `start()` and `stop()` calls).
   * @returns {boolean} `true` if the injector is active, `false` otherwise.
   */
  isActive() {
    return this.#isActive;
  }
}