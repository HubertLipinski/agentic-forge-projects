/**
 * @file src/parsers/index.js
 * @description A factory module for selecting the appropriate test output parser
 * based on user configuration. This centralizes parser management and allows for
 * easy extension with new parsers in the future.
 */

import jestParser from './jest-parser.js';
import mochaParser from './mocha-parser.js';
import { PARSER_PATTERNS } from '../config/constants.js';

/**
 * A map of available parsers, keyed by their identifier string.
 * This allows for dynamic selection of a parser based on configuration.
 * Each parser must conform to the interface: `{ parse: (output: string) => Array<{name: string, status: string}> }`.
 *
 * @private
 * @type {Map<string, { parse: (output: string) => Array<{name: string, status: string}> }>}
 */
const availableParsers = new Map([
  ['jest', jestParser],
  ['mocha', mochaParser],
]);

/**
 * Retrieves a parser instance based on the provided name.
 * This factory function is the single point of entry for accessing parsers
 * throughout the application. It ensures that a valid and supported parser
 * is returned or throws a clear error if the requested parser is not available.
 *
 * @param {string} parserName - The name of the parser to retrieve (e.g., 'jest', 'mocha').
 * This name should correspond to a key in the `availableParsers` map.
 * @returns {{ parse: (output: string) => Array<{name: string, status: string}> }} The parser object.
 * @throws {Error} If the `parserName` is not a supported parser.
 */
export function getParser(parserName) {
  if (typeof parserName !== 'string' || !parserName) {
    throw new Error('Parser name must be a non-empty string.');
  }

  const parser = availableParsers.get(parserName.toLowerCase());

  if (!parser) {
    const supportedParsers = Array.from(availableParsers.keys()).join(', ');
    throw new Error(
      `Unsupported parser: '${parserName}'. Supported parsers are: ${supportedParsers}.`,
    );
  }

  // A defensive check to ensure the selected parser object has the required `parse` method.
  if (typeof parser.parse !== 'function') {
    throw new Error(
      `The selected parser '${parserName}' is invalid: it does not have a 'parse' method.`,
    );
  }

  return parser;
}

/**
 * Retrieves the regular expression pattern associated with a given parser name.
 * This is useful for contexts where only the regex is needed, without instantiating
 * the full parser logic.
 *
 * @param {string} parserName - The name of the parser.
 * @returns {RegExp} The regular expression for the specified parser.
 * @throws {Error} If the `parserName` does not have a corresponding pattern.
 */
export function getParserPattern(parserName) {
  if (typeof parserName !== 'string' || !parserName) {
    throw new Error('Parser name must be a non-empty string.');
  }

  const pattern = PARSER_PATTERNS[parserName.toLowerCase()];

  if (!pattern) {
    const supportedPatterns = Object.keys(PARSER_PATTERNS).join(', ');
    throw new Error(
      `No regex pattern found for parser: '${parserName}'. Supported patterns are: ${supportedPatterns}.`,
    );
  }

  return pattern;
}