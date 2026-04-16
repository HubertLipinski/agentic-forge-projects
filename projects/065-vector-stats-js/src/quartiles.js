/**
 * @file src/quartiles.js
 * @description Implements functions to calculate quartiles (Q1, Q3) and the interquartile range (IQR).
 *
 * This module provides functions to determine the boundaries of data segments,
 * which are essential for understanding data distribution and identifying outliers.
 * The functions are implemented using a common interpolation method for quartiles.
 */

import { isValidAndNotEmpty } from './utils/validation.js';

/**
 * Calculates a specific percentile of a vector of numbers using linear interpolation.
 * This is a generalized helper function used to find Q1 (25th percentile) and
 * Q3 (75th percentile).
 *
 * The function first sorts the data. It then calculates the index corresponding
 * to the percentile. If the index is an integer, the percentile is the value
 * at that index. If the index is a fraction, it interpolates between the two
 * surrounding data points.
 *
 * This function creates a sorted copy of the input array and does not mutate it.
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @param {number} p - The percentile to calculate (a value between 0 and 1, e.g., 0.25 for Q1).
 * @returns {number} The value at the specified percentile, or `NaN` if the input array is empty.
 * @private
 */
const percentile = (data, p) => {
  if (!isValidAndNotEmpty(data)) {
    return NaN;
  }

  // Create a sorted copy to avoid mutating the original array.
  const sortedData = [...data].sort((a, b) => a - b);
  const n = sortedData.length;

  // Calculate the 0-based index. For a percentile 'p', the position is p * (n - 1).
  // This is a common method (e.g., used by NumPy, Excel's PERCENTILE.INC).
  const index = p * (n - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  // If the index is an integer, the value is directly at that index.
  if (lowerIndex === upperIndex) {
    return sortedData[index];
  }

  // If the index is fractional, interpolate between the two surrounding values.
  const lowerValue = sortedData[lowerIndex];
  const upperValue = sortedData[upperIndex];
  const fraction = index - lowerIndex;

  return lowerValue + fraction * (upperValue - lowerValue);
};

/**
 * Calculates the first quartile (Q1) of a vector of numbers.
 * Q1 is the 25th percentile, meaning 25% of the data falls below this value.
 * It represents the median of the lower half of the dataset.
 *
 * @example
 * // returns 2.5
 * q1([1, 2, 3, 4, 5, 6, 7, 8]);
 *
 * @example
 * // returns 2
 * q1([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The first quartile (Q1), or `NaN` if the input array is empty.
 */
export const q1 = (data) => {
  return percentile(data, 0.25);
};

/**
 * Calculates the third quartile (Q3) of a vector of numbers.
 * Q3 is the 75th percentile, meaning 75% of the data falls below this value.
 * It represents the median of the upper half of the dataset.
 *
 * @example
 * // returns 6.5
 * q3([1, 2, 3, 4, 5, 6, 7, 8]);
 *
 * @example
 * // returns 4
 * q3([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The third quartile (Q3), or `NaN` if the input array is empty.
 */
export const q3 = (data) => {
  return percentile(data, 0.75);
};

/**
 * Calculates the interquartile range (IQR) of a vector of numbers.
 * The IQR is the difference between the third quartile (Q3) and the first
 * quartile (Q1). It measures statistical dispersion and is a key component
 * in identifying outliers in a dataset.
 *
 * Formula: IQR = Q3 - Q1
 *
 * @example
 * // returns 4
 * iqr([1, 2, 3, 4, 5, 6, 7, 8]); // Q3 (6.5) - Q1 (2.5)
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The interquartile range, or `NaN` if the input array is empty.
 */
export const iqr = (data) => {
  // The percentile function handles the empty array case, returning NaN.
  const firstQuartile = q1(data);
  const thirdQuartile = q3(data);

  // If either quartile is NaN, the result of the subtraction will also be NaN.
  return thirdQuartile - firstQuartile;
};