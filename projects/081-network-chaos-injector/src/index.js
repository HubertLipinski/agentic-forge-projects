/**
 * @file src/index.js
 * @description Public entry point for the Network Chaos Injector library.
 * This file exports the main `Injector` class and helper functions for creating
 * chaos scenario configurations, making it easy for consumers to set up and
 * control network chaos programmatically.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { Injector } from './injector.js';

/**
 * @typedef {import('./injector.js').Rule} Rule
 * @typedef {import('./injector.js').Target} Target
 * @typedef {import('./injector.js').Scenario} Scenario
 */

/**
 * Helper function to create a 'latency' scenario configuration object.
 * This provides better discoverability and type safety for users.
 *
 * @param {object} options - The options for the latency scenario.
 * @param {number} [options.delay] - A fixed delay in milliseconds.
 * @param {number} [options.minDelay] - The minimum delay for a random range.
 * @param {number} [options.maxDelay] - The maximum delay for a random range.
 * @returns {Scenario} A scenario configuration object for latency.
 *
 * @example
 * // Fixed 500ms delay
 * latency({ delay: 500 })
 *
 * @example
 * // Random delay between 200ms and 1000ms
 * latency({ minDelay: 200, maxDelay: 1000 })
 */
function latency(options) {
  return {
    type: 'latency',
    options,
  };
}

/**
 * Helper function to create an 'error-response' scenario configuration object.
 *
 * @param {object} options - The options for the error response scenario.
 * @param {number} options.statusCode - The HTTP status code to return (e.g., 503).
 * @param {string} [options.statusMessage] - The HTTP status message.
 * @param {string} [options.body] - The response body to send.
 * @param {object} [options.headers] - The response headers to send.
 * @returns {Scenario} A scenario configuration object for a forged error response.
 *
 * @example
 * // Simulate a 503 Service Unavailable
 * errorResponse({ statusCode: 503 })
 *
 * @example
 * // Simulate a 429 with a custom body
 * errorResponse({
 *   statusCode: 429,
 *   statusMessage: 'Too Many Requests',
 *   body: '{"error": "rate limit exceeded", "retryAfter": 30}',
 *   headers: { 'Retry-After': '30' }
 * })
 */
function errorResponse(options) {
  return {
    type: 'error-response',
    options,
  };
}

/**
 * Helper function to create a 'packet-loss' scenario configuration object.
 * This simulates a sudden connection drop by destroying the request socket.
 *
 * @param {object} [options] - The options for the packet loss scenario.
 * @param {number} [options.delay=0] - A delay in milliseconds before destroying the request.
 * @returns {Scenario} A scenario configuration object for packet loss.
 *
 * @example
 * // Simulate immediate connection failure
 * packetLoss()
 *
 * @example
 * // Simulate connection failure after 100ms
 * packetLoss({ delay: 100 })
 */
function packetLoss(options) {
  return {
    type: 'packet-loss',
    options,
  };
}

// Export the main Injector class and the scenario helper functions.
export {
  Injector,
  latency,
  errorResponse,
  packetLoss,
};