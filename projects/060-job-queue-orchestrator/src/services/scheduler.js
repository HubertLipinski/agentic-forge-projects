/**
 * src/services/scheduler.js
 *
 * Manages job concurrency and scheduling. This service is the heart of the
 * execution engine, responsible for pulling pending jobs from the queue and
 * assigning them to workers for processing.
 *
 * The scheduler runs a continuous loop that checks for available worker slots
 * and pending jobs. When both are available, it fetches a job, marks it as
 * 'running', and spawns a worker to execute it. This ensures that the number
 * of concurrently running jobs never exceeds the configured limit.
 */

import logger from '../utils/logger.js';
import { executeJob } from './worker.js';

/**
 * The Scheduler class orchestrates the execution of jobs by managing a pool
 * of workers according to a defined concurrency limit.
 */
export class Scheduler {
  /**
   * @type {import('./queue.js').JobQueue} The job queue service instance.
   */
  #queue;

  /**
   * @type {object} The application configuration.
   */
  #config;

  /**
   * @type {import('pino').Logger} A dedicated logger for the scheduler.
   */
  #logger;

  /**
   * @type {number} The maximum number of jobs that can run concurrently.
   */
  #concurrency;

  /**
   * @type {number} The number of jobs currently in the 'running' state.
   */
  #runningJobs = 0;

  /**
   * @type {boolean} A flag to control the main processing loop.
   */
  #isRunning = false;

  /**
   * @type {number} The interval (in ms) at which the scheduler checks for new jobs.
   */
  #pollInterval;

  /**
   * @type {NodeJS.Timeout|null} The timer ID for the polling interval.
   */
  #timer = null;

  /**
   * Creates an instance of the Scheduler.
   *
   * @param {object} options
   * @param {import('./queue.js').JobQueue} options.queue - The job queue service.
   * @param {object} options.config - The application configuration.
   */
  constructor({ queue, config }) {
    if (!queue) {
      throw new Error('JobQueue instance is required for the Scheduler.');
    }
    if (!config) {
      throw new Error('Configuration object is required for the Scheduler.');
    }

    this.#queue = queue;
    this.#config = config;
    this.#logger = logger.child({ service: 'Scheduler' });
    this.#concurrency = this.#config.concurrency;
    this.#pollInterval = this.#config.schedulerPollInterval ?? 1000; // Default to 1 second
  }

  /**
   * Starts the scheduler's main processing loop.
   * It will periodically check for pending jobs and execute them if worker
   * slots are available.
   */
  start() {
    if (this.#isRunning) {
      this.#logger.warn('Scheduler is already running.');
      return;
    }

    this.#isRunning = true;
    this.#logger.info(
      {
        concurrency: this.#concurrency,
        pollInterval: `${this.#pollInterval}ms`,
      },
      'Scheduler started.'
    );

    // Use an immediately invoked async function to start the loop without
    // delaying the first run.
    (async () => {
      while (this.#isRunning) {
        await this.#tick();
        // Wait for the next poll interval, but only if the scheduler is still running.
        if (this.#isRunning) {
          await new Promise(resolve => {
            this.#timer = setTimeout(resolve, this.#pollInterval);
          });
        }
      }
    })();
  }

  /**
   * Stops the scheduler's processing loop gracefully.
   * It waits for any currently running jobs to complete before resolving.
   *
   * @param {number} [timeout=30000] - The maximum time in milliseconds to wait for jobs to finish.
   * @returns {Promise<void>} A promise that resolves when the scheduler has stopped.
   */
  async stop(timeout = 30000) {
    if (!this.#isRunning) {
      this.#logger.warn('Scheduler is not running.');
      return;
    }

    this.#logger.info('Scheduler shutdown initiated. No new jobs will be started.');
    this.#isRunning = false;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }

    // Wait for currently running jobs to finish.
    const shutdownPromise = new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.#runningJobs === 0) {
          clearInterval(checkInterval);
          this.#logger.info('All running jobs have completed. Scheduler stopped.');
          resolve();
        } else {
          this.#logger.info(
            { remainingJobs: this.#runningJobs },
            'Waiting for jobs to complete...'
          );
        }
      }, 500);
    });

    // Race the shutdown promise against a timeout to prevent indefinite hanging.
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Scheduler shutdown timed out after ${timeout}ms.`)), timeout)
    );

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
    } catch (error) {
      this.#logger.error(
        { err: error, remainingJobs: this.#runningJobs },
        'Scheduler shutdown failed or timed out. Some jobs may have been interrupted.'
      );
      throw error;
    }
  }

  /**
   * A single execution cycle of the scheduler.
   * It checks for available capacity and pending jobs, then dispatches them.
   * @private
   */
  async #tick() {
    const availableSlots = this.#concurrency - this.#runningJobs;
    if (availableSlots <= 0) {
      // No capacity, do nothing.
      return;
    }

    try {
      const pendingJobs = await this.#queue.findPendingJobs(availableSlots);
      if (pendingJobs.length === 0) {
        // No pending jobs, do nothing.
        return;
      }

      this.#logger.debug({ count: pendingJobs.length, availableSlots }, 'Found pending jobs to process.');

      // Dispatch jobs concurrently up to the number of available slots.
      const dispatchPromises = pendingJobs.map(job => this.#processJob(job));
      await Promise.all(dispatchPromises);
    } catch (error) {
      this.#logger.error({ err: error }, 'An error occurred during the scheduler tick.');
    }
  }

  /**
   * Manages the full lifecycle of a single job execution.
   * It marks the job as 'running', executes it via a worker, and then handles
   * the success or failure outcome.
   *
   * @param {object} job - The job object to process.
   * @private
   */
  async #processJob(job) {
    // Attempt to claim and start the job.
    const startedJob = await this.#queue.startJob(job.id);

    // If startJob returns null, it means another scheduler instance or process
    // claimed this job in the small window since we fetched it. We can safely ignore it.
    if (!startedJob) {
      this.#logger.debug({ jobId: job.id }, 'Job was claimed by another process. Skipping.');
      return;
    }

    this.#runningJobs++;
    this.#logger.debug({ jobId: job.id, running: this.#runningJobs, limit: this.#concurrency }, 'Worker slot acquired.');

    try {
      // The actual job execution is "fire-and-forget" from the scheduler's perspective.
      // The worker simulation handles its own logic and reports back.
      const output = await executeJob(startedJob);
      await this.#queue.completeJob(job.id, output);
    } catch (error) {
      // The worker is expected to throw an error on failure.
      this.#logger.warn({ err: error, jobId: job.id }, 'Job execution failed.');
      await this.#queue.failJob(job.id, error);
    } finally {
      // Always release the worker slot, regardless of outcome.
      this.#runningJobs--;
      this.#logger.debug({ jobId: job.id, running: this.#runningJobs, limit: this.#concurrency }, 'Worker slot released.');
    }
  }
}