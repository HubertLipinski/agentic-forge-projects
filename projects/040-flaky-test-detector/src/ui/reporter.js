/**
 * @file src/ui/reporter.js
 * @description Handles formatting and printing the final report to the console,
 * using `chalk` for colors and summarizing flaky tests. This module is responsible
 * for presenting the analysis results in a human-readable format.
 */

import chalk from 'chalk';
import { TEST_CLASSIFICATION } from '../config/constants.js';

/**
 * Formats a success rate percentage with appropriate color coding.
 * - 100%: Green
 * - (0%, 100%): Yellow
 * - 0%: Red
 *
 * @param {number} rate - The success rate (0-100).
 * @returns {string} The formatted and colored success rate string.
 */
function formatSuccessRate(rate) {
  const rateString = `${rate.toFixed(2)}%`;
  if (rate === 100) {
    return chalk.green(rateString);
  }
  if (rate > 0) {
    return chalk.yellow(rateString);
  }
  return chalk.red(rateString);
}

/**
 * Formats the pass/fail counts for a single test.
 * Example: `(Passed: 8, Failed: 2)`
 *
 * @param {number} passes - The number of passes.
 * @param {number} failures - The number of failures.
 * @returns {string} The formatted count string.
 */
function formatCounts(passes, failures) {
  const passStr = `${chalk.green(passes)} passed`;
  const failStr = `${chalk.red(failures)} failed`;
  return chalk.gray(`(${passStr}, ${failStr})`);
}

/**
 * Prints a section for a specific test classification (e.g., Flaky Tests).
 * If there are no tests in the section, it prints nothing.
 *
 * @param {string} title - The title of the section (e.g., "Flaky Tests").
 * @param {Array<object>} tests - An array of test objects to display.
 * @param {import('chalk').Chalk} titleColor - The chalk color function for the title.
 */
function printTestSection(title, tests, titleColor) {
  if (tests.length === 0) {
    return;
  }

  console.log(`\n${titleColor.bold.underline(title)} (${tests.length})`);
  for (const test of tests) {
    const successRateStr = formatSuccessRate(test.successRate);
    const countsStr = formatCounts(test.passes, test.failures);
    console.log(
      `  ${chalk.cyan(test.name)} - ${successRateStr} success ${countsStr}`,
    );
  }
}

/**
 * Renders the final summary report to the console.
 * This is the main entry point for displaying results after all test runs are complete.
 *
 * @param {object} summary - The summary object from ResultAggregator.
 * @param {number} summary.totalRuns - Total number of test suites executed.
 * @param {number} summary.totalTests - Total unique tests found.
 * @param {Array<object>} summary.flakyTests - Array of flaky tests.
 * @param {Array<object>} summary.failedTests - Array of consistently failing tests.
 * @param {Array<object>} summary.stableTests - Array of stable tests.
 * @param {object} options - Display options.
 * @param {boolean} [options.showStable=false] - Whether to include stable tests in the report.
 */
export function printFinalReport(
  summary,
  { showStable = false } = {},
) {
  const { totalRuns, totalTests, flakyTests, failedTests, stableTests } =
    summary;

  console.log('\n' + chalk.bold.magenta('='.repeat(50)));
  console.log(chalk.bold.magenta.inverse(' Flaky Test Detector Report '));
  console.log(chalk.bold.magenta('='.repeat(50)));

  console.log(
    `\nAnalysis complete. Found ${chalk.bold(totalTests)} unique tests across ${chalk.bold(totalRuns)} runs.`,
  );

  printTestSection(
    'Flaky Tests',
    flakyTests,
    chalk.yellow,
  );
  printTestSection(
    'Consistently Failing Tests',
    failedTests,
    chalk.red,
  );

  if (showStable) {
    printTestSection('Stable Tests', stableTests, chalk.green);
  }

  console.log('\n' + chalk.bold.magenta('='.repeat(50)) + '\n');

  if (flakyTests.length === 0 && failedTests.length === 0) {
    console.log(
      chalk.green.bold('🎉 Success! No flaky or failing tests were detected.'),
    );
  } else {
    console.log(
      chalk.yellow(
        `💡 Tip: Investigate the tests listed above to improve your suite's reliability.`,
      ),
    );
  }
}

/**
 * Renders an intermediate report, typically used when the process is interrupted.
 * It provides a summary of the data collected so far.
 *
 * @param {object} summary - The summary object from ResultAggregator.
 */
export function printIntermediateReport(summary) {
  const { totalRuns, flakyTests, failedTests } = summary;

  console.log('\n' + chalk.bold.blue('='.repeat(50)));
  console.log(chalk.bold.blue.inverse(' Intermediate Report (Run Interrupted) '));
  console.log(chalk.bold.blue('='.repeat(50)));

  if (totalRuns === 0) {
    console.log(
      chalk.yellow('\nNo test runs were completed before interruption.'),
    );
    console.log(chalk.bold.blue('='.repeat(50)) + '\n');
    return;
  }

  console.log(
    `\nAnalysis based on ${chalk.bold(totalRuns)} completed runs:`,
  );

  printTestSection(
    'Potentially Flaky Tests',
    flakyTests,
    chalk.yellow,
  );
  printTestSection(
    'Potentially Failing Tests',
    failedTests,
    chalk.red,
  );

  if (flakyTests.length === 0 && failedTests.length === 0) {
    console.log(
      chalk.green(
        '\nNo flaky or failing tests were detected in the completed runs.',
      ),
    );
  }

  console.log('\n' + chalk.bold.blue('='.repeat(50)) + '\n');
}

/**
 * Displays a summary of the configuration before starting the test runs.
 *
 * @param {object} config - The final, merged configuration object.
 */
export function printConfigSummary(config) {
  console.log(chalk.bold.cyan('Starting flaky test detection with the following configuration:'));
  console.log(`  - ${chalk.bold('Command:')}   ${chalk.gray(config.command)}`);
  console.log(`  - ${chalk.bold('Runs:')}      ${chalk.gray(config.runs)}`);
  console.log(`  - ${chalk.bold('Parallel:')}  ${chalk.gray(config.parallel)}`);
  console.log(`  - ${chalk.bold('Parser:')}    ${chalk.gray(config.parser)}`);
  console.log(''); // Add a blank line for spacing
}