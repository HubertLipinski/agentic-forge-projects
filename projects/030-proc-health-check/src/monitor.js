/**
 * @file src/monitor.js
 * @description Core logic for monitoring process health by PID.
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { isPidRunning } from 'node:process';

/**
 * Retrieves the health status of a running process by its PID.
 *
 * This function gathers key metrics including memory usage (RSS, heap),
 * CPU time (user, system), and process uptime. It is designed to be
 * lightweight and have zero production dependencies.
 *
 * @param {number | string} pid - The Process ID of the process to monitor.
 * @returns {Promise<object>} A promise that resolves to a health status object.
 * The object has the following structure:
 * {
 *   pid: number,
 *   memory: {
 *     rss: number,        // Resident Set Size in bytes
 *     heapTotal: number,  // Total size of the V8 heap in bytes
 *     heapUsed: number    // Used size of the V8 heap in bytes
 *   },
 *   cpu: {
 *     user: number,       // CPU time spent in user code in microseconds
 *     system: number      // CPU time spent in system code in microseconds
 *   },
 *   uptime: number        // Process uptime in seconds
 * }
 * @throws {Error} If the PID is invalid, not a number, or if the process
 *                 is not running or inaccessible.
 */
export async function getProcessHealth(pid) {
  const parsedPid = Number(pid);

  if (!Number.isInteger(parsedPid) || parsedPid <= 0) {
    throw new Error(`Invalid PID: "${pid}". PID must be a positive integer.`);
  }

  try {
    // isPidRunning is a quick and efficient way to check process existence
    // without relying on signals, which can have side effects.
    if (!isPidRunning(parsedPid)) {
      throw new Error(`Process with PID ${parsedPid} is not running or is inaccessible.`);
    }

    // process.memoryUsage() provides memory info for the *current* Node.js process.
    // To get it for another PID, we'd need OS-specific commands, which violates
    // the "zero-dependency" and "Node.js core only" principles.
    // Therefore, this library can only report detailed memory for its own process.
    // For external PIDs, we can't get this info without external tools.
    // We will throw an error to make this limitation explicit.
    if (parsedPid !== process.pid) {
        throw new Error(`Monitoring memory and detailed CPU is only supported for the current process (PID: ${process.pid}).`);
    }

    // All subsequent calls are for the current process.
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    const healthStatus = {
      pid: parsedPid,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      uptime: uptime,
    };

    return healthStatus;
  } catch (error) {
    // Re-throw specific errors or wrap others for a consistent API.
    if (error.message.startsWith('Invalid PID') || error.message.startsWith('Process with PID') || error.message.startsWith('Monitoring memory')) {
        throw error;
    }
    // Catch any other unexpected system-level errors from Node.js internals.
    throw new Error(`Failed to retrieve health for PID ${parsedPid}: ${error.message}`);
  }
}