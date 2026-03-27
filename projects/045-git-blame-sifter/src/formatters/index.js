/**
 * @file src/formatters/index.js
 * @module formatters
 * @description Exports all available output formatters for the application.
 * This module acts as a registry, allowing the main command logic to dynamically
 * select a formatter based on user configuration.
 */

import { standardFormatter } from './standard-formatter.js';
import { jsonFormatter } from './json-formatter.js';
import { summaryFormatter } from './summary-formatter.js';

/**
 * A map of available output formatters, keyed by their identifier string.
 * The keys (e.g., 'standard', 'json') are used in configuration files and
 * CLI flags to specify the desired output format.
 *
 * Each formatter is an async function that accepts the analysis result
 * and an options object, and is responsible for presenting the data to the user.
 *
 * @type {Readonly<Object<string, Function>>}
 */
export const formatters = Object.freeze({
  standard: standardFormatter,
  json: jsonFormatter,
  summary: summaryFormatter,
});

/**
 * Retrieves a specific formatter function by its name.
 *
 * @param {string} name - The name of the formatter to retrieve (e.g., 'standard', 'json').
 * @returns {Function|undefined} The formatter function if found, otherwise undefined.
 */
export function getFormatter(name) {
  return formatters[name];
}

/**
 * Returns an array of the names of all available formatters.
 * This is useful for help text and validation.
 *
 * @returns {string[]} An array of formatter names.
 */
export function getAvailableFormatters() {
  return Object.keys(formatters);
}