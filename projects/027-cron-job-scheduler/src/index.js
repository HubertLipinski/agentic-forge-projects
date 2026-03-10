/**
 * @file src/index.js
 * @description Public API entry point for the in-process cron scheduler.
 *
 * This module exports a factory function, `createScheduler`, which is the
 * primary way for users to create and configure a scheduler instance. It
 * encapsulates the setup process, providing a clean and simple interface
 * for initializing the scheduler with jobs and configuration options.
 */

import path from 'node:path';
import { Scheduler, SchedulerError } from './scheduler.js';

/**
 * @typedef {object} JobDefinition
 * @property {string} [id] - A unique identifier for the job. If not provided, a v4 UUID will be generated.
 *   It's recommended to provide a stable ID for jobs defined in code to ensure they can be reliably
 *   reconciled with persisted state across application restarts.
 * @property {string} cronTime - The cron pattern that defines the job's schedule (e.g., '* * * * *').
 * @property {() => Promise<void>} task - The asynchronous function to be executed when the job runs.
 */

/**
 * @typedef {object} SchedulerOptions
 * @property {string} storagePath - The path to the JSON file for state persistence.
 *   If a relative path is provided, it will be resolved relative to the current working directory.
 * @property {JobDefinition[]} [jobs=[]] - An array of job definitions to register on initialization.
 *   These are the "statically" defined tasks for the application.
 * @property {number} [tickInterval=1000] - The interval in milliseconds at which the scheduler checks for due jobs.
 *   Must be at least 100ms. A smaller interval provides more granular scheduling but increases CPU usage.
 * @property {'run' | 'skip'} [catchupPolicy='skip'] - The policy for handling jobs that were missed due to downtime.
 *   - 'run': Execute all missed runs of a job since it was last scheduled to run. This can lead to a burst of executions on startup.
 *   - 'skip': Skip any missed executions and schedule the job for its next valid run time from the current moment.
 */

/**
 * Factory function to create and initialize a new Scheduler instance.
 *
 * This is the main entry point for using the scheduler. It simplifies the
 * process of creating a scheduler by handling path resolution and instance creation.
 *
 * @param {SchedulerOptions} options - The configuration options for the scheduler.
 * @returns {Scheduler} A new `Scheduler` instance, ready to be started with `.start()`.
 * @throws {SchedulerError} If the provided options are invalid.
 *
 * @example
 * import { createScheduler } from 'in-process-cron';
 * import path from 'node:path';
 *
 * const scheduler = createScheduler({
 *   storagePath: path.resolve('./scheduler-state.json'),
 *   jobs: [
 *     {
 *       id: 'my-first-job',
 *       cronTime: '* * * * *', // Every minute
 *       async task() {
 *         console.log('Job is running at:', new Date());
 *       }
 *     }
 *   ]
 * });
 *
 * // The scheduler is created but not yet running.
 * // Start the scheduler to begin processing jobs.
 * await scheduler.start();
 *
 * // To stop it gracefully:
 * // await scheduler.stop();
 */
export function createScheduler(options) {
  if (!options || typeof options !== 'object') {
    throw new SchedulerError('Scheduler options must be provided as an object.');
  }

  const {
    storagePath,
    jobs = [],
    tickInterval = 1000,
    catchupPolicy = 'skip',
  } = options;

  if (!storagePath || typeof storagePath !== 'string') {
    throw new SchedulerError('`storagePath` is a required option and must be a string.');
  }

  // Resolve the storage path to ensure it's absolute. This prevents ambiguity
  // related to the current working directory.
  const absoluteStoragePath = path.resolve(process.cwd(), storagePath);

  const scheduler = new Scheduler({
    storagePath: absoluteStoragePath,
    jobs,
    tickInterval,
    catchupPolicy,
  });

  return scheduler;
}

// Re-export core classes and errors for advanced usage and type checking.
export { Job } from './job.js';
export { Scheduler, SchedulerError } from './scheduler.js';
export { StorageError } from './state/storage.js';