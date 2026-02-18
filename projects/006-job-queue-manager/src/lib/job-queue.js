/**
 * @file job-queue.js
 * @description Core library for interacting with Redis to manage the job queue.
 * This module encapsulates all low-level Redis commands for adding, retrieving,
 * and updating jobs, ensuring atomicity and data integrity. It uses a set of
 * predefined Redis keys to manage jobs in different states (waiting, processing, delayed).
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../config/redis.js';

// --- Constants for Redis Keys ---
// Using a consistent prefix for all keys makes management and debugging easier.
const KEY_PREFIX = 'jqm'; // Job Queue Manager

/**
 * Redis key for the job data hash. Stores the full job object.
 * HASH: `jqm:job:<jobId>` -> { job data }
 * @param {string} jobId - The unique identifier for the job.
 * @returns {string} The Redis key for the job's hash.
 */
const jobKey = (jobId) => `${KEY_PREFIX}:job:${jobId}`;

/**
 * Redis key for the list of waiting jobs, treated as a priority queue.
 * LIST: `jqm:waiting`
 */
const waitingQueueKey = `${KEY_PREFIX}:waiting`;

/**
 * Redis key for the list of jobs currently being processed. Used for crash recovery.
 * LIST: `jqm:processing`
 */
const processingQueueKey = `${KEY_PREFIX}:processing`;

/**
 * Redis key for the sorted set of delayed jobs.
 * ZSET: `jqm:delayed` -> score: timestamp, member: jobId
 */
const delayedQueueKey = `${KEY_MEMBER_PREFIX}:delayed`;

/**
 * Redis key for the sorted set of jobs waiting for retry.
 * ZSET: `jqm:retry` -> score: timestamp, member: jobId
 */
const retryQueueKey = `${KEY_MEMBER_PREFIX}:retry`;

// --- Logger Initialization ---
const logger = pino({ level: process.env.LOG_LEVEL || 'info' }).child({
  module: 'job-queue',
});

// --- Lua Scripts for Atomic Operations ---
// Using Lua scripts is the most efficient and safest way to perform complex,
// multi-key atomic operations in Redis.

/**
 * @constant {string} LUA_ADD_JOB
 * @description Lua script to atomically add a new job.
 * It creates the job hash and adds the job ID to the appropriate queue
 * (delayed or waiting) based on the provided delay.
 *
 * Keys:
 *   KEYS[1]: The job hash key (e.g., 'jqm:job:<jobId>')
 *   KEYS[2]: The waiting queue list key ('jqm:waiting')
 *   KEYS[3]: The delayed queue sorted set key ('jqm:delayed')
 *
 * Args:
 *   ARGV[1]: The job ID.
 *   ARGV[2]: The serialized job data (JSON string).
 *   ARGV[3]: The job's priority.
 *   ARGV[4]: The timestamp when the job should be processed (score for ZSET).
 *   ARGV[5]: A flag indicating if the job is delayed (1 for delayed, 0 for immediate).
 *
 * @returns {string} The job ID.
 */
const LUA_ADD_JOB = `
  -- ARGV[1]: jobId, ARGV[2]: jobData, ARGV[3]: priority, ARGV[4]: processAt, ARGV[5]: isDelayed
  local jobId = ARGV[1]
  local jobData = ARGV[2]
  local priority = tonumber(ARGV[3])
  local processAt = tonumber(ARGV[4])
  local isDelayed = tonumber(ARGV[5])

  -- Create the job hash
  redis.call('HSET', KEYS[1], 'data', jobData)

  if isDelayed == 1 then
    -- Add to the delayed sorted set with a score of the process-at timestamp
    redis.call('ZADD', KEYS[3], processAt, jobId)
  else
    -- Add to the waiting list. Use priority to decide LPUSH vs RPUSH.
    if priority > 0 then
      redis.call('LPUSH', KEYS[2], jobId)
    else
      redis.call('RPUSH', KEYS[2], jobId)
    end
  end

  return jobId
`;

/**
 * @constant {string} LUA_REQUEUE_JOB
 * @description Lua script to atomically move a job back to the waiting queue.
 * This is used when a worker is gracefully shut down and needs to return an
 * unfinished job. It removes the job from the processing list and adds it back
 * to the front of the waiting list.
 *
 * Keys:
 *   KEYS[1]: The processing queue list key ('jqm:processing')
 *   KEYS[2]: The waiting queue list key ('jqm:waiting')
 *
 * Args:
 *   ARGV[1]: The job ID to requeue.
 *
 * @returns {number} 1 if the job was successfully requeued, 0 otherwise.
 */
const LUA_REQUEUE_JOB = `
  -- ARGV[1]: jobId
  local jobId = ARGV[1]

  -- Atomically remove from processing and add to the front of waiting
  if redis.call('LREM', KEYS[1], 1, jobId) > 0 then
    redis.call('LPUSH', KEYS[2], jobId)
    return 1
  end

  return 0
`;

