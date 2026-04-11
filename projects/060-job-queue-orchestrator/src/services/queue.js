/**
 * src/services/queue.js
 *
 * Core job queue logic for the Job Queue Orchestrator.
 *
 * This module provides the `JobQueue` class, which is the central service for
 * managing the entire lifecycle of jobs. It handles enqueuing new tasks,
 * updating their state, and persisting every change to the database. It acts
 * as the single source of truth for job states.
 *
 * The class orchestrates interactions between the API layer, the database,
 * the scheduler, and the webhook dispatcher.
 */

import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';
import { dispatchWebhook } from './webhook-dispatcher.js';

/**
 * Defines the possible states a job can be in.
 * @readonly
 * @enum {string}
 */
export const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled',
};

/**
 * Manages the state and lifecycle of jobs.
 */
export class JobQueue {
  /**
   * @type {import('../storage/db.js').JobDb}
   */
  #db;

  /**
   * @type {object}
   */
  #config;

  /**
   * @type {import('pino').Logger}
   */
  #logger;

  /**
   * Creates an instance of the JobQueue.
   *
   * @param {object} options
   * @param {import('../storage/db.js').JobDb} options.db - The database service instance.
   * @param {object} options.config - The application configuration object.
   */
  constructor({ db, config }) {
    if (!db) {
      throw new Error('JobDb instance is required.');
    }
    if (!config) {
      throw new Error('Configuration object is required.');
    }
    this.#db = db;
    this.#config = config;
    this.#logger = logger.child({ service: 'JobQueue' });
  }

  /**
   * Creates and enqueues a new job.
   *
   * @param {string} type - The type of the job (e.g., 'process-video').
   * @param {object} payload - The data required for the job to execute.
   * @param {object} [options={}] - Job-specific options.
   * @param {number} [options.maxRetries] - Override default max retries.
   * @param {string} [options.webhookUrl] - URL for completion/failure notifications.
   * @param {number} [options.ttl] - Time-to-live in seconds for the job record after completion.
   * @returns {Promise<object>} The newly created job object.
   */
  async enqueue(type, payload, options = {}) {
    const jobId = nanoid();
    const now = new Date().toISOString();

    const job = {
      id: jobId,
      type,
      payload,
      status: JobStatus.PENDING,
      options: {
        maxRetries: options.maxRetries ?? this.#config.retries.max,
        webhookUrl: options.webhookUrl,
        ttl: options.ttl ?? this.#config.jobTTL,
      },
      history: [
        { status: JobStatus.PENDING, timestamp: now },
      ],
      createdAt: now,
      updatedAt: now,
      runAt: now, // Ready to be run immediately
      attempts: 0,
      output: null,
      error: null,
    };

    await this.#db.append(job);
    this.#logger.info({ jobId: job.id, type: job.type }, 'New job enqueued');
    return structuredClone(job);
  }

  /**
   * Retrieves a job by its ID.
   *
   * @param {string} jobId - The ID of the job to retrieve.
   * @returns {Promise<object|undefined>} The job object, or undefined if not found.
   */
  async getJob(jobId) {
    return this.#db.findById(jobId);
  }

  /**
   * Lists jobs with optional filtering and pagination.
   *
   * @param {object} [filters={}] - Filtering and pagination options.
   * @param {string} [filters.status] - Filter by job status.
   * @param {string} [filters.type] - Filter by job type.
   * @param {number} [filters.limit=100] - Maximum number of jobs to return.
   * @param {number} [filters.offset=0] - Number of jobs to skip.
   * @returns {Promise<Array<object>>} A list of jobs.
   */
  async listJobs({ status, type, limit = 100, offset = 0 } = {}) {
    const allJobs = await this.#db.findAll();

    // The list is built from the latest state of all jobs in memory.
    const filteredJobs = allJobs.filter(job => {
      const statusMatch = !status || job.status === status;
      const typeMatch = !type || job.type === type;
      return statusMatch && typeMatch;
    });

    // Sort by creation date, newest first, for consistent ordering.
    filteredJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return filteredJobs.slice(offset, offset + limit);
  }

  /**
   * Finds pending jobs that are ready to be run.
   *
   * @param {number} limit - The maximum number of jobs to return.
   * @returns {Promise<Array<object>>} A list of pending jobs ready for execution.
   */
  async findPendingJobs(limit) {
    const allJobs = await this.#db.findAll();
    const now = new Date().toISOString();

    const pendingJobs = allJobs
      .filter(job => job.status === JobStatus.PENDING && job.runAt <= now)
      .sort((a, b) => new Date(a.runAt) - new Date(b.runAt)) // Oldest first (FIFO)
      .slice(0, limit);

    return pendingJobs.map(job => structuredClone(job));
  }

