/**
 * @file src/scheduler.js
 * @description The core Scheduler class for managing and running cron jobs.
 *
 * This module contains the main Scheduler class, which orchestrates the entire
 * job scheduling process. It manages a collection of jobs, runs a main event loop
* (the "tick"), checks for due jobs, executes them, and coordinates with the
 * storage module to persist state. It is designed to be resilient to application
 * restarts and to handle missed jobs gracefully.
 */

import { EventEmitter } from 'node:events';
import { readState, writeState, StorageError } from './state/storage.js';
import { Job } from './job.js';
import { now, sleep } from './utils/time.js';

/**
 * A custom error class for scheduler-specific issues.
 */
export class SchedulerError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Error} [cause] - The original error that caused this one.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'SchedulerError';
    this.cause = cause;
  }
}

/**
 * The main scheduler class.
 *
 * Manages the lifecycle of cron jobs, including scheduling, execution,
 * and persistence. It runs a continuous loop to check for due jobs and
 * provides a dynamic API to manage jobs at runtime.
 *
 * @extends {EventEmitter}
 */
export class Scheduler extends EventEmitter {
  /**
   * Path to the persistent state file.
   * @private
   * @type {string}
   */
  #storagePath;

  /**
   * The interval in milliseconds for the scheduler's main loop.
   * @private
   * @type {number}
   */
  #tickInterval;

  /**
   * Policy for handling jobs that were missed during downtime.
   * - 'run': Run all missed executions.
   * - 'skip': Skip missed executions and schedule the next one from now.
   * @private
   * @type {'run' | 'skip'}
   */
  #catchupPolicy;

  /**
   * A map of job IDs to their corresponding Job instances.
   * @private
   * @type {Map<string, Job>}
   */
  #jobs = new Map();

  /**
   * The timer ID for the main `tick` loop. Used to stop the scheduler.
   * @private
   * @type {NodeJS.Timeout | null}
   */
  #timer = null;

  /**
   * A flag to prevent concurrent `tick` executions.
   * @private
   * @type {boolean}
   */
  #isTicking = false;

  /**
   * A flag indicating whether the scheduler is running.
   * @private
   * @type {boolean}
   */
  #isRunning = false;

  /**
   * Creates a new Scheduler instance.
   *
   * @param {object} options - The scheduler configuration.
   * @param {string} options.storagePath - The absolute path to the JSON file for state persistence.
   * @param {Array<{id?: string, cronTime: string, task: () => Promise<void>}>} [options.jobs=[]] - An array of job definitions to register on initialization.
   * @param {number} [options.tickInterval=1000] - The interval (in ms) for checking for due jobs.
   * @param {'run' | 'skip'} [options.catchupPolicy='skip'] - How to handle jobs missed during downtime.
   */
  constructor({ storagePath, jobs = [], tickInterval = 1000, catchupPolicy = 'skip' }) {
    super();

    if (!storagePath) {
      throw new SchedulerError('`storagePath` is a required option.');
    }
    if (tickInterval < 100) {
      throw new SchedulerError('`tickInterval` must be at least 100ms.');
    }
    if (!['run', 'skip'].includes(catchupPolicy)) {
      throw new SchedulerError('`catchupPolicy` must be either "run" or "skip".');
    }

    this.#storagePath = storagePath;
    this.#tickInterval = tickInterval;
    this.#catchupPolicy = catchupPolicy;

    // Register initial jobs provided in the constructor.
    // These are the "statically" defined tasks for the application.
    for (const jobDef of jobs) {
      // The task function is crucial. If it's missing, we can't create the job.
      if (typeof jobDef.task !== 'function') {
        throw new TypeError(`Job definition with cronTime "${jobDef.cronTime}" is missing a 'task' function.`);
      }
      const job = new Job(jobDef);
      this.#jobs.set(job.id, job);
    }
  }

  /**
   * Starts the scheduler.
   *
   * This method loads the persisted state, reconciles it with the currently
   * defined jobs, and starts the main event loop (`tick`).
   *
   * @returns {Promise<void>} A promise that resolves when the scheduler has started.
   */
  async start() {
    if (this.#isRunning) {
      console.warn('[Scheduler] Warning: start() called but scheduler is already running.');
      return;
    }

    this.#isRunning = true;
    this.emit('start');
    await this.#loadAndReconcileState();
    this.#timer = setInterval(() => this.#tick(), this.#tickInterval);
    // Perform an initial tick immediately on start without waiting for the first interval.
    await this.#tick();
  }

  /**
   * Stops the scheduler.
   *
   * This method clears the main event loop timer and persists the final state
   * of all jobs. It ensures a graceful shutdown.
   *
   * @returns {Promise<void>} A promise that resolves when the scheduler has stopped and state is saved.
   */
  async stop() {
    if (!this.#isRunning) {
      console.warn('[Scheduler] Warning: stop() called but scheduler is not running.');
      return;
    }

    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }

    this.#isRunning = false;

    try {
      await this.#persistState();
    } catch (error) {
      this.emit('error', new SchedulerError('Failed to persist state during shutdown.', error));
    }

