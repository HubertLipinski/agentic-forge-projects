/**
 * @file examples/programmatic-use.js
 * @description Demonstrates how to import and use the vector-stats-js library functions.
 *
 * This example showcases the programmatic API of `vector-stats-js`. It covers:
 * 1. Importing statistical functions and the sanitizer utility.
 * 2. Handling a mixed-type array by cleaning it with `sanitizeNumericArray`.
 * 3. Calculating and displaying a comprehensive set of statistics for the sanitized data.
 * 4. Demonstrating how edge cases (like empty arrays) are handled gracefully, returning NaN.
 */

// Import all necessary functions from the library's main entry point.
// In a real project, you would use `import * as stats from 'vector-stats-js';`
// after installing the package. For this example, we import from the local source.
import {
  mean,
  median,
  mode,
  sum,
  min,
  max,
  range,
  q1,
  q3,
  iqr,
  sampleVariance,
  sampleStandardDeviation,
  populationVariance,
  populationStandardDeviation,
  sanitizeNumericArray,
} from '../src/index.js';

/**
 * A simple utility to format and log a key-value pair.
 * @param {string} label - The name of the statistic.
 * @param {number | number[] | string} value - The calculated value.
 */
const logStat = (label, value) => {
  const formattedValue = Array.isArray(value)
    ? `[${value.join(', ')}]`
    : typeof value === 'number'
      ? value.toFixed(4)
      : value;
  console.log(`- ${label.padEnd(25)}: ${formattedValue}`);
};

/**
 * Main function to run the demonstration.
 */
const main = () => {
  console.log('--- Vector Stats JS Programmatic Usage Example ---');
  console.log('\n');

  // --- 1. Basic Usage with Clean Data ---
  console.log('Section 1: Basic analysis on a clean numerical array.');
  const cleanData = [10, 2, 38, 23, 38, 23, 21, 10, 15, 12];
  console.log('Input Data:', cleanData);

  logStat('Count', cleanData.length);
  logStat('Sum', sum(cleanData));
  logStat('Min', min(cleanData));
  logStat('Max', max(cleanData));
  logStat('Range', range(cleanData));
  logStat('Mean (Average)', mean(cleanData));
  logStat('Median', median(cleanData));
  logStat('Mode', mode(cleanData));
  logStat('Q1 (25th percentile)', q1(cleanData));
  logStat('Q3 (75th percentile)', q3(cleanData));
  logStat('Interquartile Range (IQR)', iqr(cleanData));
  logStat('Sample Variance', sampleVariance(cleanData));
  logStat('Sample Std Deviation', sampleStandardDeviation(cleanData));
  logStat('Population Variance', populationVariance(cleanData));
  logStat('Population Std Deviation', populationStandardDeviation(cleanData));
  console.log('\n');

  // --- 2. Handling Messy Data with Sanitization ---
  console.log('Section 2: Analysis on a mixed-type array requiring sanitization.');
  const messyData = [
    '10', 2, null, '38', 23, '38', 23, 'not a number', 21, undefined, '10.5',
  ];
  console.log('Original Messy Data:', messyData);

  try {
    const sanitizedData = sanitizeNumericArray(messyData);
    console.log('Sanitized Data:', sanitizedData);

    logStat('Mean of sanitized data', mean(sanitizedData));
    logStat('Median of sanitized data', median(sanitizedData));
  } catch (error) {
    // The sanitizer throws a TypeError if the input isn't an array.
    console.error('An error occurred during sanitization:', error.message);
  }
  console.log('\n');

  // --- 3. Edge Case: Empty Array ---
  console.log('Section 3: Demonstrating graceful handling of an empty array.');
  const emptyData = [];
  console.log('Input Data:', emptyData);

  // Most functions return NaN, Infinity, or an empty array for empty inputs.
  logStat('Mean on empty data', mean(emptyData)); // NaN
  logStat('Median on empty data', median(emptyData)); // NaN
  logStat('Mode on empty data', mode(emptyData)); // []
  logStat('Sum on empty data', sum(emptyData)); // 0
  logStat('Min on empty data', min(emptyData)); // Infinity
  logStat('Max on empty data', max(emptyData)); // -Infinity
  logStat('Sample Variance on empty', sampleVariance(emptyData)); // NaN
  console.log('\n');

  console.log('--- End of Example ---');
};

// Execute the main function.
main();