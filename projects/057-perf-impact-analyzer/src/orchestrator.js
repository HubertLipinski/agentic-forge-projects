import ora from 'ora';
import GitHandler from '../git/git-handler.js';
import { runBenchmark } from '../runner/benchmark-runner.js';
import { parseBenchmarkOutput } from '../parser/output-parser.js';
import { calculateMean, calculateStandardDeviation, calculatePercentageChange } from '../utils/stats.js';
import logger from '../utils/logger.js';

/**
 * @fileoverview The core logic orchestrator.
 * It coordinates the git handler, benchmark runner, parser, and reporter
 * to execute the full analysis workflow for both baseline and feature refs.
 */

/**
 * Gathers benchmark results for a specific Git ref.
 * This involves checking out the ref, installing dependencies, running the
 * benchmark script multiple times, and parsing the output for each run.
 *
 * @param {GitHandler} gitHandler - An instance of the GitHandler.
 * @param {string} ref - The Git ref (branch, tag, commit) to analyze.
 * @param {object} config - The application configuration.
 * @returns {Promise<object>} An object containing the ref name, commit info,
 *   raw results from each run, and calculated statistics for each metric.
 * @throws {Error} If any step in the process fails.
 */
async function gatherBenchmarkResultsForRef(gitHandler, ref, config) {
  const spinner = ora(`Preparing to benchmark ref: ${logger.style.ref(ref)}`).start();

  try {
    // 1. Checkout the specific ref
    spinner.text = `Checking out ref: ${logger.style.ref(ref)}`;
    await gitHandler.checkout(ref);
    const commit = await gitHandler.getCommitInfo();
    spinner.succeed(`Checked out ${logger.style.ref(ref)} at commit ${commit.sha}`);

    const workDir = gitHandler.getWorkDir();
    if (!workDir) {
      throw new Error('Working directory is not available from GitHandler.');
    }

    const rawResults = [];
    for (let i = 1; i <= config.runs; i++) {
      spinner.start(`Running benchmark for ${logger.style.ref(ref)} (run ${i}/${config.runs})`);
      try {
        // 2. Execute the benchmark command
        const { stdout } = await runBenchmark(config.benchmarkCommand, workDir);

        // 3. Parse the output
        const parsedMetrics = parseBenchmarkOutput(stdout, config.metrics);
        if (Object.keys(parsedMetrics).length === 0) {
          logger.warn(`Run ${i}/${config.runs} for ${logger.style.ref(ref)} produced no parsable metrics.`);
        }
        rawResults.push(parsedMetrics);
        spinner.succeed(`Completed run ${i}/${config.runs} for ${logger.style.ref(ref)}`);
      } catch (runError) {
        spinner.fail(`Benchmark run ${i}/${config.runs} for ${logger.style.ref(ref)} failed.`);
        // Re-throw to halt the process for this ref, as results would be incomplete.
        throw runError;
      }
    }

    // 4. Calculate statistics
    spinner.start(`Calculating statistics for ${logger.style.ref(ref)}`);
    const stats = {};
    const allMetricNames = new Set(rawResults.flatMap(res => Object.keys(res)));

    for (const metricName of allMetricNames) {
      const values = rawResults.map(res => res[metricName]).filter(v => typeof v === 'number');
      if (values.length > 0) {
        stats[metricName] = {
          mean: calculateMean(values),
          stdev: calculateStandardDeviation(values),
          values,
        };
      }
    }
    spinner.succeed(`Statistics calculated for ${logger.style.ref(ref)}`);

    return { ref, commit, rawResults, stats };
  } catch (error) {
    spinner.fail(`Failed to gather benchmark results for ref: ${logger.style.ref(ref)}`);
    // Propagate the error to the main orchestrator function.
    throw new Error(`Error during analysis of ref '${ref}': ${error.message}`);
  }
}

/**
 * Compares the statistical results between the baseline and feature benchmarks.
 *
 * @param {object} baselineResults - The processed results for the baseline ref.
 * @param {object} featureResults - The processed results for the feature ref.
 * @returns {object} An object containing the comparison for each common metric,
 *   including mean values and percentage change.
 */
function compareResults(baselineResults, featureResults) {
  const comparison = {};
  const baselineStats = baselineResults.stats;
  const featureStats = featureResults.stats;

  // Find metrics that exist in both sets of results to compare them.
  const commonMetricNames = Object.keys(baselineStats).filter(
    metricName => Object.prototype.hasOwnProperty.call(featureStats, metricName)
  );

  if (commonMetricNames.length === 0) {
    logger.warn('No common metrics found between baseline and feature branches. Cannot perform comparison.');
  }

  for (const metricName of commonMetricNames) {
    const baselineMean = baselineStats[metricName].mean;
    const featureMean = featureStats[metricName].mean;

    comparison[metricName] = {
      baselineMean,
      featureMean,
      percentageChange: calculatePercentageChange(baselineMean, featureMean),
    };
  }

  return comparison;
}

/**
 * The main orchestrator function that drives the entire performance analysis process.
 *
 * @param {object} options - The primary options for the analysis.
 * @param {string} options.baselineRef - The baseline Git ref.
 * @param {string} options.featureRef - The feature Git ref to compare against the baseline.
 * @param {string} options.repoPath - The path to the local Git repository.
 * @param {object} config - The loaded and validated configuration object.
 * @returns {Promise<object>} A promise that resolves with the complete analysis results,
 *   including baseline data, feature data, and the comparison.
 */
export async function runAnalysis(options) {
  const { baselineRef, featureRef, repoPath, config } = options;
  const gitHandler = new GitHandler(repoPath);

  try {
    // 1. Setup temporary environment
    await gitHandler.setup();
    await gitHandler.clone();

    // 2. Gather results for baseline
    const baselineResults = await gatherBenchmarkResultsForRef(gitHandler, baselineRef, config);

    // 3. Gather results for feature
    const featureResults = await gatherBenchmarkResultsForRef(gitHandler, featureRef, config);

    // 4. Compare the results
    const comparison = compareResults(baselineResults, featureResults);

    // 5. Assemble the final result object
    const finalResults = {
      meta: {
        createdAt: new Date().toISOString(),
        runs: config.runs,
        regressionThreshold: config.regressionThreshold,
      },
      baseline: baselineResults,
      feature: featureResults,
      comparison,
    };

    return finalResults;
  } catch (error) {
    // Ensure cleanup happens even if the main process fails.
    logger.error(`Analysis failed: ${error.message}`);
    // Re-throw the error so the CLI can exit with a non-zero code.
    throw error;
  } finally {
    // 6. Cleanup
    await gitHandler.cleanup();
  }
}