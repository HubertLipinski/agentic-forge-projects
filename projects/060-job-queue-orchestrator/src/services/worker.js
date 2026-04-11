/**
 * src/services/worker.js
 *
 * Simulates the execution of a job for a given task. This module acts as the
 * "worker" that performs the actual work defined by a job's type and payload.
 *
 * In a real-world, distributed system, this logic might exist in a separate
 * worker process or service. For this self-contained orchestrator, it's a
 * module that simulates different job outcomes (success, failure) based on
 * the job's payload. This allows for testing the orchestrator's behavior
 * under various conditions without needing complex external dependencies.
 *
 * The primary export, `executeJob`, is designed to be called by the Scheduler.
 * It returns a promise that resolves with the job's output on success or
 * rejects with an error on failure.
 */

import logger from '../utils/logger.js';

/**
 * A simple delay function to simulate asynchronous work.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the specified duration.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simulates the execution of a job.
 *
 * This function inspects the job's type and payload to determine how to
 * "execute" it. It's a mock implementation that can be configured to
 * succeed, fail, or take a certain amount of time based on the job's input.
 *
 * - If `job.payload.shouldFail` is true, the job will be made to fail.
 * - If `job.payload.executionTime` is set, the job will simulate work for that duration.
 * - Unknown job types will result in an immediate failure.
 *
 * @param {object} job - The job object to be executed.
 * @param {string} job.id - The unique identifier of the job.
 * @param {string} job.type - The type of the job, which determines the action.
 * @param {object} job.payload - The data associated with the job.
 * @returns {Promise<object>} A promise that resolves with the job's output on success.
 * @throws {Error} Throws an error if the job execution fails.
 */
export async function executeJob(job) {
  const { id, type, payload } = job;
  const workerLogger = logger.child({ service: 'Worker', jobId: id, jobType: type });

  workerLogger.info({ payload }, 'Starting job execution.');

  // Default execution time if not specified in payload.
  const executionTime = payload?.executionTime ?? Math.floor(Math.random() * (2000 - 500 + 1) + 500); // 500ms to 2s

  try {
    // Simulate I/O or CPU-bound work with a delay.
    await delay(executionTime);

    // Check for a payload directive to force a failure.
    // This is useful for testing retry logic and failure handling.
    if (payload?.shouldFail) {
      throw new Error('Job was instructed to fail via payload.');
    }

    let output;
    // --- Job Type Handlers ---
    // This switch statement simulates routing the job to the correct handler
    // based on its type. In a real application, these might be calls to
    // different modules or functions.
    switch (type) {
      case 'echo':
        workerLogger.debug('Executing "echo" job type.');
        output = {
          message: 'Echo successful',
          receivedPayload: payload,
          executedAt: new Date().toISOString(),
        };
        break;

      case 'image-resize':
        workerLogger.debug('Executing "image-resize" job type.');
        output = {
          message: `Resized image from payload to ${payload.width || 100}x${payload.height || 100}.`,
          newPath: `/processed/images/${id}.jpg`,
          size: Math.floor(Math.random() * 500) + 100, // kb
        };
        break;

      case 'send-email':
        workerLogger.debug('Executing "send-email" job type.');
        if (!payload?.recipient) {
          throw new Error('Missing "recipient" in payload for send-email job.');
        }
        output = {
          message: `Email successfully sent to ${payload.recipient}.`,
          messageId: `msg_${Date.now()}`,
        };
        break;

      default:
        // If the job type is not recognized, we must fail the job.
        workerLogger.error('Unrecognized job type.');
        throw new Error(`Unknown job type: '${type}'`);
    }

    workerLogger.info({ executionTime, output }, 'Job execution completed successfully.');
    return output;

  } catch (error) {
    // Log the error and re-throw it so the Scheduler can handle the failure.
    workerLogger.error({ err: error, executionTime }, 'Job execution failed.');
    // The error is passed up to the scheduler's #processJob method.
    throw error;
  }
}