/**
 * @file src/transformers/value-transformers.js
 * @description A library of built-in functions for transforming individual cell values.
 * These functions are designed to be pure, taking a value and optional parameters,
 * and returning a transformed value. They are stateless and handle various input types gracefully.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

/**
 * A collection of built-in value transformation functions.
 * Each function takes the cell value as its first argument, followed by any
 * parameters defined in the configuration.
 *
 * The functions are designed to be robust and handle undefined, null, or
 * unexpected input types gracefully by typically returning the input value
 * as-is or a sensible default (e.g., an empty string).
 *
 * @namespace valueTransformers
 */
const valueTransformers = {
  /**
   * Converts a string to uppercase. Non-string values are returned as-is.
   * @param {any} value - The input value.
   * @returns {string|any} The uppercased string, or the original value if not a string.
   */
  toUpperCase: (value) => {
    if (typeof value !== 'string') {
      return value;
    }
    return value.toUpperCase();
  },

  /**
   * Converts a string to lowercase. Non-string values are returned as-is.
   * @param {any} value - The input value.
   * @returns {string|any} The lowercased string, or the original value if not a string.
   */
  toLowerCase: (value) => {
    if (typeof value !== 'string') {
      return value;
    }
    return value.toLowerCase();
  },

  /**
   * Removes leading and trailing whitespace from a string.
   * Non-string values are returned as-is.
   * @param {any} value - The input value.
   * @returns {string|any} The trimmed string, or the original value if not a string.
   */
  trim: (value) => {
    if (typeof value !== 'string') {
      return value;
    }
    return value.trim();
  },

  /**
   * Formats a number using fixed-point notation.
   * @param {any} value - The input value, expected to be a number or a string convertible to a number.
   * @param {number} [digits=0] - The number of digits to appear after the decimal point.
   * @returns {string|any} The formatted number as a string, or the original value if conversion fails.
   */
  toFixed: (value, digits = 0) => {
    const num = Number(value);
    const fractionDigits = Number.isInteger(digits) && digits >= 0 ? digits : 0;

    if (Number.isNaN(num)) {
      return value; // Return original value if it's not a number
    }
    return num.toFixed(fractionDigits);
  },

  /**
   * Replaces all occurrences of a substring with a new substring.
   * @param {any} value - The input string.
   * @param {string} searchValue - The string to search for.
   * @param {string} replaceValue - The string to replace `searchValue` with.
   * @returns {string|any} The modified string, or the original value if not a string.
   */
  replace: (value, searchValue, replaceValue) => {
    if (typeof value !== 'string' || typeof searchValue !== 'string' || typeof replaceValue !== 'string') {
      return value;
    }
    return value.replaceAll(searchValue, replaceValue);
  },

  /**
   * Prepends a string to the current value.
   * @param {any} value - The input value.
   * @param {string} prefix - The string to prepend.
   * @returns {string} The concatenated string.
   */
  prefix: (value, prefix) => {
    const p = prefix ?? '';
    const v = value ?? '';
    return `${p}${v}`;
  },

  /**
   * Appends a string to the current value.
   * @param {any} value - The input value.
   * @param {string} suffix - The string to append.
   * @returns {string} The concatenated string.
   */
  suffix: (value, suffix) => {
    const s = suffix ?? '';
    const v = value ?? '';
    return `${v}${s}`;
  },

  /**
   * Provides a default value if the input value is null, undefined, or an empty string.
   * @param {any} value - The input value.
   * @param {any} defaultValue - The value to return if the input is empty.
   * @returns {any} The original value or the default value.
   */
  default: (value, defaultValue) => {
    // Note: `value == null` checks for both `null` and `undefined`.
    if (value == null || value === '') {
      return defaultValue;
    }
    return value;
  },

  /**
   * Parses a string argument and returns an integer of the specified radix.
   * @param {any} value - The string to parse.
   * @param {number} [radix=10] - An integer between 2 and 36 that represents the radix.
   * @returns {number|any} The parsed integer, or the original value if parsing results in NaN.
   */
  parseInt: (value, radix = 10) => {
    const result = Number.parseInt(value, radix);
    return Number.isNaN(result) ? value : result;
  },

  /**
   * Parses a string argument and returns a floating-point number.
   * @param {any} value - The string to parse.
   * @returns {number|any} The parsed float, or the original value if parsing results in NaN.
   */
  parseFloat: (value) => {
    const result = Number.parseFloat(value);
    return Number.isNaN(result) ? value : result;
  },
};

export default valueTransformers;