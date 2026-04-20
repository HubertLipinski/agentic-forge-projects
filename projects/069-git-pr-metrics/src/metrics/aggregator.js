/**
 * @file src/metrics/aggregator.js
 * @description Aggregates individual PR metrics into a final summary report, calculating averages, medians, and identifying outliers.
 */

/**
 * Calculates the average of a given array of numbers.
 * Returns 0 if the array is empty to avoid division by zero errors.
 *
 * @private
 * @param {number[]} numbers - An array of numbers.
 * @returns {number} The average of the numbers.
 */
function calculateAverage(numbers) {
  if (!numbers || numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return sum / numbers.length;
}

/**
 * Calculates the median of a given array of numbers.
 * The median is the middle value in a sorted list of numbers.
 * Returns 0 if the array is empty.
 *
 * @private
 * @param {number[]} numbers - An array of numbers.
 * @returns {number} The median of the numbers.
 */
function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) {
    return 0;
  }

  // Create a sorted copy of the array to avoid mutating the original.
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // If the array has an even number of elements, the median is the average of the two middle elements.
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    // If the array has an odd number of elements, the median is the middle element.
    return sorted[mid];
  }
}

/**
 * Finds the outlier pull request based on a specific metric.
 *
 * @private
 * @param {Array<object>} calculatedPrs - The array of PRs with calculated metrics.
 * @param {string} metricKey - The key of the metric to evaluate (e.g., 'timeToMergeHours').
 * @param {'max' | 'min'} mode - Whether to find the maximum or minimum value.
 * @returns {object|null} The PR object that is the outlier, or null if the input array is empty.
 */
function findOutlier(calculatedPrs, metricKey, mode = 'max') {
  if (!calculatedPrs || calculatedPrs.length === 0) {
    return null;
  }

  return calculatedPrs.reduce((outlier, currentPr) => {
    const outlierValue = outlier[metricKey];
    const currentValue = currentPr[metricKey];

    if (mode === 'max' && currentValue > outlierValue) {
      return currentPr;
    }
    if (mode === 'min' && currentValue < outlierValue) {
      return currentPr;
    }
    return outlier;
  }, calculatedPrs[0]);
}

/**
 * Aggregates metrics from a list of processed pull requests into a summary report.
 *
 * This function is the final step in the data processing pipeline before rendering.
 * It takes an array of individual PR metrics and computes summary statistics like
 * totals, averages, and medians, and identifies key outliers.
 *
 * @param {Array<object>} calculatedPrs - An array of PR metric objects from `calculator.js`.
 *   Each object is expected to have properties like `timeToMergeHours`, `totalChanges`, etc.
 * @returns {object} A summary report object containing aggregated metrics.
 * @throws {Error} If the input `calculatedPrs` is not an array.
 */
export function aggregateMetrics(calculatedPrs) {
  if (!Array.isArray(calculatedPrs)) {
    throw new Error('Invalid input: Expected an array of calculated PRs.');
  }

  const prCount = calculatedPrs.length;

  if (prCount === 0) {
    return {
      prCount: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      totalChanges: 0,
      netCodeChurn: 0,
      avgTimeToMerge: 0,
      medianTimeToMerge: 0,
      avgPrSize: 0,
      medianPrSize: 0,
      prSizeDistribution: {},
      longestPr: null,
      largestPr: null,
    };
  }

  // Extract numerical data into arrays for statistical calculations.
  const timeToMergeValues = calculatedPrs.map((pr) => pr.timeToMergeHours);
  const prSizeValues = calculatedPrs.map((pr) => pr.totalChanges);

  // Calculate totals for additions, deletions, and changes.
  const { totalAdditions, totalDeletions, totalChanges, netCodeChurn } =
    calculatedPrs.reduce(
      (totals, pr) => {
        totals.totalAdditions += pr.additions;
        totals.totalDeletions += pr.deletions;
        totals.totalChanges += pr.totalChanges;
        totals.netCodeChurn += pr.codeChurn;
        return totals;
      },
      {
        totalAdditions: 0,
        totalDeletions: 0,
        totalChanges: 0,
        netCodeChurn: 0,
      },
    );

  // Calculate PR size distribution (e.g., { 'S': 5, 'M': 10, 'L': 2 }).
  const prSizeDistribution = calculatedPrs.reduce((dist, pr) => {
    dist[pr.prSize] = (dist[pr.prSize] || 0) + 1;
    return dist;
  }, {});

  // Identify outlier PRs.
  const longestPr = findOutlier(calculatedPrs, 'timeToMergeHours', 'max');
  const largestPr = findOutlier(calculatedPrs, 'totalChanges', 'max');

  // Assemble the final summary report.
  const summary = {
    prCount,
    totalAdditions,
    totalDeletions,
    totalChanges,
    netCodeChurn,
    avgTimeToMerge: calculateAverage(timeToMergeValues),
    medianTimeToMerge: calculateMedian(timeToMergeValues),
    avgPrSize: calculateAverage(prSizeValues),
    medianPrSize: calculateMedian(prSizeValues),
    prSizeDistribution,
    longestPr,
    largestPr,
  };

  return summary;
}