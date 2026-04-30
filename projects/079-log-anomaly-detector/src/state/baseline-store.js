/**
 * @file src/state/baseline-store.js
 * @description Manages the in-memory state of the log baseline. Tracks known
 * message patterns, their frequencies, and timestamps of last occurrence.
 *
 * This component acts as the "memory" of the system, storing what's considered
 * "normal" based on the log data processed so far. Analyzers query this store
 * to determine if new log entries deviate from the established baseline.
 */

/**
 * A Map to store the baseline data for each log pattern.
 * The key is the normalized log pattern string.
 * The value is an object containing metadata about that pattern.
 *
 * @type {Map<string, {count: number, firstSeen: Date, lastSeen: Date}>}
 */
const patternStore = new Map();

/**
 * A Map to store recent log entry timestamps.
 * This is used by the frequency analyzer to calculate log volume over a time window.
 * The key is the timestamp (in milliseconds), and the value is the count of logs at that exact millisecond.
 *
 * @type {Map<number, number>}
 */
const recentTimestamps = new Map();

/**
 * Checks if a given log pattern has been seen before.
 *
 * @param {string} pattern - The normalized log pattern string.
 * @returns {boolean} True if the pattern exists in the baseline, false otherwise.
 */
export function hasPattern(pattern) {
  if (typeof pattern !== 'string' || pattern === '') {
    return false;
  }
  return patternStore.has(pattern);
}

/**
 * Retrieves the baseline data for a specific log pattern.
 *
 * @param {string} pattern - The normalized log pattern string.
 * @returns {{count: number, firstSeen: Date, lastSeen: Date}|undefined} The baseline data object, or undefined if the pattern is not found.
 */
export function getPatternData(pattern) {
  return patternStore.get(pattern);
}

/**
 * Updates the baseline with a new log entry.
 * If the pattern is new, it's added to the store. If it's existing, its
 * metadata (count, lastSeen) is updated.
 * Also records the timestamp for frequency analysis.
 *
 * @param {object} parsedLog - The parsed log object from `log-parser`.
 * @param {string} parsedLog.pattern - The normalized log pattern.
 * @param {Date} parsedLog.timestamp - The timestamp of the log entry.
 */
export function updateBaseline(parsedLog) {
  const { pattern, timestamp } = parsedLog;

  if (typeof pattern !== 'string' || pattern === '' || !(timestamp instanceof Date)) {
    // Silently ignore invalid updates to prevent crashing the process.
    // A log message here could create a feedback loop.
    return;
  }

  // Update pattern store
  if (patternStore.has(pattern)) {
    const data = patternStore.get(pattern);
    data.count += 1;
    data.lastSeen = timestamp;
  } else {
    patternStore.set(pattern, {
      count: 1,
      firstSeen: timestamp,
      lastSeen: timestamp,
    });
  }

  // Update recent timestamps for frequency analysis
  const timestampMs = timestamp.getTime();
  const currentCount = recentTimestamps.get(timestampMs) ?? 0;
  recentTimestamps.set(timestampMs, currentCount + 1);
}

/**
 * Retrieves all log timestamps that fall within a specified time window.
 *
 * @param {number} windowMs - The time window in milliseconds to look back from now.
 * @returns {number[]} An array of timestamps (in milliseconds) within the window.
 */
export function getTimestampsInWindow(windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestampsInWindow = [];

  for (const [timestamp, count] of recentTimestamps.entries()) {
    if (timestamp >= cutoff) {
      // Add the timestamp 'count' times to represent each log entry
      for (let i = 0; i < count; i++) {
        timestampsInWindow.push(timestamp);
      }
    }
  }
  return timestampsInWindow;
}

/**
 * Prunes old data from the store to prevent unbounded memory growth.
 * This function should be called periodically.
 * It removes timestamp entries that are older than the specified window.
 *
 * Note: This implementation does not prune the `patternStore`. In a long-running
 * production system, a strategy for this (e.g., LRU cache or time-based eviction)
 * might be necessary if the number of unique patterns is expected to be extremely large.
 * For the scope of this project, we assume the number of unique patterns is manageable.
 *
 * @param {number} maxAgeMs - The maximum age of a timestamp entry to keep, in milliseconds.
 */
export function prune(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;

  for (const timestamp of recentTimestamps.keys()) {
    if (timestamp < cutoff) {
      recentTimestamps.delete(timestamp);
    }
  }
}

/**
 * Returns a snapshot of the current baseline state.
 * Useful for debugging, reporting, or potential future state persistence.
 * Uses structuredClone for a deep, safe copy.
 *
 * @returns {{totalPatterns: number, totalLogCount: number, patterns: object, recentTimestampsCount: number}} A summary of the current state.
 */
export function getStoreSnapshot() {
  const patterns = Object.fromEntries(patternStore.entries());
  let totalLogCount = 0;
  for (const key in patterns) {
    totalLogCount += patterns[key].count;
  }

  return {
    totalPatterns: patternStore.size,
    totalLogCount,
    patterns: structuredClone(patterns),
    recentTimestampsCount: recentTimestamps.size,
  };
}

/**
 * Clears all data from the baseline store.
 * Useful for testing or resetting the state without restarting the application.
 */
export function clearStore() {
  patternStore.clear();
  recentTimestamps.clear();
}