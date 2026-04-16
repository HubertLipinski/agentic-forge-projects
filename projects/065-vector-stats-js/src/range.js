/**
 * @file src/range.js
 * @description Implements functions for range-based calculations.
 *
 * This module provides fundamental statistical functions related to the range
 * and spread of data, including minimum, maximum, sum, and the range itself.
 * These functions are building blocks for many other statistical measures and
 * are designed for efficiency and robustness, handling edge cases like empty
 * arrays gracefully.
 */

import { isValidAndNotEmpty } from './utils/validation.js';

/**
 * Calculates the sum of all numbers in a vector.
 * This function uses a simple loop for performance, which is often faster
 * than `Array.prototype.reduce` for large arrays in many JavaScript engines.
 *
 * @example
 * // returns 15
 * sum([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The sum of all numbers. Returns 0 for an empty array.
 */
export const sum = (data) => {
  if (!Array.isArray(data)) {
    // Return 0 for non-array inputs to maintain numeric return type,
    // although sanitized inputs should prevent this.
    return 0;
  }
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    total += data[i];
  }
  return total;
};

/**
 * Finds the minimum value (the smallest number) in a vector.
 *
 * @example
 * // returns 1
 * min([5, 1, 8, 2, 9]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The minimum value in the array. Returns `Infinity` if the
 *   input array is empty, a standard convention in such cases.
 */
export const min = (data) => {
  if (!isValidAndNotEmpty(data)) {
    return Infinity;
  }
  // Using Math.min.apply is highly optimized for this task.
  return Math.min(...data);
};

/**
 * Finds the maximum value (the largest number) in a vector.
 *
 * @example
 * // returns 9
 * max([5, 1, 8, 2, 9]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The maximum value in the array. Returns `-Infinity` if the
 *   input array is empty, a standard convention in such cases.
 */
export const max = (data) => {
  if (!isValidAndNotEmpty(data)) {
    return -Infinity;
  }
  // Using Math.max.apply is highly optimized for this task.
  return Math.max(...data);
};

/**
 * Calculates the range of a vector of numbers.
 * The range is the difference between the maximum and minimum values in the dataset.
 * It provides a simple measure of statistical dispersion.
 *
 * @example
 * // returns 8
 * range([1, 5, 2, 9, 3]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The range of the numbers. Returns `NaN` if the array
 *   contains fewer than two elements, as range is not well-defined.
 */
export const range = (data) => {
  // Range requires at least two points to be meaningful.
  if (!isValidAndNotEmpty(data) || data.length < 2) {
    return NaN;
  }
  // This approach avoids iterating through the array twice.
  let minValue = data[0];
  let maxValue = data[0];

  for (let i = 1; i < data.length; i++) {
    const value = data[i];
    if (value < minValue) {
      minValue = value;
    }
    if (value > maxValue) {
      maxValue = value;
    }
  }

  return maxValue - minValue;
};