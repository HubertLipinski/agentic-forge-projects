/**
 * @file src/services/job-service.js
 * @description Business logic layer for managing jobs.
 * This service provides an abstraction over the low-level job queue operations,
 * encapsulating the core logic for creating, retrieving, and canceling jobs.
 * It orchestrates calls to the `job-queue` library and handles business rules
 * and data transformations.
 */

import pino from 'pino';
import * as JobQueue from '../lib/job-queue.js';
import { AppError, NotFoundError, ConflictError } from '../lib/errors.js';

// --- Logger Initialization ---
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
    },
  },
}).child({ module: 'job-service' });

/**
 * Creates a new job and adds it to the queue.
 * This function takes the raw job data from the API layer, validates it (though
 * primary validation is expected at the route level), and passes it to the
 * job queue library to be persisted in Redis.
 *
 * @param {object} jobData - The data for the new job, conforming to `createJobSchema`.
 *   - `type` (string): The type of the job.
 *   - `payload` (object): The job's payload.
 *   - `priority` (number, optional): The job's priority.
 *   - `delay` (number, optional): The job's delay in milliseconds.
 *   - `retry` (object, optional): Retry configuration.
 *   - `webhook` (object, optional): Webhook configuration.
 * @returns {Promise<object>} The newly created job object, including its generated ID and timestamps.
 * @throws {AppError} If there is an issue adding the job to the queue.
 */
export async function createJob(jobData) {
  logger.info({ type: jobData.type }, 'Attempting to create a new job.');
  try {
    const newJob = await JobQueue.addJob(jobData);
    logger.info({ jobId: newJob.id, type: newJob.type }, 'Job created successfully.');
    return newJob;
  } catch (error) {
    logger.error({ err: error, jobData }, 'Error during job creation.');
    // Wrap the low-level error in a more specific application-level error.
    throw new AppError(`Failed to create job: ${error.message}`, 500, error);
  }
}

/**
 * Retrieves the current status and data for a specific job.
 *
 * @param {string} jobId - The unique identifier of the job to retrieve.
 * @returns {Promise<object>} The job object.
 * @throws {NotFoundError} If no job with the specified ID is found.
 * @throws {AppError} If there is a problem fetching the job from storage.
 */
export async function getJobStatus(jobId) {
  logger.debug({ jobId }, 'Fetching status for job.');
  try {
    const job = await JobQueue.getJob(jobId);

    if (!job) {
      logger.warn({ jobId }, 'Job status requested for a non-existent job.');
      throw new NotFoundError(`Job with ID '${jobId}' not found.`);
    }

    logger.debug({ jobId, status: job.status }, 'Job status retrieved successfully.');
    return job;
  } catch (error) {
    // If it's already a NotFoundError, re-throw it directly.
    if (error instanceof NotFoundError) {
      throw error;
    }
    // Otherwise, wrap it as a generic internal error.
    logger.error({ err: error, jobId }, 'Error retrieving job status.');
    throw new AppError(`Failed to get status for job ${jobId}: ${error.message}`, 500, error);
  }
}

/**
 * Attempts to cancel a job.
 * A job can only be canceled if it is in a 'waiting' or 'delayed' state.
 * It cannot be canceled if it is 'processing', 'completed', or 'failed'.
 *
 * @param {string} jobId - The unique identifier of the job to cancel.
 * @returns {Promise<object>} The updated job object with a 'canceled' status.
 * @throws {NotFoundError} If the job does not exist.
 * @throws {ConflictError} If the job is in a state that cannot be canceled (e.g., 'processing').
 * @throws {AppError} If there is an issue during the cancellation process.
 */
export async function cancelJob(jobId) {
  logger.info({ jobId }, 'Attempting to cancel job.');

  try {
    // First, retrieve the job to check its current state.
    const job = await JobQueue.getJob(jobId);

    if (!job) {
      logger.warn({ jobId }, 'Attempted to cancel a non-existent job.');
      throw new NotFoundError(`Job with ID '${jobId}' not found.`);
    }

    // Business rule: check if the job is in a cancelable state.
    const cancelableStates = ['waiting', 'delayed'];
    if (!cancelableStates.includes(job.status)) {
      logger.warn(
        { jobId, status: job.status },
        'Attempted to cancel a job in a non-cancelable state.'
      );
      throw new ConflictError(
        `Job with ID '${jobId}' cannot be canceled because it is in the '${job.status}' state.`
      );
    }

    // Atomically remove the job from its queue (waiting, delayed, or retry).
    const wasRemoved = await JobQueue.removeJobFromQueues(jobId);

    if (!wasRemoved) {
      // This is a rare race condition: the job was checked as 'waiting' or 'delayed',
      // but a worker picked it up *just* before we could remove it.
      logger.warn(
        { jobId },
        'Failed to cancel job; it was likely picked up by a worker concurrently.'
      );
      throw new ConflictError(
        `Failed to cancel job '${jobId}'. It was likely processed just now. Please check its status again.`
      );
    }

    // If successfully removed from the queue, update its status to 'canceled'.
    const updatedJob = await JobQueue.updateJob(jobId, { status: 'canceled' });

    logger.info({ jobId }, 'Job canceled successfully.');
    return updatedJob;
  } catch (error) {
    // Re-throw specific, known errors.
    if (error instanceof NotFoundError || error instanceof ConflictError) {
      throw error;
    }
    // Wrap unknown errors.
    logger.error({ err: error, jobId }, 'Error during job cancellation.');
    throw new AppError(`Failed to cancel job ${jobId}: ${error.message}`, 500, error);
  }
}