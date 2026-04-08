/**
 * @fileoverview Statistical calculation helpers for benchmark results.
 * This module provides pure functions for calculating the mean, standard deviation,
 * and percentage change of numerical data sets. These are essential for
 * analyzing the results of benchmark runs and determining statistical significance.
 */

/**
 * Calculates the mean (average) of an array of numbers.
 * Returns 0 if the array is empty to prevent division by zero errors.
 *
 * @param {number[]} numbers - An array of numbers.
 * @returns {number} The mean of the numbers.
 */
export function calculateMean(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Input must be an array of numbers.');
  }
  if (numbers.length === 0) {
    return 0;
  }

  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return sum / numbers.length;
}

/**
 * Calculates the sample standard deviation of an array of numbers.
 * Standard deviation measures the amount of variation or dispersion of a set of values.
 * A low standard deviation indicates that the values tend to be close to the mean,
 * suggesting more consistent benchmark results.
 *
 * Uses the formula for sample standard deviation (Bessel's correction with n-1).
 * Returns 0 if the array has fewer than two elements, as deviation is not meaningful.
 *
 * @param {number[]} numbers - An array of numbers.
 * @returns {number} The sample standard deviation.
 */
export function calculateStandardDeviation(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError('Input must be an array of numbers.');
  }
  // Standard deviation requires at least two data points to be meaningful.
  if (numbers.length < 2) {
    return 0;
  }

  const mean = calculateMean(numbers);
  const squaredDifferences = numbers.map((val) => (val - mean) ** 2);
  const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / (numbers.length - 1);

  return Math.sqrt(variance);
}

/**
 * Calculates the percentage change between two numbers.
 * This is used to determine the performance improvement or regression.
 *
 * Formula: ((newValue - oldValue) / oldValue) * 100
 *
 * Handles the edge case where the old value is 0 to avoid division by zero.
 * If oldValue is 0 and newValue is also 0, the change is 0%.
 * If oldValue is 0 and newValue is positive, it's considered an infinite improvement (returns Infinity).
 *
 * @param {number} oldValue - The original value (e.g., baseline metric).
 * @param {number} newValue - The new value (e.g., feature metric).
 * @returns {number} The percentage change. Can be positive (improvement/increase),
 *   negative (regression/decrease), or zero. Returns Infinity for changes from 0 to a non-zero number.
 */
export function calculatePercentageChange(oldValue, newValue) {
  if (typeof oldValue !== 'number' || typeof newValue !== 'number') {
    throw new TypeError('Inputs must be numbers.');
  }

  if (oldValue === 0) {
    if (newValue === 0) {
      return 0; // No change from 0 to 0.
    }
    // A change from 0 to a positive value is technically an infinite percentage increase.
    // A change from 0 to a negative value is an infinite percentage decrease.
    return newValue > 0 ? Infinity : -Infinity;
  }

  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}