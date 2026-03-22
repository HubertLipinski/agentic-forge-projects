/**
 * @file src/analyzer/result-aggregator.js
 * @description A stateful class that aggregates results from multiple test runs,
 * tracking pass/fail counts for each individual test case to identify flakiness.
 */

import { TEST_STATUS, TEST_CLASSIFICATION } from '../config/constants.js';

/**
 * Represents the aggregated results for a single test case across all runs.
 * @typedef {object} TestCaseStats
 * @property {string} name - The name of the test case.
 * @property {number} passes - The number of times the test has passed.
 * @property {number} failures - The number of times the test has failed.
 * @property {number} totalRuns - The total number of times this test was seen.
 * @property {number} successRate - The success rate as a percentage (0-100).
 * @property {string} classification - The final classification of the test (stable, flaky, failure).
 */

/**
 * Aggregates results from multiple test runs to identify flaky tests.
 *
 * This class maintains a map of all unique test cases encountered and tracks their
 * pass/fail history. It provides methods to add new results from a run and to
 * generate a final summary report.
 */
class ResultAggregator {
  /**
   * A map to store the statistics for each unique test case.
   * The key is the test name (string), and the value is an object
   * containing pass/fail counts.
   *
   * @private
   * @type {Map<string, {passes: number, failures: number}>}
   */
  #testStats;

  /**
   * The total number of test suite runs that have been processed.
   * @private
   * @type {number}
   */
  #totalRunsProcessed;

  /**
   * Initializes a new ResultAggregator instance.
   */
  constructor() {
    this.#testStats = new Map();
    this.#totalRunsProcessed = 0;
  }

  /**
   * Processes an array of test results from a single run and updates the
   * aggregate statistics.
   *
   * @param {Array<{name: string, status: string}>} testResults - An array of
   * test result objects from the parser. Each object should have a `name` and a `status`.
   */
  addRunResults(testResults) {
    if (!Array.isArray(testResults)) {
      // Defensive check for invalid input.
      return;
    }

    this.#totalRunsProcessed += 1;

    for (const result of testResults) {
      // Ensure the result object is valid before processing.
      if (
        !result ||
        typeof result.name !== 'string' ||
        !result.name.trim()
      ) {
        continue;
      }

      const testName = result.name.trim();

      // Initialize stats for a newly discovered test case.
      if (!this.#testStats.has(testName)) {
        this.#testStats.set(testName, { passes: 0, failures: 0 });
      }

      const stats = this.#testStats.get(testName);

      // Update pass/fail counts based on the result status.
      if (result.status === TEST_STATUS.PASSED) {
        stats.passes += 1;
      } else if (result.status === TEST_STATUS.FAILED) {
        stats.failures += 1;
      }
      // Note: Tests with 'unknown' status are ignored.
    }
  }

  /**
   * Generates a comprehensive summary of all aggregated test results.
   * It calculates success rates and classifies each test as stable, flaky, or a failure.
   *
   * @param {object} config - The application configuration.
   * @param {number} config.flakyThreshold - The success rate below which a test is not considered flaky (but a failure).
   * @returns {{
   *   totalRuns: number,
   *   totalTests: number,
   *   stableTests: TestCaseStats[],
   *   flakyTests: TestCaseStats[],
   *   failedTests: TestCaseStats[]
   * }} An object containing the full report.
   */
  getSummary({ flakyThreshold = 0 } = {}) {
    const allTests = [];

    for (const [name, { passes, failures }] of this.#testStats.entries()) {
      const totalRuns = passes + failures;
      if (totalRuns === 0) continue; // Should not happen, but safeguard.

      const successRate = (passes / totalRuns) * 100;

      const classification = this.#classifyTest(successRate, flakyThreshold);

      allTests.push({
        name,
        passes,
        failures,
        totalRuns,
        successRate,
        classification,
      });
    }

    // Sort tests alphabetically for consistent reporting.
    allTests.sort((a, b) => a.name.localeCompare(b.name));

    return {
      totalRuns: this.#totalRunsProcessed,
      totalTests: this.#testStats.size,
      stableTests: allTests.filter(
        (t) => t.classification === TEST_CLASSIFICATION.STABLE,
      ),
      flakyTests: allTests.filter(
        (t) => t.classification === TEST_CLASSIFICATION.FLAKY,
      ),
      failedTests: allTests.filter(
        (t) => t.classification === TEST_CLASSIFICATION.FAILURE,
      ),
    };
  }

  /**
   * Classifies a test based on its success rate and the configured threshold.
   *
   * - **Stable**: Success rate is 100%.
   * - **Failure**: Success rate is at or below the `flakyThreshold`.
   * - **Flaky**: Success rate is between the `flakyThreshold` and 100%.
   *
   * @private
   * @param {number} successRate - The success rate of the test (0-100).
   * @param {number} flakyThreshold - The threshold for failure classification.
   * @returns {string} The classification ('stable', 'flaky', 'failure').
   */
  #classifyTest(successRate, flakyThreshold) {
    if (successRate === 100) {
      return TEST_CLASSIFICATION.STABLE;
    }
    if (successRate <= flakyThreshold) {
      return TEST_CLASSIFICATION.FAILURE;
    }
    return TEST_CLASSIFICATION.FLAKY;
  }

  /**
   * Resets the aggregator's state, clearing all tracked test statistics and run counts.
   * Useful for scenarios where the aggregator instance is reused.
   */
  reset() {
    this.#testStats.clear();
    this.#totalRunsProcessed = 0;
  }
}

export default ResultAggregator;