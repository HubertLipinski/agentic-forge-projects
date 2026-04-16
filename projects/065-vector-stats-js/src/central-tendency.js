/**
 * @file src/central-tendency.js
 * @description Implements functions for measures of central tendency.
 *
 * This module provides functions to calculate the mean (average), median,
 * and mode of a numerical vector. These functions are fundamental to
 * descriptive statistics, summarizing the "center" of a dataset.
 * They are designed to be robust, handling edge cases like empty arrays
 * gracefully by returning `NaN`.
 */

import { isValidAndNotEmpty } from './utils/validation.js';
import { sum } from './range.js';

/**
 * Calculates the arithmetic mean (average) of a vector of numbers.
 * The mean is the sum of all values divided by the number of values.
 *
 * @example
 * // returns 3
 * mean([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The mean of the numbers, or `NaN` if the input array is empty.
 */
export const mean = (data) => {
  if (!isValidAndNotEmpty(data)) {
    return NaN;
  }
  return sum(data) / data.length;
};

/**
 * Calculates the median of a vector of numbers.
 * The median is the middle value of a sorted dataset. If the dataset has an
 * even number of values, the median is the average of the two middle values.
 *
 * This function creates a sorted copy of the input array and does not mutate it.
 *
 * @example
 * // returns 3
 * median([1, 5, 2, 8, 3]);
 *
 * @example
 * // returns 3.5
 * median([1, 5, 2, 8, 3, 10]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {number} The median of the numbers, or `NaN` if the input array is empty.
 */
export const median = (data) => {
  if (!isValidAndNotEmpty(data)) {
    return NaN;
  }

  // Create a sorted copy to avoid mutating the original array.
  const sortedData = [...data].sort((a, b) => a - b);
  const midIndex = Math.floor(sortedData.length / 2);

  // If the array has an odd number of elements, the median is the middle element.
  if (sortedData.length % 2 !== 0) {
    return sortedData[midIndex];
  }

  // If the array has an even number of elements, the median is the average
  // of the two middle elements.
  return (sortedData[midIndex - 1] + sortedData[midIndex]) / 2;
};

/**
 * Calculates the mode(s) of a vector of numbers.
 * The mode is the value that appears most frequently in a dataset. A dataset
 * can have one mode (unimodal), more than one mode (multimodal), or no mode
 * if all values appear with the same frequency.
 *
 * This function always returns an array of the most frequent values.
 * - If all values are unique, it returns an empty array (no mode).
 * - If multiple values share the highest frequency, it returns all of them.
 *
 * @example
 * // returns [2]
 * mode([1, 2, 2, 3, 4]);
 *
 * @example
 * // returns [2, 4] (sorted)
 * mode([1, 2, 2, 3, 4, 4]);
 *
 * @example
 * // returns []
 * mode([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers.
 * @returns {Array<number>} An array containing the mode(s), sorted in
 *   ascending order. Returns an empty array if the input is empty or has no mode.
 */
export const mode = (data) => {
  if (!isValidAndNotEmpty(data) || data.length < 2) {
    return [];
  }

  const frequencyMap = new Map();
  let maxFrequency = 0;

  for (const num of data) {
    const currentCount = (frequencyMap.get(num) ?? 0) + 1;
    frequencyMap.set(num, currentCount);
    if (currentCount > maxFrequency) {
      maxFrequency = currentCount;
    }
  }

  // If maxFrequency is 1, all elements are unique, so there is no mode.
  if (maxFrequency <= 1) {
    return [];
  }

  const modes = [];
  for (const [num, freq] of frequencyMap.entries()) {
    if (freq === maxFrequency) {
      modes.push(num);
    }
  }

  // Return modes sorted in ascending order for consistent output.
  return modes.sort((a, b) => a - b);
};