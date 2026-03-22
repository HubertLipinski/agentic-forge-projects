/**
 * @file src/main.js
 * @description The main application logic, orchestrating configuration, parallel
 * test runners, analysis, and reporting. This is the core of the flaky test detector.
 */

import { runTestCommand } from './runner/test-command-runner.js';
import { getParser } from './parsers/index.js';
import ResultAggregator from './analyzer/result-aggregator.js';
import {
  printConfigSummary,
  printFinalReport,
  printIntermediateReport,
} from './ui/reporter.js';
import {
  startSpinner,
  updateSpinnerText,
  succeedSpinner,
  failSpinner,
  warnSpinner,
  stopSpinner,
} from './ui/spinner.js';
import { RUN_OUTCOME } from './config/constants.js';

// AbortController to allow for graceful shutdown on SIGINT (Ctrl+C).
const abortController = new AbortController();
let isShuttingDown = false;

/**
 * Executes a single test run, parses its output, and returns the results.
 * @param {object} config - The application configuration.
 * @param {object} parser - The parser instance for the configured test runner.
 * @returns {Promise<{runOutcome: string, testResults: Array<object>}>} The outcome of the run and the parsed test results.
 */
async function executeAndParseRun(config, parser) {
  const { outcome, output, error } = await runTestCommand(config.command, {
    cwd: config.cwd,
    signal: abortController.signal,
  });

  if (outcome === RUN_OUTCOME.CANCELLED) {
    return { runOutcome: outcome, testResults: [] };
  }

  try {
    const testResults = parser.parse(output);
    return { runOutcome: outcome, testResults };
  } catch (parseError) {
    // If parsing fails, it's a critical issue with the user's config or the parser itself.
    // We treat this as a failed run and log the error.
    console.error(
      `\nError parsing test output: ${parseError.message}\nRaw output:\n${output}`,
    );
    return { runOutcome: RUN_OUTCOME.FAILURE, testResults: [] };
  }
}

/**
 * Manages the parallel execution of test runs. It creates a pool of workers
 * that run tests concurrently up to the specified limit.
 *
 * @param {object} config - The application configuration.
 * @param {object} parser - The parser instance.
 * @param {ResultAggregator} aggregator - The aggregator to store results.
 * @returns {Promise<boolean>} A promise that resolves to `true` if all runs completed successfully, `false` otherwise.
 */
async function runInParallel(config, parser, aggregator) {
  const { runs, parallel, exitOnFirstFailure } = config;
  const totalRuns = runs;
  let completedRuns = 0;
  let hasCriticalFailure = false;

  const runQueue = Array.from({ length: totalRuns }, (_, i) => i + 1);

  const worker = async () => {
    while (runQueue.length > 0) {
      if (isShuttingDown) break;

      const runNumber = runQueue.shift();
      if (runNumber === undefined) continue;

      const { runOutcome, testResults } = await executeAndParseRun(
        config,
        parser,
      );

      if (isShuttingDown) break; // Check again after the async operation

      aggregator.addRunResults(testResults);
      completedRuns++;
      updateSpinnerText(
        `Running tests... (${completedRuns}/${totalRuns} completed)`,
      );

      if (runOutcome === RUN_OUTCOME.FAILURE && exitOnFirstFailure) {
        hasCriticalFailure = true;
        // Signal all other workers to stop by clearing the queue and aborting.
        runQueue.length = 0;
        if (!abortController.signal.aborted) {
          abortController.abort();
        }
        break;
      }
    }
  };

  const workers = Array.from({ length: Math.min(parallel, totalRuns) }, () =>
    worker(),
  );

  await Promise.all(workers);

  return !hasCriticalFailure;
}

/**
 * Sets up a listener for SIGINT (Ctrl+C) to enable graceful shutdown.
 * On interruption, it generates an intermediate report.
 *
 * @param {ResultAggregator} aggregator - The result aggregator instance.
 * @param {object} config - The application configuration.
 */
function setupGracefulShutdown(aggregator, config) {
  process.on('SIGINT', () => {
    if (isShuttingDown) {
      console.log('\nForcing exit...');
      process.exit(1);
    }
    isShuttingDown = true;

    warnSpinner('Interruption signal received. Shutting down gracefully...');
    console.log(
      '\nWaiting for ongoing test runs to finish. Press Ctrl+C again to force exit.',
    );

    if (!abortController.signal.aborted) {
      abortController.abort();
    }

    // The main loop will break, and then we print the intermediate report.
    // We add a listener to the 'exit' event to ensure the report is printed.
    process.on('exit', () => {
      const summary = aggregator.getSummary(config);
      printIntermediateReport(summary);
    });
  });
}

/**
 * The main entry point for the flaky test detector application.
 * It orchestrates the entire process from configuration to final report.
 *
 * @param {object} config - The final, merged configuration object.
 * @returns {Promise<boolean>} A promise that resolves to `true` if flaky tests were found, `false` otherwise.
 */
export async function run(config) {
  try {
    printConfigSummary(config);

    const parser = getParser(config.parser);
    const aggregator = new ResultAggregator();

    setupGracefulShutdown(aggregator, config);

    startSpinner(`Running tests... (0/${config.runs} completed)`);

    const allRunsCompleted = await runInParallel(config, parser, aggregator);

    if (isShuttingDown) {
      // The SIGINT handler will print the intermediate report on exit.
      return true; // Indicate that the process was interrupted.
    }

    if (!allRunsCompleted && config.exitOnFirstFailure) {
      failSpinner(
        `Execution stopped after first failure as per 'exitOnFirstFailure' option.`,
      );
    } else {
      succeedSpinner('All test runs completed.');
    }

    stopSpinner(); // Ensure spinner is stopped before printing the report.

    const summary = aggregator.getSummary(config);
    printFinalReport(summary, { showStable: config.showStable });

    return summary.flakyTests.length > 0 || summary.failedTests.length > 0;
  } catch (error) {
    failSpinner('An unexpected error occurred.');
    console.error(`\nError: ${error.message}`);
    // For debugging, one might want to log the stack trace.
    // console.error(error.stack);
    return true; // Indicate failure
  }
}