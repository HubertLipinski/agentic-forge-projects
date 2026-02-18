/**
 * @file src/workers/job-processor.js
 * @description The main background worker process for the job queue.
 * This worker continuously polls Redis for available jobs, executes them,
 * and handles the outcome (success, failure, or retry). It is designed to
 * be run as a separate process from the API server to ensure that long-running
 * tasks do not block incoming requests.
 */

import pino from 'pino';
import * as JobQueue from '../lib/job-queue.js';
import { sendWebhook } from '../lib/webhook-caller.js';
import redisClient from '../config/redis.js';

// --- Constants ---
const WORKER_ID = `worker-${process.pid}`;
const POLLING_TIMEOUT_SECONDS = 5; // Time BRPOPLPUSH waits for a job
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10000; // 10 seconds to finish current job

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
}).child({ module: 'job-processor', workerId: WORKER_ID });

// --- State Management ---
let isShuttingDown = false;
let currentJobId = null;

/**
 * A simple promise-based delay function.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulates the execution of a job based on its type.
 * In a real-world application, this function would act as a dispatcher,
 * dynamically importing and calling handler functions based on `job.type`.
 *
 * Example:
 *   const handler = await import(`./handlers/${job.type}.js`);
 *   await handler.execute(job.payload);
 *
 * For this project, we simulate work with a delay and potential for failure.
 *
 * @param {object} job - The job object to execute.
 * @returns {Promise<object>} A result object from the job execution.
 * @throws {Error} If the job is configured to fail for demonstration purposes.
 */
async function executeJob(job) {
  logger.info({ jobId: job.id, type: job.type }, 'Executing job.');

  // Simulate I/O or CPU-intensive work
  const executionTime = job.payload?.executionTime ?? 1000;
  await delay(executionTime);

  // Simulate a failure condition for testing retry logic
  if (job.payload?.shouldFail === true) {
    throw new Error(`Job ${job.id} failed as requested by payload.`);
  }

  logger.info({ jobId: job.id }, 'Job execution simulation complete.');
  return { success: true, message: `Job ${job.id} completed successfully.` };
}

/**
 * Handles the successful completion of a job.
 * It updates the job's status to 'completed', finalizes it in the queue,
 * and triggers a webhook if configured.
 *
 * @param {object} job - The job that has completed.
 * @param {object} result - The result from the job's execution.
 */
async function handleJobSuccess(job, result) {
  const { id: jobId } = job;
  logger.info({ jobId, result }, 'Job succeeded.');

  try {
    const finalJobState = {
      status: 'completed',
      completedAt: Date.now(),
      result,
    };
    await JobQueue.updateJob(jobId, finalJobState);
    await JobQueue.finalizeJob(jobId);

    if (job.webhook?.url) {
      const webhookPayload = {
        jobId,
        status: 'completed',
        type: job.type,
        completedAt: finalJobState.completedAt,
        result,
      };
      // Send webhook but don't await it to prevent blocking the worker loop.
      sendWebhook({
        url: job.webhook.url,
        payload: webhookPayload,
        headers: job.webhook.headers,
        jobId,
      }).catch(err => logger.error({ err, jobId }, 'Webhook dispatch failed unexpectedly.'));
    }
  } catch (error) {
    logger.error({ err: error, jobId }, 'Error during job success handling.');
  }
}

/**
 * Handles the failure of a job.
 * It checks if the job has remaining retry attempts. If so, it schedules a
 * retry with exponential backoff. Otherwise, it marks the job as 'failed'.
 * A webhook is triggered in either case if configured.
 *
 * @param {object} job - The job that has failed.
 * @param {Error} error - The error that caused the failure.
 */
