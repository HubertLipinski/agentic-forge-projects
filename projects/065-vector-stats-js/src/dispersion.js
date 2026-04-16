/**
 * @file src/dispersion.js
 * @description Implements functions for measures of statistical dispersion.
 *
 * This module provides functions to calculate variance and standard deviation,
 * for both populations and samples. These metrics quantify the amount of
 * variation or dispersion of a set of data values. The functions are designed
 * to be robust and handle edge cases gracefully.
 */

import { isValidAndNotEmpty } from './utils/validation.js';
import { mean } from './central-tendency.js';

/**
 * Calculates the population variance of a vector of numbers.
 * Population variance is used when the data represents the entire population of interest.
 * It is the average of the squared differences from the mean.
 *
 * Formula: σ² = Σ(xᵢ - μ)² / N
 * where μ is the population mean and N is the population size.
 *
 * @example
 * // returns 2
 * populationVariance([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers representing a population.
 * @returns {number} The population variance, or `NaN` if the input array is empty.
 */
export const populationVariance = (data) => {
  if (!isValidAndNotEmpty(data)) {
    return NaN;
  }

  const dataMean = mean(data);
  const n = data.length;

  // The sum of squared differences from the mean.
  const sumOfSquaredDiffs = data.reduce((acc, val) => {
    const diff = val - dataMean;
    return acc + (diff * diff);
  }, 0);

  return sumOfSquaredDiffs / n;
};

/**
 * Calculates the sample variance of a vector of numbers.
 * Sample variance is used when the data is a sample from a larger population.
 * It uses Bessel's correction (dividing by n-1) to provide an unbiased
 * estimate of the population variance.
 *
 * Formula: s² = Σ(xᵢ - x̄)² / (n - 1)
 * where x̄ is the sample mean and n is the sample size.
 *
 * @example
 * // returns 2.5
 * sampleVariance([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers representing a sample.
 * @returns {number} The sample variance, or `NaN` if the sample size is less than 2.
 */
export const sampleVariance = (data) => {
  if (!isValidAndNotEmpty(data) || data.length < 2) {
    // Variance is undefined for a single data point.
    return NaN;
  }

  const dataMean = mean(data);
  const n = data.length;

  // The sum of squared differences from the mean.
  const sumOfSquaredDiffs = data.reduce((acc, val) => {
    const diff = val - dataMean;
    return acc + (diff * diff);
  }, 0);

  // Apply Bessel's correction by dividing by (n - 1).
  return sumOfSquaredDiffs / (n - 1);
};

/**
 * Calculates the population standard deviation of a vector of numbers.
 * This is the square root of the population variance and measures the
 * average distance of data points from the population mean.
 *
 * Formula: σ = sqrt(Σ(xᵢ - μ)² / N)
 *
 * @example
 * // returns approx. 1.414
 * populationStandardDeviation([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers representing a population.
 * @returns {number} The population standard deviation, or `NaN` if the input array is empty.
 */
export const populationStandardDeviation = (data) => {
  const variance = populationVariance(data);
  // Math.sqrt(NaN) is NaN, so this handles the empty array case correctly.
  return Math.sqrt(variance);
};

/**
 * Calculates the sample standard deviation of a vector of numbers.
 * This is the square root of the sample variance and provides an unbiased
 * estimate of the population standard deviation.
 *
 * Formula: s = sqrt(Σ(xᵢ - x̄)² / (n - 1))
 *
 * @example
 * // returns approx. 1.581
 * sampleStandardDeviation([1, 2, 3, 4, 5]);
 *
 * @param {Array<number>} data - A sanitized array of numbers representing a sample.
 * @returns {number} The sample standard deviation, or `NaN` if the sample size is less than 2.
 */
export const sampleStandardDeviation = (data) => {
  const variance = sampleVariance(data);
  // Math.sqrt(NaN) is NaN, so this handles the n < 2 case correctly.
  return Math.sqrt(variance);
};