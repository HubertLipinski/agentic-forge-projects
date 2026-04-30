/**
 * @file src/analyzers/pattern-analyzer.js
 * @description Analyzes the structure of incoming log messages. Identifies and flags new, previously unseen log patterns.
 *
 * This analyzer is the simplest form of anomaly detection in the system. It leverages
 * the baseline store to check if a given log message pattern has ever been seen before.
 * The appearance of a new pattern can indicate new code paths being executed, a new type
 * of error, or a change in application behavior, which might be of interest.
 */

import { hasPattern } from '../state/baseline-store.js';

/**
 * Represents the state of the pattern analyzer.
 * @typedef {object} PatternAnalyzerState
 * @property {number} totalLogsAnalyzed - The total number of logs processed by this analyzer.
 * @property {number} newPatternsDetected - The count of new patterns flagged as anomalies.
 * @property {Date|null} lastAnalysisTime - The timestamp of the last log analysis.
 */

/**
 * @type {PatternAnalyzerState}
 * Internal state of the pattern analyzer.
 */
const state = {
  totalLogsAnalyzed: 0,
  newPatternsDetected: 0,
  lastAnalysisTime: null,
};

/**
 * Analyzes a parsed log entry to determine if its pattern is new.
 *
 * This function checks against the `baseline-store`. If the pattern from the
 * parsed log does not exist in the store, it is considered a "new pattern" anomaly.
 *
 * @param {object} parsedLog - The parsed log object from `log-parser`.
 * @param {string} parsedLog.pattern - The normalized log pattern to check.
 * @param {string} parsedLog.originalLine - The original log line for context in the alert.
 * @param {Date} parsedLog.timestamp - The timestamp of the log entry.
 * @returns {{type: string, details: object}|null} An anomaly object if the pattern is new, otherwise null.
 */
export function analyzePattern(parsedLog) {
  // Defensive validation of the input log object.
  if (!parsedLog || typeof parsedLog.pattern !== 'string' || parsedLog.pattern.trim() === '') {
    // Silently ignore invalid log objects to prevent crashes.
    // Logging an error here could lead to a feedback loop.
    return null;
  }

  state.totalLogsAnalyzed += 1;
  state.lastAnalysisTime = new Date();

  const { pattern, originalLine, timestamp } = parsedLog;

  // Query the baseline store to see if this pattern has been seen before.
  const isKnownPattern = hasPattern(pattern);

  if (!isKnownPattern) {
    state.newPatternsDetected += 1;

    // This is the first time we've seen this pattern. Flag it as an anomaly.
    return {
      type: 'NEW_PATTERN',
      details: {
        message: 'A new, previously unseen log pattern was detected.',
        pattern,
        firstOccurrence: timestamp,
        originalLine,
      },
    };
  }

  // The pattern is known, so it's not an anomaly.
  return null;
}

/**
 * Returns a snapshot of the analyzer's internal state for debugging or reporting.
 * Uses `structuredClone` for a deep, safe copy to prevent mutation of the internal state.
 *
 * @returns {PatternAnalyzerState} A deep copy of the internal state.
 */
export function getAnalyzerState() {
  return structuredClone(state);
}

/**
 * Resets the internal state of the pattern analyzer.
 * This is primarily useful for testing or for re-initializing the system's state
 * without a full application restart.
 */
export function resetAnalyzer() {
  state.totalLogsAnalyzed = 0;
  state.newPatternsDetected = 0;
  state.lastAnalysisTime = null;
}