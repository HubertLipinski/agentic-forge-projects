/**
 * @fileoverview Generates the final comparison report.
 * This module takes the processed benchmark results and formats them for display,
 * supporting both a terminal-friendly table view (using 'table') and a
 * structured JSON output for programmatic use.
 */

import { table } from 'table';
import logger from '../utils/logger.js';
import { calculatePercentageChange } from '../utils/stats.js';

/**
 * Formats a number for display in the report.
 * Rounds to two decimal places and adds a sign for changes.
 * @param {number} num - The number to format.
 * @param {boolean} [isChange=false] - If true, adds a '+' for positive numbers.
 * @returns {string} The formatted number as a string.
 */
function formatNumber(num, isChange = false) {
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    return 'N/A';
  }
  const sign = isChange && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}`;
}

/**
 * Determines the color style for a percentage change based on its value.
 * @param {number} change - The percentage change.
 * @param {number} threshold - The regression threshold (a negative number).
 * @returns {function} A chalk styling function (e.g., `chalk.green`).
 */
function getChangeColor(change, threshold) {
  if (typeof change !== 'number' || !Number.isFinite(change)) {
    return logger.style.neutral;
  }
  if (change > 0) {
    return logger.style.improvement; // Improvement
  }
  if (change < threshold) {
    return logger.style.regression; // Significant regression
  }
  return logger.style.neutral; // Neutral or insignificant regression
}

/**
 * Generates a human-readable summary report as a string, formatted as a table.
 *
 * @param {object} analysisResults - The comprehensive analysis results.
 * @param {object} analysisResults.baseline - Results for the baseline ref.
 * @param {object} analysisResults.feature - Results for the feature ref.
 * @param {object} analysisResults.comparison - The comparison between baseline and feature.
 * @param {object} config - The application configuration.
 * @returns {string} The formatted table string for printing to the console.
 */
function generateTableReport(analysisResults, config) {
  const { baseline, feature, comparison } = analysisResults;
  const { regressionThreshold } = config;

  const header = [
    logger.style.header('Metric'),
    logger.style.header(`Baseline (${baseline.ref})`),
    logger.style.header(`Feature (${feature.ref})`),
    logger.style.header('Change (%)'),
    logger.style.header('Conclusion'),
  ];

  const data = [header];

  for (const metricName in comparison) {
    if (Object.hasOwnProperty.call(comparison, metricName)) {
      const metricComparison = comparison[metricName];
      const baselineStats = baseline.stats[metricName];
      const featureStats = feature.stats[metricName];

      const change = metricComparison.percentageChange;
      const changeColor = getChangeColor(change, regressionThreshold);

      let conclusion = 'Neutral';
      if (change > 0) conclusion = 'Improvement';
      else if (change < regressionThreshold) conclusion = 'Regression';

      const row = [
        logger.style.metric(metricName),
        `${formatNumber(baselineStats?.mean ?? NaN)} ± ${formatNumber(baselineStats?.stdev ?? NaN)}`,
        `${formatNumber(featureStats?.mean ?? NaN)} ± ${formatNumber(featureStats?.stdev ?? NaN)}`,
        changeColor(`${formatNumber(change, true)}%`),
        changeColor(conclusion),
      ];
      data.push(row);
    }
  }

  const tableConfig = {
    border: {
      topBody: `─`,
      topJoin: `┬`,
      topLeft: `┌`,
      topRight: `┐`,
      bottomBody: `─`,
      bottomJoin: `┴`,
      bottomLeft: `└`,
      bottomRight: `┘`,
      bodyLeft: `│`,
      bodyRight: `│`,
      bodyJoin: `│`,
      joinBody: `─`,
      joinLeft: `├`,
      joinRight: `┤`,
      joinJoin: `┼`,
    },
    columns: {
      3: { alignment: 'right' }, // Align 'Change (%)' to the right
    },
  };

  let report = `\n${logger.style.header('Performance Impact Analysis Report')}\n\n`;
  report += `Baseline: ${logger.style.ref(baseline.ref)} (${baseline.commit.sha}) - "${baseline.commit.message}"\n`;
  report += `Feature:  ${logger.style.ref(feature.ref)} (${feature.commit.sha}) - "${feature.commit.message}"\n\n`;

  if (data.length <= 1) {
    report += logger.style.neutral('No common metrics found to compare between baseline and feature runs.\n');
  } else {
    report += table(data, tableConfig);
    report += `\nRegression threshold: ${regressionThreshold.toFixed(1)}%. Runs per ref: ${config.runs}.\n`;
  }

  return report;
}

/**
 * Generates a machine-readable JSON report as a string.
 * This output is suitable for consumption by other tools or CI/CD scripts.
 *
 * @param {object} analysisResults - The comprehensive analysis results.
 * @returns {string} A stringified JSON object representing the report.
 */
function generateJsonReport(analysisResults) {
  // Use structuredClone for a deep, safe copy to avoid any potential mutation
  // of the original results object.
  const reportJson = structuredClone(analysisResults);
  return JSON.stringify(reportJson, null, 2);
}

/**
 * The main function of this module. It orchestrates the report generation
 * based on the provided configuration (table or JSON).
 *
 * @param {object} analysisResults - The final results from the orchestrator.
 * @param {object} config - The application configuration, which includes the output format.
 * @returns {string} The generated report in the specified format.
 */
export function generateReport(analysisResults, config) {
  if (config.json) {
    return generateJsonReport(analysisResults);
  }
  return generateTableReport(analysisResults, config);
}

/**
 * Analyzes the comparison results to determine if a significant regression occurred.
 * A regression is considered significant if the percentage change for any metric
 * is less than the configured `regressionThreshold`.
 *
 * @param {object} comparisonResults - The comparison part of the analysis results.
 * @param {number} regressionThreshold - The threshold for what is considered a regression (e.g., -5.0).
 * @returns {boolean} `true` if a significant regression is detected, otherwise `false`.
 */
export function hasSignificantRegression(comparisonResults, regressionThreshold) {
  if (!comparisonResults || typeof comparisonResults !== 'object') {
    return false;
  }

  for (const metricName in comparisonResults) {
    if (Object.hasOwnProperty.call(comparisonResults, metricName)) {
      const change = comparisonResults[metricName].percentageChange;
      // Check if the change is a finite number and below the threshold.
      if (Number.isFinite(change) && change < regressionThreshold) {
        logger.warn(
          `Significant regression detected for metric "${metricName}": ${formatNumber(change, true)}% is below the threshold of ${regressionThreshold}%.`
        );
        return true;
      }
    }
  }

  return false;
}