/**
 * @file src/index.js
 * @description Main application entry point. Initializes all components: config,
 * watcher, analyzers, and alerter, and orchestrates the data flow between them.
 *
 * This file orchestrates the entire log anomaly detection process. It's responsible for:
 * 1. Loading and validating the configuration.
 * 2. Initializing all necessary services (alerter, watcher, analyzers).
 * 3. Setting up the data processing pipeline where log lines flow from the watcher,
 *    through the parser and analyzers, and finally to the alerter.
 * 4. Managing the application's lifecycle, including graceful shutdown.
 */

import pLimit from 'p-limit';
import { loadConfig } from './config-loader.js';
import { initializeWatcher } from './log-watcher.js';
import { parseLogLine } from './utils/log-parser.js';
import { updateBaseline, prune } from './state/baseline-store.js';
import { analyzePattern } from './analyzers/pattern-analyzer.js';
import { analyzeFrequency } from './analyzers/frequency-analyzer.js';
import { initializeAlerter, triggerAlert, closeAlerter } from './alerter.js';

/**
 * The main application function. It sets up and runs the log anomaly detector.
 *
 * @param {object} cliArgs - Command-line arguments parsed by yargs.
 * @param {string} [cliArgs.config] - Path to a JSON configuration file.
 * @param {string | string[]} [cliArgs.file] - Path(s) to log files/directories to watch.
 * @returns {Promise<Function>} A promise that resolves with a `shutdown` function
 *   which can be called to gracefully terminate the application.
 * @throws {Error} If initialization fails (e.g., invalid config, file permissions).
 */
export async function run(cliArgs) {
  console.log('Starting Log Anomaly Detector...');

  // 1. Load Configuration
  // CLI arguments for file paths are passed as `cliOverrides` to take precedence.
  const cliOverrides = { watcher: { paths: cliArgs.file || cliArgs.files } };
  const config = await loadConfig(cliArgs.config, cliOverrides);
  console.log('Configuration loaded successfully.');

  // 2. Initialize Components
  await initializeAlerter(config.alerter);
  const limit = pLimit(config.watcher.maxConcurrentFileReads);

  let analysisTimer = null;
  let pruneTimer = null;

  /**
   * Processes a single log line through the entire analysis pipeline.
   * This function is the core of the data flow.
   *
   * @param {string} line - The raw log line from a file.
   */
  const processLogLine = async (line) => {
    // Parse the raw line into a structured log object.
    const parsedLog = parseLogLine(line);
    if (!parsedLog) {
      return; // Ignore empty or unparseable lines.
    }

    // Run pattern analysis for every single log line.
    if (config.patternAnalysis.enabled) {
      const patternAnomaly = analyzePattern(parsedLog);
      if (patternAnomaly) {
        await triggerAlert(patternAnomaly.type, patternAnomaly.details);
      }
    }

    // Update the baseline store with the new log entry. This must happen
    // after pattern analysis (to detect new patterns) but before the
    // log is counted for frequency analysis.
    updateBaseline(parsedLog);
  };

  /**
   * Periodically runs the frequency analysis. This is done on a timer
   * rather than per-log-line for efficiency, as it operates on an
   * aggregation of logs over a time window.
   */
  const runFrequencyAnalysis = async () => {
    try {
      const frequencyAnomaly = analyzeFrequency(config.frequencyAnalysis);
      if (frequencyAnomaly) {
        await triggerAlert(frequencyAnomaly.type, frequencyAnomaly.details);
      }
    } catch (error) {
      console.error('Error during frequency analysis:', error);
    }
  };

  /**
   * Periodically prunes old data from the baseline store to prevent
   * unbounded memory growth.
   */
  const runPruning = () => {
    try {
      // The max age for pruning should be at least the frequency analysis window
      // to ensure data isn't removed before it can be analyzed.
      const maxAgeMs = config.frequencyAnalysis.timeWindow * 1000;
      prune(maxAgeMs);
    } catch (error) {
      console.error('Error during state pruning:', error);
    }
  };

  // 3. Set up the Log Watcher and start the process
  const onLogLine = (line) => {
    // Use p-limit to control concurrency of log line processing.
    // This prevents overwhelming the system if a massive number of lines
    // are written at once.
    limit(() => processLogLine(line)).catch(error => {
      console.error('Error processing log line:', error);
    });
  };

  const onWatcherError = (error) => {
    console.error('[WATCHER_ERROR]', error.message);
    // Depending on the severity, you might want to trigger an alert or exit.
    // For now, we log it and continue.
  };

  const watcher = initializeWatcher(config.watcher.paths, onLogLine, onWatcherError);
  console.log('Log watcher is now active.');

  // 4. Start periodic tasks
  // The frequency analysis interval should be shorter than the time window
  // to allow for a sliding window effect. A quarter of the window is a good heuristic.
  const analysisInterval = Math.max(1000, (config.frequencyAnalysis.timeWindow * 1000) / 4);
  analysisTimer = setInterval(runFrequencyAnalysis, analysisInterval);

  const pruneIntervalMs = config.pruneInterval * 1000;
  pruneTimer = setInterval(runPruning, pruneIntervalMs);

  console.log(`Application is running. Press Ctrl+C to exit.`);

  /**
   * Gracefully shuts down the application.
   * Cleans up resources like file watchers, timers, and file handles.
   * @returns {Promise<void>}
   */
  const shutdown = async () => {
    console.log('Initiating graceful shutdown...');

    // Stop watching for new file changes
    if (watcher) {
      await watcher.close();
      console.log('Log watcher stopped.');
    }

    // Stop periodic tasks
    if (analysisTimer) {
      clearInterval(analysisTimer);
      console.log('Frequency analysis timer stopped.');
    }
    if (pruneTimer) {
      clearInterval(pruneTimer);
      console.log('Pruning timer stopped.');
    }

    // Wait for any in-flight log processing to complete.
    await limit.onIdle();
    console.log('Pending log processing finished.');

    // Close the alerter (flushes file buffers, etc.)
    await closeAlerter();

    console.log('Shutdown sequence complete.');
  };

  // Return the shutdown function so the CLI entry point can handle signals.
  return shutdown;
}