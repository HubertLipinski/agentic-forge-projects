/**
 * @file src/monitors/process-stats.js
 * @description Periodically samples process.memoryUsage() and process.cpuUsage() to track resource consumption.
 *
 * This monitor provides crucial insights into the health and resource footprint of the
 * Node.js process running the bot. It periodically collects memory and CPU usage data
 * and reports it to Prometheus, allowing for historical analysis and alerting on
 * resource-related issues like memory leaks or high CPU load.
 */

import { metrics } from '../metrics/prometheus.js';

/**
 * The interval in milliseconds at which to sample process statistics.
 * A value of 15 seconds provides a good balance between metric granularity and
 * performance overhead.
 * @type {number}
 */
const SAMPLE_INTERVAL_MS = 15 * 1000;

/**
 * The timer instance for the periodic sampling. This is stored so it can be
 * cleared if the monitor is stopped.
 * @type {NodeJS.Timeout | null}
 */
let sampleIntervalId = null;

/**
 * Stores the previous CPU usage statistics to calculate the differential
 * CPU usage over the sampling interval.
 * @type {{ timestamp: number, usage: NodeJS.CpuUsage } | null}
 */
let previousCpuState = null;

/**
 * Samples the current process memory and CPU usage and updates the corresponding
 * Prometheus gauges.
 *
 * This function is designed to be called periodically. It handles the logic for
 * calculating differential CPU usage between calls.
 */
function sampleProcessStats() {
  try {
    // --- Memory Usage ---
    const memoryUsage = process.memoryUsage();
    // `rss` (Resident Set Size) is the total memory allocated for the process.
    metrics.processMemoryUsage.set({ memory_type: 'rss' }, memoryUsage.rss);
    // `heapTotal` is the total size of the V8 memory heap.
    metrics.processMemoryUsage.set({ memory_type: 'heapTotal' }, memoryUsage.heapTotal);
    // `heapUsed` is the actual memory used by application data.
    metrics.processMemoryUsage.set({ memory_type: 'heapUsed' }, memoryUsage.heapUsed);
    // `external` is memory used by C++ objects bound to JavaScript objects.
    metrics.processMemoryUsage.set({ memory_type: 'external' }, memoryUsage.external);
    // `arrayBuffers` is memory allocated for ArrayBuffers and SharedArrayBuffers.
    if (memoryUsage.arrayBuffers) { // Available in newer Node.js versions
      metrics.processMemoryUsage.set({ memory_type: 'arrayBuffers' }, memoryUsage.arrayBuffers);
    }

    // --- CPU Usage ---
    const currentTimestamp = Date.now();
    const currentCpuUsage = process.cpuUsage();

    if (previousCpuState) {
      const timeDeltaMs = currentTimestamp - previousCpuState.timestamp;
      // Convert from milliseconds to microseconds
      const timeDeltaMicro = timeDeltaMs * 1000;

      const userCpuDeltaMicro = currentCpuUsage.user - previousCpuState.usage.user;
      const systemCpuDeltaMicro = currentCpuUsage.system - previousCpuState.usage.system;

      const totalCpuDeltaMicro = userCpuDeltaMicro + systemCpuDeltaMicro;

      // The ratio is the total CPU time spent during the interval divided by the
      // total wall-clock time of the interval. A value of 1.0 means one full CPU
      // core was busy for the entire interval.
      if (timeDeltaMicro > 0) {
        const cpuUsageRatio = totalCpuDeltaMicro / timeDeltaMicro;
        metrics.processCpuUsage.set(cpuUsageRatio);
      }
    }

    // Store the current state for the next calculation.
    previousCpuState = {
      timestamp: currentTimestamp,
      usage: currentCpuUsage,
    };
  } catch (error) {
    console.error('Error sampling process stats:', error);
    // We do not re-throw, as an error here should not crash the monitor loop.
  }
}

/**
 * Attaches the process statistics monitor.
 *
 * This function starts a periodic timer that calls `sampleProcessStats` at a
 * configured interval. It ensures that the monitor is not started multiple times.
 *
 * @param {object} [options] - Configuration options for the monitor.
 * @param {number} [options.intervalMs=15000] - The sampling interval in milliseconds.
 */
export function attachProcessStatsMonitor({ intervalMs = SAMPLE_INTERVAL_MS } = {}) {
  if (sampleIntervalId) {
    console.warn('Process Stats Monitor is already attached. Skipping.');
    return;
  }

  if (typeof intervalMs !== 'number' || intervalMs <= 0) {
    console.error(`Invalid interval for Process Stats Monitor: ${intervalMs}. Using default.`);
    intervalMs = SAMPLE_INTERVAL_MS;
  }

  // Perform an initial sample immediately on startup to populate the metrics,
  // rather than waiting for the first interval to pass.
  sampleProcessStats();

  // Start the periodic sampling.
  sampleIntervalId = setInterval(sampleProcessStats, intervalMs);

  console.log(`Process Stats Monitor attached. Sampling every ${intervalMs}ms.`);
}

/**
 * Stops the process statistics monitor and clears the sampling timer.
 * This is useful for graceful shutdown or in testing environments.
 */
export function stopProcessStatsMonitor() {
  if (sampleIntervalId) {
    clearInterval(sampleIntervalId);
    sampleIntervalId = null;
    previousCpuState = null; // Reset CPU state
    console.log('Process Stats Monitor stopped.');
  }
}