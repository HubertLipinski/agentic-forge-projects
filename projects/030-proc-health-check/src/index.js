/**
 * @file src/index.js
 * @description Main entry point for the Process Health Checker library.
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { getProcessHealth } from './monitor.js';
import { formatUptime, formatMemory } from './utils.js';

/**
 * The primary function to get the health status of a process.
 * This is a re-export of the core monitoring logic.
 *
 * @function
 * @param {number | string} pid - The Process ID of the process to monitor.
 * @returns {Promise<object>} A promise that resolves to a health status object.
 * @see {@link getProcessHealth} for detailed documentation on the returned object and potential errors.
 */
export const checkProcessHealth = getProcessHealth;

/**
 * A collection of utility functions for formatting health data.
 *
 * @property {function(number): string} formatUptime - Formats seconds into an HH:MM:SS string.
 * @property {function(number): string} formatMemory - Formats bytes into a human-readable MB string.
 */
export const utils = {
  formatUptime,
  formatMemory,
};

/**
 * Default export of the library, providing access to all primary functions.
 * This allows for a convenient import pattern: `import healthChecker from 'process-health-checker';`
 *
 * @default
 * @type {{checkProcessHealth: function, utils: {formatUptime: function, formatMemory: function}}}
 */
export default {
  checkProcessHealth,
  utils,
};