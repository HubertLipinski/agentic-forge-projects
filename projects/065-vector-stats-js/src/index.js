/**
 * @file src/index.js
 * @description Main library entry point for Vector Stats JS.
 *
 * This file aggregates and exports all public statistical functions from the
 * various modules within the library. It serves as the single interface for
 * developers who want to use `vector-stats-js` programmatically in their own
 * Node.js projects.
 *
 * It also exports the `sanitizeNumericArray` utility, allowing users to
 * preprocess their data using the same logic the library uses internally.
 *
 * @example
 * import { mean, median, sanitizeNumericArray } from 'vector-stats-js';
 *
 * const rawData = ['1', '5', '2', 'invalid', 8];
 * const numbers = sanitizeNumericArray(rawData); // -> [1, 5, 2, 8]
 *
 * console.log(`Mean: ${mean(numbers)}`);     // -> Mean: 4
 * console.log(`Median: ${median(numbers)}`); // -> Median: 3.5
 */

// --- Measures of Central Tendency ---
export { mean, median, mode } from './central-tendency.js';

// --- Measures of Statistical Dispersion ---
export {
  populationVariance,
  sampleVariance,
  populationStandardDeviation,
  sampleStandardDeviation,
} from './dispersion.js';

// --- Range-based Calculations ---
export { sum, min, max, range } from './range.js';

// --- Quartiles and Interquartile Range ---
export { q1, q3, iqr } from './quartiles.js';

// --- Utility Functions ---
export { sanitizeNumericArray } from './utils/validation.js';