  /**
   * Marks a job as 'running'.
   *
   * @param {string} jobId - The ID of the job to start.
   * @returns {Promise<object|null>} The updated job object, or null if the job couldn't be started.
   */
  async startJob(jobId) {
    const job = await this.#db.findById(jobId);

    if (!job || job.status !== JobStatus.PENDING) {
      this.#logger.warn({ jobId, currentStatus: job?.status }, 'Attempted to start a job that is not pending. Ignoring.');
      return null;
    }

    const now = new Date().toISOString();
    job.status = JobStatus.RUNNING;
    job.updatedAt = now;
    job.startedAt = now;
    job.attempts += 1;
    job.history.push({ status: JobStatus.RUNNING, timestamp: now });

    await this.#db.append(job);
    this.#logger.info({ jobId: job.id, attempt: job.attempts }, 'Job started');
    return structuredClone(job);
  }

  /**
   * Marks a job as 'completed'.
   *
   * @param {string} jobId - The ID of the completed job.
   * @param {object} output - The result of the job execution.
   * @returns {Promise<object>} The updated job object.
   */
  async completeJob(jobId, output) {
    const job = await this.#db.findById(jobId);
    if (!job) throw new Error(`Job with ID '${jobId}' not found for completion.`);

    const now = new Date().toISOString();
    job.status = JobStatus.COMPLETED;
    job.updatedAt = now;
    job.completedAt = now;
    job.output = output;
    job.error = null;
    job.history.push({ status: JobStatus.COMPLETED, timestamp: now });

    await this.#db.append(job);
    this.#logger.info({ jobId: job.id }, 'Job completed successfully');

    // Fire and forget webhook
    dispatchWebhook(job);

    return structuredClone(job);
  }

  /**
   * Marks a job as 'failed' and schedules a retry if applicable.
   *
   * @param {string} jobId - The ID of the failed job.
   * @param {Error} error - The error that caused the failure.
   * @returns {Promise<object>} The updated job object.
   */
  async failJob(jobId, error) {
    const job = await this.#db.findById(jobId);
    if (!job) throw new Error(`Job with ID '${jobId}' not found for failure reporting.`);

    const now = new Date().toISOString();
    const maxRetries = job.options.maxRetries ?? 0;
    const canRetry = job.attempts <= maxRetries;

    job.updatedAt = now;
    job.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };

    if (canRetry) {
      const retryDelay = this.#config.retries.delay * Math.pow(2, job.attempts - 1);
      const runAt = new Date(Date.now() + retryDelay);

      job.status = JobStatus.PENDING; // Re-queue for another attempt
      job.runAt = runAt.toISOString();
      job.history.push({
        status: JobStatus.PENDING,
        timestamp: now,
        reason: `Retry scheduled after failure (attempt ${job.attempts})`,
      });

      this.#logger.warn({ jobId: job.id, attempt: job.attempts, retryIn: `${retryDelay}ms` }, 'Job failed, scheduling retry');
    } else {
      job.status = JobStatus.FAILED;
      job.failedAt = now;
      job.history.push({ status: JobStatus.FAILED, timestamp: now });
      this.#logger.error({ jobId: job.id, attempt: job.attempts }, 'Job failed permanently after all retries');

      // Fire and forget webhook for permanent failure
      dispatchWebhook(job);
    }

    await this.#db.append(job);
    return structuredClone(job);
  }

  /**
   * Cancels a pending or running job.
   *
   * @param {string} jobId - The ID of the job to cancel.
   * @returns {Promise<object>} The canceled job object.
   * @throws {Error} If the job cannot be found or is in a non-cancelable state.
   */
  async cancel(jobId) {
    const job = await this.#db.findById(jobId);
    if (!job) {
      throw new Error(`Job with ID '${jobId}' not found.`);
    }

    if (![JobStatus.PENDING, JobStatus.RUNNING].includes(job.status)) {
      throw new Error(`Job in status '${job.status}' cannot be canceled.`);
    }

    const now = new Date().toISOString();
    job.status = JobStatus.CANCELED;
    job.updatedAt = now;
    job.canceledAt = now;
    job.history.push({ status: JobStatus.CANCELED, timestamp: now });

    await this.#db.append(job);
    this.#logger.info({ jobId: job.id }, 'Job cancellation requested');

    // Note: If the job was 'running', this only marks it as canceled.
    // It's the responsibility of the worker/task executor to check for this
    // status and stop its work, which is outside the scope of this orchestrator.

    return structuredClone(job);
  }
}