/**
 * config/default.js
 *
 * Default configuration for the Job Queue Orchestrator.
 *
 * This file centralizes all configurable parameters of the application,
 * making it easy to adjust behavior without modifying the source code.
 * These values serve as the baseline and can be overridden by environment-specific
 * configurations (e.g., production.js, development.js) or environment variables.
 *
 * It's structured by concern (api, storage, scheduler, etc.) for clarity and
 * maintainability.
 */

import path from 'node:path';

// Helper to resolve paths relative to the project root.
// Assumes the process is started from the project root directory.
const projectRoot = process.cwd();
const resolvePath = (p) => path.resolve(projectRoot, p);

export default {
  /**
   * API Server Configuration
   */
  api: {
    // The network port on which the Fastify server will listen.
    // Can be overridden by the PORT environment variable.
    port: process.env.PORT || 3000,

    // The host interface to bind to. '0.0.0.0' makes the server accessible
    // from outside its container or local machine, which is useful for
    // development and deployment. '127.0.0.1' would restrict access to
    // localhost only.
    host: process.env.HOST || '0.0.0.0',
  },

  /**
   * Storage Configuration
   */
  storage: {
    // Path to the file-based database. Using a JSON Lines (.jsonl) format
    // for an append-only log of job states.
    // It's recommended to place data outside the src directory.
    dbPath: resolvePath('data/jobs.db.jsonl'),
  },

  /**
   * Scheduler and Worker Configuration
   */
  scheduler: {
    // The maximum number of jobs that can be processed concurrently.
    // This setting is crucial for controlling resource utilization.
    concurrency: 10,

    // The interval, in milliseconds, at which the scheduler polls the queue
    // for new jobs to execute. A shorter interval means faster job pickup
    // but higher CPU usage.
    pollInterval: 2000, // 2 seconds
  },

  /**
   * Job Behavior Configuration
   */
  jobs: {
    // Default retry policy for jobs that fail.
    retries: {
      // The maximum number of times a job will be retried upon failure.
      // A value of 0 means no retries.
      max: 3,

      // The base delay (in milliseconds) for the first retry. Subsequent
      // retries will use exponential backoff (delay * 2^attempt).
      // e.g., 5000ms -> 10000ms -> 20000ms
      delay: 5000, // 5 seconds
    },

    // Default Time-To-Live (TTL) for job records, in seconds.
    // After a job reaches a final state (completed, failed), this is how long
    // its record will be kept before it's eligible for cleanup.
    // This helps prevent the database from growing indefinitely.
    // A value of 0 or null would mean jobs are kept forever.
    ttl: 7 * 24 * 60 * 60, // 7 days
  },

  /**
   * Logging Configuration
   *
   * Note: The primary log level is controlled by the `LOG_LEVEL` environment
   * variable and defaults to 'info' as defined in `src/utils/logger.js`.
   * This section is for other logging-related settings if needed.
   */
  logging: {
    // Example: Add more logging config here if necessary.
  },
};