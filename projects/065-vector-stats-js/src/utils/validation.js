/**
 * @file src/utils/validation.js
 * @description Utility functions for validating and sanitizing numerical data arrays.
 *
 * This module provides helpers to ensure that arrays passed to statistical
 * functions are in the correct format, containing only valid numbers. It
 * handles filtering of non-numeric types and checks for common edge cases.
 */

/**
 * Checks if a value is a valid, finite number.
 * Excludes `NaN`, `Infinity`, and `-Infinity`.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} `true` if the value is a finite number, otherwise `false`.
 */
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Sanitizes an array by filtering out non-numeric and non-finite values.
 * It attempts to convert string representations of numbers into actual numbers.
 *
 * - Filters out `null`, `undefined`, `NaN`, `Infinity`, `-Infinity`.
 * - Converts valid numeric strings (e.g., "42", "-3.14") to numbers.
 * - Ignores non-numeric strings and other types.
 *
 * @param {Array<*>} data - The input array to sanitize.
 * @returns {Array<number>} A new array containing only valid, finite numbers.
 * @throws {TypeError} If the input `data` is not an array.
 */
export const sanitizeNumericArray = (data) => {
  if (!Array.isArray(data)) {
    throw new TypeError('Input must be an array.');
  }

  const sanitized = [];
  for (const item of data) {
    // Skip nullish values immediately
    if (item == null) {
      continue;
    }

    // Handle numbers directly for performance
    if (isNumber(item)) {
      sanitized.push(item);
      continue;
    }

    // Attempt to convert other types, primarily strings
    const num = Number(item);
    if (isNumber(num)) {
      sanitized.push(num);
    }
  }

  return sanitized;
};

/**
 * Validates that an array is not empty and contains at least one valid number.
 * This is a common precondition for many statistical calculations.
 *
 * @param {Array<number>} data - The array to validate, expected to be sanitized.
 * @returns {boolean} `true` if the array is valid and non-empty, otherwise `false`.
 */
export const isValidAndNotEmpty = (data) => {
  return Array.isArray(data) && data.length > 0;
};