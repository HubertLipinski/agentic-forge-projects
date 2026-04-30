/**
 * @file src/analyzers/frequency-analyzer.js
 * @description Analyzes the frequency of all incoming logs within a time window
 * to detect sudden bursts or spikes that deviate from the baseline.
 *
 * This analyzer maintains a moving average of log frequency and detects when the
 * current rate exceeds this baseline by a configurable threshold. It is effective
 * for identifying "log storms" which often indicate a cascading failure or a
 * serious, repeating error in an application.
 */

import { getTimestampsInWindow } from '../state/baseline-store.js';

/**
 * Represents the state of the frequency analyzer.
 * @typedef {object} FrequencyAnalyzerState
 * @property {number} totalLogsAnalyzed - The total number of logs processed by the analyzer.
 * @property {number} movingAverage - The calculated moving average of logs per second.
 * @property {Date|null} lastAnalysisTime - The timestamp of the last analysis cycle.
 */

/**
 * @type {FrequencyAnalyzerState}
 * Internal state of the frequency analyzer.
 */
const state = {
  totalLogsAnalyzed: 0,
  movingAverage: 0.0,
  lastAnalysisTime: null,
};

/**
 * Analyzes the current log frequency against the established baseline to detect anomalies.
 *
 * The core logic is as follows:
 * 1. It retrieves all log timestamps within the configured `timeWindow`.
 * 2. It calculates the current log rate (logs per second) based on these timestamps.
 * 3. It updates a simple moving average (SMA) of the log rate to establish a dynamic baseline.
 * 4. If the current rate exceeds the moving average by a configurable `burstMultiplier`,
 *    it flags a frequency burst anomaly.
 * 5. A `minLogCount` threshold prevents firing alerts on insignificant fluctuations when
 *    the overall log volume is very low.
 *
 * @param {object} config - The frequency analyzer configuration.
 * @param {number} config.timeWindow - The time window in seconds to analyze log frequency.
 * @param {number} config.burstMultiplier - The factor by which the current rate must exceed the
 *   moving average to be considered a burst (e.g., 5 means 5x the average).
 * @param {number} config.minLogCount - The minimum number of logs in the time window required
 *   to trigger a burst anomaly.
 * @returns {{type: string, details: object}|null} An anomaly object if a burst is detected, otherwise null.
 */
export function analyzeFrequency(config) {
  const { timeWindow, burstMultiplier, minLogCount } = config;
  const windowMs = timeWindow * 1000;

  const timestampsInWindow = getTimestampsInWindow(windowMs);
  const logCount = timestampsInWindow.length;

  state.totalLogsAnalyzed += logCount;
  state.lastAnalysisTime = new Date();

  // Calculate the current rate in logs per second.
  // Use the actual time window duration to be more accurate.
  const currentRate = logCount / timeWindow;

  // Update the moving average.
  // Using a simple weighted average to smooth the baseline.
  // This gives more weight to the current rate, allowing the baseline to adapt.
  // A more sophisticated approach like an Exponential Moving Average (EMA) could be used,
  // but SMA is simpler and sufficient for this use case.
  if (state.movingAverage === 0) {
    // Initialize the moving average with the first calculated rate.
    state.movingAverage = currentRate;
  } else {
    // Simple smoothing: 80% old average, 20% new rate.
    state.movingAverage = state.movingAverage * 0.8 + currentRate * 0.2;
  }

  // Check for anomaly conditions
  const isAboveMinCount = logCount >= minLogCount;
  const isSignificantBurst = currentRate > state.movingAverage * burstMultiplier;
  const isBaselineEstablished = state.movingAverage > 0; // Avoid alerts when avg is zero

  if (isAboveMinCount && isSignificantBurst && isBaselineEstablished) {
    return {
      type: 'FREQUENCY_BURST',
      details: {
        message: `Log volume burst detected.`,
        logCount,
        timeWindow,
        currentRate: parseFloat(currentRate.toFixed(2)),
        movingAverage: parseFloat(state.movingAverage.toFixed(2)),
        burstMultiplier,
        minLogCount,
      },
    };
  }

  return null;
}

/**
 * Returns a snapshot of the analyzer's internal state for debugging or reporting.
 *
 * @returns {FrequencyAnalyzerState} A deep copy of the internal state.
 */
export function getAnalyzerState() {
  // Use structuredClone for a deep, safe copy of the state object.
  return structuredClone(state);
}

/**
 * Resets the internal state of the frequency analyzer.
 * Useful for testing or re-baselining without a restart.
 */
export function resetAnalyzer() {
  state.totalLogsAnalyzed = 0;
  state.movingAverage = 0.0;
  state.lastAnalysisTime = null;
}