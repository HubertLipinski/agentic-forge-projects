/**
 * @file src/utils/time.js
 * @description Time-related utility functions.
 *
 * This module provides a centralized and mockable way to access the current time.
 * By abstracting `Date.now()`, we can easily control the flow of time in tests
 * without resorting to complex mocking libraries or manipulating system clocks.
 */

/**
 * A reference to the function that returns the current time in milliseconds
 * since the UNIX epoch. This can be overridden for testing purposes.
 *
 * @private
 * @type {() => number}
 */
let nowProvider = Date.now;

/**
 * Returns the current time in milliseconds since the UNIX epoch.
 * This is the primary function to be used throughout the application to get
 * the current timestamp.
 *
 * @returns {number} The current timestamp.
 */
export const now = () => nowProvider();

/**
 * Overrides the internal time provider with a custom function.
 * This is intended for testing purposes only, allowing for the simulation
 * of time passing without waiting in real-time.
 *
 * @param {() => number} customProvider - A function that returns a timestamp in milliseconds.
 * @example
 * // In a test file:
 * import { setNow, now } from './time.js';
 * let fakeTime = 1672531200000; // 2023-01-01 00:00:00 UTC
 * setNow(() => fakeTime);
 * console.log(now()); // 1672531200000
 *
 * fakeTime += 5000; // Advance time by 5 seconds
 * console.log(now()); // 1672531205000
 */
export const setNow = (customProvider) => {
  if (typeof customProvider !== 'function') {
    throw new TypeError('The custom time provider must be a function.');
  }
  nowProvider = customProvider;
};

/**
 * Resets the time provider to the default `Date.now`.
 * This should be called after tests that use `setNow` to ensure a clean state
 * for subsequent tests.
 *
 * @example
 * // In a test teardown hook (e.g., afterEach):
 * import { resetNow } from './time.js';
 * resetNow();
 */
export const resetNow = () => {
  nowProvider = Date.now;
};

/**
 * An asynchronous `setTimeout` that can be awaited.
 *
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));