    this.emit('stop');
  }

  /**
   * Dynamically adds a new job to the scheduler.
   * The new job state is immediately persisted.
   *
   * @param {object} jobDefinition - The job to add.
   * @param {string} jobDefinition.cronTime - The cron pattern.
   * @param {() => Promise<void>} jobDefinition.task - The async function to execute.
   * @param {string} [jobDefinition.id] - An optional unique ID.
   * @returns {Promise<Job>} A promise that resolves with the newly created Job instance.
   * @throws {SchedulerError} if a job with the same ID already exists.
   */
  async addJob({ cronTime, task, id }) {
    const job = new Job({ cronTime, task, id });

    if (this.#jobs.has(job.id)) {
      throw new SchedulerError(`A job with ID "${job.id}" already exists.`);
    }

    this.#jobs.set(job.id, job);
    await this.#persistState();
    this.emit('job:add', job);

    return job;
  }

  /**
   * Removes a job from the scheduler by its ID.
   * The removal is persisted to the state file.
   *
   * @param {string} jobId - The ID of the job to remove.
   * @returns {Promise<boolean>} A promise that resolves to `true` if the job was found and removed, `false` otherwise.
   */
  async removeJob(jobId) {
    const job = this.#jobs.get(jobId);
    if (!job) {
      return false;
    }

    this.#jobs.delete(jobId);
    await this.#persistState();
    this.emit('job:remove', job);

    return true;
  }

  /**
   * Returns a list of all currently scheduled jobs.
   *
   * @returns {Array<Job>} An array of Job instances.
   */
  listJobs() {
    return Array.from(this.#jobs.values());
  }

  /**
   * The main event loop of the scheduler.
   * This method is called at each `tickInterval`. It checks for due jobs and runs them.
   * @private
   */
  async #tick() {
    if (this.#isTicking) {
      // Prevent overlapping ticks, which could happen if a tick takes longer than the interval.
      return;
    }

    this.#isTicking = true;
    this.emit('tick:start');

    const currentTime = now();
    const dueJobs = [];

    for (const job of this.#jobs.values()) {
      if (job.nextRun !== null && job.nextRun <= currentTime) {
        dueJobs.push(job);
      }
    }

    if (dueJobs.length > 0) {
      await this.#runJobs(dueJobs, currentTime);
      await this.#persistState();
    }

    this.emit('tick:end');
    this.#isTicking = false;
  }

  /**
   * Executes an array of due jobs.
   * @private
   * @param {Array<Job>} jobsToRun - The jobs that are due.
   * @param {number} currentTime - The current timestamp for this tick.
   */
  async #runJobs(jobsToRun, currentTime) {
    const runPromises = jobsToRun.map(async (job) => {
      this.emit('job:run', job);

      try {
        // Execute the job's task.
        await job.task();
        this.emit('job:success', job);
      } catch (error) {
        this.emit('job:failure', error, job);
      } finally {
        // Regardless of success or failure, schedule the next run.
        if (this.#catchupPolicy === 'run' && job.nextRun) {
          // 'run' policy: schedule the next run from the *last* scheduled run time.
          // This allows the job to "catch up" on missed executions.
          job.updateNextRun(job.nextRun);
        } else {
          // 'skip' policy: schedule the next run relative to *now*.
          // This skips any missed executions.
          job.updateNextRun(currentTime);
        }
      }
    });

    await Promise.allSettled(runPromises);
  }

  /**
   * Loads state from the storage file and reconciles it with in-memory job definitions.
   * @private
   */
  async #loadAndReconcileState() {
    try {
      const state = await readState(this.#storagePath);
      const persistedJobs = state.jobs ?? {};

      for (const [id, persistedJob] of Object.entries(persistedJobs)) {
        const memoryJob = this.#jobs.get(id);

        if (memoryJob) {
          // Job exists in memory, update it with persisted state.
          memoryJob.nextRun = persistedJob.nextRun;
          // Re-evaluate nextRun based on policy, in case the app was down.
          if (persistedJob.nextRun < now()) {
            if (this.#catchupPolicy === 'skip') {
              memoryJob.updateNextRun(now());
            }
            // If 'run', we leave the past `nextRun` so it executes on the next tick.
          }
        } else {
          // Job exists in storage but not in memory (e.g., a dynamically added job).
          // We can't run it without its `task` function, so we log a warning.
          // The persisted data is kept, in case the job definition is added back later.
          console.warn(`[Scheduler] Warning: Job with ID "${id}" found in state file but has no corresponding task function. It will not be scheduled.`);
          // To represent this "inactive" state, we can create a placeholder Job without a task.
          const placeholderTask = async () => {
            console.error(`[Scheduler] Error: Task for job "${id}" is not defined.`);
            this.emit('error', new SchedulerError(`Task for job "${id}" is not defined.`));
          };
          const inactiveJob = new Job({ ...persistedJob, task: placeholderTask });
          this.#jobs.set(id, inactiveJob);
        }
      }
      await this.#persistState(); // Persist any reconciled changes.
    } catch (error) {
      if (error instanceof StorageError) {
        this.emit('error', new SchedulerError('Failed to load or reconcile state.', error));
      } else {
        throw error; // Re-throw unexpected errors.
      }
    }
  }

  /**
   * Persists the current state of all jobs to the storage file.
   * @private
   */
  async #persistState() {
    try {
      const jobsToPersist = {};
      for (const [id, job] of this.#jobs.entries()) {
        jobsToPersist[id] = job.toJSON();
      }
      await writeState(this.#storagePath, { jobs: jobsToPersist });
    } catch (error) {
      if (error instanceof StorageError) {
        this.emit('error', new SchedulerError('Failed to persist scheduler state.', error));
      } else {
        throw error; // Re-throw unexpected errors.
      }
    }
  }
}