async function handleJobFailure(job, error) {
  const { id: jobId } = job;
  const attemptsMade = job.attempts.made + 1;
  const maxAttempts = job.attempts.max;

  logger.warn({ jobId, error: error.message, attemptsMade, maxAttempts }, 'Job failed.');

  const hasMoreRetries = attemptsMade < maxAttempts;

  try {
    let finalJobState;
    let webhookStatus;

    if (hasMoreRetries) {
      const backoffDelay = (job.retry?.backoff ?? 1000) * (2 ** (attemptsMade - 1));
      const retryAt = Date.now() + backoffDelay;
      webhookStatus = 'retrying';

      finalJobState = {
        status: 'retrying',
        attempts: { ...job.attempts, made: attemptsMade },
        lastError: error.message,
      };

      await JobQueue.updateJob(jobId, finalJobState);
      await JobQueue.scheduleForRetry(jobId, retryAt);
      logger.info({ jobId, retryAt, backoffDelay }, 'Job scheduled for retry.');
    } else {
      webhookStatus = 'failed';
      finalJobState = {
        status: 'failed',
        failedAt: Date.now(),
        attempts: { ...job.attempts, made: attemptsMade },
        lastError: error.message,
      };

      await JobQueue.updateJob(jobId, finalJobState);
      await JobQueue.finalizeJob(jobId);
      logger.error({ jobId }, 'Job failed after all retry attempts.');
    }

    if (job.webhook?.url) {
      const webhookPayload = {
        jobId,
        status: webhookStatus,
        type: job.type,
        lastError: error.message,
        attempts: { made: attemptsMade, max: maxAttempts },
        failedAt: finalJobState.failedAt, // Will be undefined for 'retrying'
      };
      // Send webhook but don't await it.
      sendWebhook({
        url: job.webhook.url,
        payload: webhookPayload,
        headers: job.webhook.headers,
        jobId,
      }).catch(err => logger.error({ err, jobId }, 'Webhook dispatch failed unexpectedly.'));
    }
  } catch (err) {
    logger.error({ err, jobId }, 'Critical error during job failure handling.');
  }
}

/**
 * The main loop of the worker. It continuously fetches and processes jobs.
 * The loop will gracefully exit if the `isShuttingDown` flag is set.
 */
async function startWorkerLoop() {
  logger.info('Worker started. Waiting for jobs...');

  while (!isShuttingDown) {
    let job = null;
    try {
      // Atomically fetch a job and move it to the processing queue.
      // This is a blocking call that waits for `POLLING_TIMEOUT_SECONDS`.
      job = await JobQueue.fetchNextJob(POLLING_TIMEOUT_SECONDS);

      if (job) {
        currentJobId = job.id;
        const jobResult = await executeJob(job);
        await handleJobSuccess(job, jobResult);
      } else {
        // No job was found in the timeout period, loop continues.
        logger.trace('No job in queue. Polling again.');
      }
    } catch (error) {
      if (job) {
        // An error occurred during job execution.
        await handleJobFailure(job, error);
      } else {
        // An error occurred in the queue logic itself.
        logger.error({ err: error }, 'An unexpected error occurred in the worker loop.');
        // Wait a moment before retrying to prevent fast-fail loops on persistent errors.
        await delay(1000);
      }
    } finally {
      currentJobId = null;
    }
  }

  logger.info('Worker loop has finished.');
}

/**
 * Initiates a graceful shutdown of the worker.
 * It sets a flag to stop the main loop and attempts to requeue any job
 * that is currently being processed.
 */
async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info('Graceful shutdown initiated. Will stop after current job...');

  // Give the current job some time to finish.
  const shutdownTimer = setTimeout(async () => {
    logger.warn('Shutdown timeout reached. Forcing exit.');
    if (currentJobId) {
      logger.warn({ jobId: currentJobId }, 'Job was interrupted.');
    }
    await redisClient.quit();
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);

  // If a job is in progress, wait for it to finish. The loop will then exit.
  // If no job is in progress, the loop will exit on its next iteration.
  while (currentJobId) {
    await delay(100);
  }

  clearTimeout(shutdownTimer);
  logger.info('Worker has shut down gracefully.');
  await redisClient.quit();
  process.exit(0);
}

/**
 * The main entry point for the worker process.
 * It sets up signal handlers for graceful shutdown and starts the worker loop.
 */
export async function start() {
  // Ensure Redis is connected before starting
  try {
    await redisClient.connect();
  } catch (error) {
    logger.fatal({ err: error }, 'Worker failed to connect to Redis. Exiting.');
    process.exit(1);
  }

  // Set up signal handlers for graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal.');
    gracefulShutdown();
  });
  process.on('SIGINT', () => {
    logger.info('Received SIGINT signal (Ctrl+C).');
    gracefulShutdown();
  });

  // Start the main processing loop
  await startWorkerLoop();
}