// --- Public Functions ---

/**
 * Adds a new job to the queue.
 * The job is stored in a Redis hash, and its ID is added to either the
 * 'waiting' list or the 'delayed' sorted set.
 *
 * @param {object} jobData - The job data object, conforming to the createJobSchema.
 * @returns {Promise<object>} The full job object, including the generated ID and timestamps.
 * @throws {Error} If the Redis operation fails.
 */
export async function addJob(jobData) {
  const jobId = uuidv4();
  const now = Date.now();

  const job = {
    id: jobId,
    ...structuredClone(jobData), // Deep clone to prevent mutation
    status: 'waiting',
    createdAt: now,
    updatedAt: now,
    attempts: {
      made: 0,
      max: jobData.retry?.maxAttempts ?? 3,
    },
  };

  const isDelayed = (job.delay ?? 0) > 0;
  const processAt = now + (job.delay ?? 0);

  try {
    // Ensure the script is loaded into Redis. `defineCommand` is idempotent.
    if (!redisClient.addJob) {
      redisClient.defineCommand('addJob', {
        numberOfKeys: 3,
        lua: LUA_ADD_JOB,
      });
    }

    await redisClient.addJob(
      jobKey(jobId),
      waitingQueueKey,
      delayedQueueKey,
      jobId,
      JSON.stringify(job), // Store the full job object
      job.priority ?? 0,
      processAt,
      isDelayed ? 1 : 0
    );

    logger.info({ jobId, type: job.type, isDelayed }, 'Job added successfully.');
    return job;
  } catch (error) {
    logger.error({ err: error, jobId }, 'Failed to add job to Redis.');
    throw new Error(`Could not add job: ${error.message}`);
  }
}

/**
 * Fetches a job by its ID.
 *
 * @param {string} jobId - The ID of the job to retrieve.
 * @returns {Promise<object|null>} The job object, or null if not found.
 */
export async function getJob(jobId) {
  try {
    const jobData = await redisClient.hget(jobKey(jobId), 'data');
    if (!jobData) {
      logger.warn({ jobId }, 'Attempted to get a non-existent job.');
      return null;
    }
    return JSON.parse(jobData);
  } catch (error) {
    logger.error({ err: error, jobId }, 'Failed to get job from Redis.');
    throw new Error(`Could not retrieve job ${jobId}: ${error.message}`);
  }
}

/**
 * Updates a job's data in the Redis hash.
 * This performs an atomic read-modify-write operation.
 *
 * @param {string} jobId - The ID of the job to update.
 * @param {object} updates - An object containing the fields to update.
 * @returns {Promise<object>} The updated job object.
 * @throws {Error} If the job does not exist or the update fails.
 */
export async function updateJob(jobId, updates) {
  const key = jobKey(jobId);
  try {
    // Use WATCH for an optimistic lock to prevent race conditions.
    await redisClient.watch(key);

    const currentJobData = await redisClient.hget(key, 'data');
    if (!currentJobData) {
      await redisClient.unwatch();
      throw new Error(`Job with ID ${jobId} not found for update.`);
    }

    const currentJob = JSON.parse(currentJobData);
    const updatedJob = {
      ...currentJob,
      ...updates,
      updatedAt: Date.now(),
    };

    const multi = redisClient.multi();
    multi.hset(key, 'data', JSON.stringify(updatedJob));
    const result = await multi.exec();

    // If result is null, the WATCH failed (another client modified the key).
    if (result === null) {
      throw new Error(`Conflict updating job ${jobId}. Please retry.`);
    }

    logger.debug({ jobId, updates }, 'Job updated successfully.');
    return updatedJob;
  } catch (error) {
    logger.error({ err: error, jobId }, 'Failed to update job in Redis.');
    // Ensure UNWATCH is called on error to clean up the connection state.
    await redisClient.unwatch().catch(err => logger.warn({ err }, 'Failed to unwatch key on error.'));
    throw new Error(`Could not update job ${jobId}: ${error.message}`);
  }
}

/**
 * Atomically fetches a job from the waiting queue and moves it to the processing queue.
 * This is a blocking operation that waits for a job to become available.
 *
 * @param {number} blockTimeout - The maximum time in seconds to wait for a job.
 * @returns {Promise<object|null>} The job object, or null if the timeout is reached.
 */
