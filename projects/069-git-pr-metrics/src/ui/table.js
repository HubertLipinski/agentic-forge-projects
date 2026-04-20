/**
 * @file src/ui/table.js
 * @description Renders the final aggregated metrics into a formatted, colorful table for the console using `chalk`.
 */

import chalk from 'chalk';

/**
 * A collection of helper functions for formatting data for console output.
 * @private
 */
const format = {
  /**
   * Formats a number by rounding it and adding a unit.
   * @param {number} value - The numeric value.
   * @param {string} unit - The unit string (e.g., 'h', ' lines').
   * @param {number} [precision=1] - The number of decimal places.
   * @returns {string} The formatted string.
   */
  value: (value, unit, precision = 1) => {
    if (typeof value !== 'number' || isNaN(value)) {
      return chalk.gray('N/A');
    }
    const roundedValue = parseFloat(value.toFixed(precision));
    return `${chalk.yellow(roundedValue)}${chalk.dim(unit)}`;
  },

  /**
   * Formats a number as an integer.
   * @param {number} value - The numeric value.
   * @returns {string} The formatted integer string.
   */
  integer: (value) => {
    if (typeof value !== 'number' || isNaN(value)) {
      return chalk.gray('N/A');
    }
    return chalk.yellow(value.toLocaleString());
  },

  /**
   * Formats an outlier PR for display.
   * @param {object|null} pr - The outlier PR object.
   * @param {string} metricKey - The key of the metric that made this PR an outlier.
   * @param {string} unit - The unit for the metric.
   * @returns {string} The formatted string for the outlier.
   */
  outlier: (pr, metricKey, unit) => {
    if (!pr) {
      return chalk.gray('N/A');
    }
    const metricValue = pr[metricKey];
    const formattedValue =
      typeof metricValue === 'number' && metricValue > 100
        ? Math.round(metricValue)
        : metricValue;

    return `${chalk.cyan(`#${pr.prNumber}`)} (${format.value(
      formattedValue,
      unit,
      0,
    )})`;
  },

  /**
   * Formats the PR size distribution object into a readable string.
   * @param {object} distribution - The size distribution object (e.g., { S: 5, M: 10 }).
   * @returns {string} The formatted distribution string.
   */
  distribution: (distribution) => {
    const sizes = ['XS', 'S', 'M', 'L', 'XL'];
    if (!distribution || Object.keys(distribution).length === 0) {
      return chalk.gray('N/A');
    }
    return sizes
      .filter((size) => distribution[size])
      .map((size) => `${chalk.bold(size)}: ${chalk.yellow(distribution[size])}`)
      .join(chalk.dim(' | '));
  },
};

/**
 * Creates a single row for the summary table.
 *
 * @private
 * @param {string} label - The label for the metric.
 * @param {string} value - The formatted value of the metric.
 * @param {number} [labelWidth=30] - The width to pad the label to.
 * @returns {string} The formatted table row string.
 */
function createRow(label, value, labelWidth = 30) {
  const paddedLabel = `${label}:`.padEnd(labelWidth);
  return `  ${chalk.white(paddedLabel)} ${value}`;
}

/**
 * Renders the aggregated metrics summary into a clean, colorful, and human-readable format for the console.
 *
 * This function takes the final summary object and prints it section by section, using `chalk` for styling
 * to improve readability.
 *
 * @param {object} summary - The aggregated metrics summary object from `aggregator.js`.
 * @param {object} options - The CLI options used for the analysis.
 * @param {string} options.since - The start date of the analysis.
 * @param {string} options.until - The end date of the analysis.
 * @param {string} [options.author] - The author filter, if provided.
 */
export function renderSummaryTable(summary, { since, until, author }) {
  const {
    prCount,
    totalAdditions,
    totalDeletions,
    netCodeChurn,
    avgTimeToMerge,
    medianTimeToMerge,
    avgPrSize,
    medianPrSize,
    prSizeDistribution,
    longestPr,
    largestPr,
  } = summary;

  // Header Section
  console.log(chalk.bold.inverse('\n Git PR Metrics Summary '));
  console.log(
    `\n${chalk.dim('Period:')} ${chalk.green(
      new Date(since).toLocaleDateString(),
    )} ${chalk.dim('to')} ${chalk.green(
      new Date(until).toLocaleDateString(),
    )}`,
  );
  if (author) {
    console.log(`${chalk.dim('Author:')} ${chalk.green(author)}`);
  }

  // Handle the case where no PRs were found
  if (prCount === 0) {
    console.log(chalk.yellow('\nNo merged pull requests found for the selected period.'));
    return;
  }

  // Main Metrics Table
  console.log(chalk.bold.blue('\n--- Key Metrics ---'));
  console.log(createRow('Total Pull Requests', format.integer(prCount)));
  console.log(
    createRow(
      'Avg. Time to Merge',
      format.value(avgTimeToMerge, ' hours'),
    ),
  );
  console.log(
    createRow(
      'Median Time to Merge',
      format.value(medianTimeToMerge, ' hours'),
    ),
  );

  // Code Churn Section
  console.log(chalk.bold.blue('\n--- Code & Churn ---'));
  console.log(
    createRow(
      'Lines Added',
      `${chalk.green('+')}${format.integer(totalAdditions)}`,
    ),
  );
  console.log(
    createRow(
      'Lines Deleted',
      `${chalk.red('-')}${format.integer(totalDeletions)}`,
    ),
  );
  const churnColor = netCodeChurn >= 0 ? chalk.green : chalk.red;
  const churnSign = netCodeChurn >= 0 ? '+' : '';
  console.log(
    createRow(
      'Net Code Churn',
      churnColor(`${churnSign}${format.integer(netCodeChurn)}`),
    ),
  );

  // PR Size Section
  console.log(chalk.bold.blue('\n--- PR Size ---'));
  console.log(
    createRow(
      'Avg. PR Size',
      format.value(avgPrSize, ' lines', 0),
    ),
  );
  console.log(
    createRow(
      'Median PR Size',
      format.value(medianPrSize, ' lines', 0),
    ),
  );
  console.log(
    createRow('Size Distribution', format.distribution(prSizeDistribution)),
  );

  // Outliers Section
  console.log(chalk.bold.blue('\n--- Outliers ---'));
  console.log(
    createRow(
      'Longest Open PR',
      format.outlier(longestPr, 'timeToMergeHours', 'h'),
    ),
  );
  console.log(
    createRow(
      'Largest PR',
      format.outlier(largestPr, 'totalChanges', ' lines'),
    ),
  );

  console.log('\n'); // Add a final newline for clean exit
}