export async function fetchNextJob(blockTimeout = 5) {
  try {
    // BRPOPLPUSH is atomic and reliable. It blocks until an item is available
    // in `waitingQueueKey`, then pops it and pushes it to `processingQueueKey`.
    const jobId = await redisClient.brpoplpush(
      waitingQueueKey,
      processingQueueKey,
      blockTimeout
    );

    if (!jobId) {
      return null; // Timed out, no job available
    }

    const job = await getJob(jobId);
    if (!job) {
      // This is an inconsistent state, the job ID was in the queue but the hash is missing.
      // Remove the ghost ID from the processing queue.
      logger.error({ jobId }, 'Orphaned job ID found in queue. Removing from processing list.');
      await redisClient.lrem(processingQueueKey, 1, jobId);
      return null;
    }

    return job;
  } catch (error) {
    logger.error({ err: error }, 'Error fetching next job from queue.');
    // Don't rethrow, as the worker loop should continue.
    return null;
  }
}

/**
 * Moves a completed or failed job from the processing queue.
 *
 * @param {string} jobId - The ID of the job to finalize.
 * @returns {Promise<void>}
 */
export async function finalizeJob(jobId) {
  try {
    // Simply remove the job from the processing list. Its final state is in the hash.
    const removedCount = await redisClient.lrem(processingQueueKey, 1, jobId);
    if (removedCount > 0) {
      logger.info({ jobId }, 'Job finalized and removed from processing queue.');
    } else {
      logger.warn({ jobId }, 'Attempted to finalize a job not in the processing queue.');
    }
  } catch (error) {
    logger.error({ err: error, jobId }, 'Failed to finalize job.');
    throw new Error(`Could not finalize job ${jobId}: ${error.message}`);
  }
}

/**
 * Moves a job to the retry queue (a sorted set scored by the next retry time).
 *
 * @param {string} jobId - The ID of the job to schedule for retry.
 * @param {number} retryAt - The timestamp (in ms) when the job should be retried.
 * @returns {Promise<void>}
 */
export async function scheduleForRetry(jobId, retryAt) {
  try {
    const multi = redisClient.multi();
    // Remove from the processing list
    multi.lrem(processingQueueKey, 1, jobId);
    // Add to the retry sorted set
    multi.zadd(retryQueueKey, retryAt, jobId);
    await multi.exec();
    logger.info({ jobId, retryAt: new Date(retryAt).toISOString() }, 'Job scheduled for retry.');
  } catch (error) {
    logger.error({ err: error, jobId }, 'Failed to schedule job for retry.');
    throw new Error(`Could not schedule retry for job ${jobId}: ${error.message}`);
  }
}

/**
 * Checks for delayed or retry-scheduled jobs that are now ready to be processed
 * and moves them to the waiting queue.
 *
 * @returns {Promise<number>} The number of jobs moved to the waiting queue.
 */
export async function promoteReadyJobs() {
  const now = Date.now();
  let totalPromoted = 0;

  try {
    // Promote jobs from the delayed queue
    const delayedJobs = await redisClient.zrangebyscore(delayedQueueKey, 0, now);
    if (delayedJobs.length > 0) {
      const multi = redisClient.multi();
      multi.zrem(delayedQueueKey, ...delayedJobs);
      multi.rpush(waitingQueueKey, ...delayedJobs); // Use RPUSH for fairness
      await multi.exec();
      totalPromoted += delayedJobs.length;
      logger.info({ count: delayedJobs.length }, 'Promoted delayed jobs to waiting queue.');
    }

    // Promote jobs from the retry queue
    const retryJobs = await redisClient.zrangebyscore(retryQueueKey, 0, now);
    if (retryJobs.length > 0) {
      const multi = redisClient.multi();
      multi.zrem(retryQueueKey, ...retryJobs);
      multi.rpush(waitingQueueKey, ...retryJobs); // Use RPUSH for fairness
      await multi.exec();
      totalPromoted += retryJobs.length;
      logger.info({ count: retryJobs.length }, 'Promoted jobs from retry to waiting queue.');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to promote ready jobs.');
  }
  return totalPromoted;
}

/**
 * Re-queues a job from the processing list back to the waiting list.
 * This is intended for graceful shutdown of workers.
 *
 * @param {string} jobId - The ID of the job to requeue.
 * @returns {Promise<boolean>} True if the job was successfully requeued.
 */
export async function requeueJob(jobId) {
  try {
    if (!redisClient.requeueJob) {
      redisClient.defineCommand('requeueJob', {
        numberOfKeys: 2,
        lua: LUA_REQUEUE_JOB,
      });
    }
    const result = await redisClient.requeueJob(
      processingQueueKey,
      waitingQueueKey,
      jobId
    );
    const success = result === 1;
    if (success) {
      logger.info({ jobId }, 'Job successfully requeued from processing to waiting.');
    } else {
      logger.warn({ jobId }, 'Attempted to requeue a job that was not in the processing list.');
    }
    return success;
  } catch (error) {
    logger.error({ err: error, jobId }, 'Failed to requeue job.');
    throw new Error(`Could not requeue job ${jobId}: ${error.message}`);
  }
}