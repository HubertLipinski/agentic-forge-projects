/**
 * @fileoverview Implements the Worker node for the Adaptive Scraper Cluster.
 *
 * The Worker is the core execution unit of the cluster. Its primary responsibility
 * is to continuously pull scraping jobs from a shared Redis queue, execute them,
 * and push the results (or failures) to corresponding Redis lists. It's designed
 * to run as a scalable, independent process, allowing multiple workers to operate
 * in parallel to handle a large volume of scraping tasks.
 *
 * The worker's lifecycle involves:
 * 1. Initialization: Connect to Redis, initialize services (ProxyManager, etc.).
 * 2. Main Loop: Enter an infinite loop to wait for and process jobs.
 * 3. Job Execution: For each job, use the RequestDispatcher to fetch the URL
 *    and the ParserFactory to extract data.
 * 4. Reporting: Push the structured result or an error object to Redis.
 * 5. Health Pinging: Periodically update its status in Redis so the Controller
 *    can monitor its health.
 * 6. Graceful Shutdown: Handle process signals to stop cleanly, ensuring any
 *    in-progress job is requeued.
 */

import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { getRedisClient, ensureRedisConnected } from '../services/redis-client.js';
import { getLogger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { dispatchRequest } from '../fetcher/request-dispatcher.js';
import { getParser } from '../parser/parser-factory.js';
import proxyManager from '../services/proxy-manager.js';

const WORKER_ID = `worker-${hostname()}-${randomUUID().slice(0, 8)}`;
const logger = getLogger().child({ nodeType: 'worker', workerId: WORKER_ID });

let redisClient;
let config;
let isShuttingDown = false;
let currentJobId = null;

/**
 * Initializes the worker by setting up configuration, connecting to Redis,
 * and initializing dependent services.
 * @returns {Promise<void>}
 */
async function initialize() {
  logger.info('Initializing worker...');
  config = getConfig();
  redisClient = getRedisClient();
  await ensureRedisConnected();
  await proxyManager.initialize();
  logger.info('Worker initialized successfully.');
}

/**
 * Periodically sends a heartbeat to Redis to signal that the worker is alive.
 * The controller uses this to detect and prune dead workers.
 */
async function startHealthPinger() {
  const { keyPrefix } = config.redis;
  const { workerTimeout } = config.controller;
  const healthKey = `${keyPrefix}workers:active`;
  const pingInterval = Math.floor(workerTimeout / 2) * 1000; // Ping at half the timeout duration

  const ping = async () => {
    if (isShuttingDown) return;
    try {
      const payload = {
        id: WORKER_ID,
        hostname: hostname(),
        pid: process.pid,
        status: currentJobId ? 'busy' : 'idle',
        currentJobId,
        timestamp: Date.now(),
      };
      await redisClient.hset(healthKey, WORKER_ID, JSON.stringify(payload));
      logger.trace('Sent health ping to controller.');
    } catch (error) {
      logger.error({ err: error }, 'Failed to send health ping.');
    }
  };

  // Perform an initial ping immediately, then set the interval.
  await ping();
  const intervalId = setInterval(ping, pingInterval);

  // Return a function to clear the interval on shutdown.
  return () => clearInterval(intervalId);
}

/**
 * Requeues a job that was being processed when the worker was interrupted.
 * This ensures that jobs are not lost during deployments or unexpected shutdowns.
 * @param {string} jobString - The stringified job object to requeue.
 * @returns {Promise<void>}
 */
async function requeueInProgressJob(jobString) {
  if (!jobString) return;

  try {
    const job = JSON.parse(jobString);
    const { keyPrefix } = config.redis;
    const queueKey = `${keyPrefix}queue:p${job.priority ?? 0}`;

    logger.warn({ jobId: job.id }, 'Requeuing in-progress job due to shutdown.');
    // LPUSH to put it at the front of its priority queue.
    await redisClient.lpush(queueKey, jobString);
  } catch (error) {
    logger.error({ err: error }, 'Failed to requeue in-progress job.');
  }
}

/**
 * Handles graceful shutdown of the worker.
 * It sets a flag to stop the main loop, requeues any active job,
 * and disconnects from Redis.
 * @param {string} signal - The signal that triggered the shutdown.
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Received ${signal}. Starting graceful shutdown...`);

  // If a job is in progress, try to requeue it.
  // We need to fetch the job string from Redis as we only have its ID.
  if (currentJobId) {
    const { keyPrefix } = config.redis;
    const inProgressKey = `${keyPrefix}jobs:inprogress:${WORKER_ID}`;
    try {
      const jobString = await redisClient.get(inProgressKey);
      if (jobString) {
        await requeueInProgressJob(jobString);
      }
    } catch (error) {
      logger.error({ err: error, jobId: currentJobId }, 'Could not retrieve job for requeueing.');
    }
  }

  // Clean up worker's presence from active list.
  try {
    const { keyPrefix } = config.redis;
    await redisClient.hdel(`${keyPrefix}workers:active`, WORKER_ID);
  } catch (error) {
    logger.error({ err: error }, 'Failed to remove worker from active set during shutdown.');
  }

  logger.info('Worker shutdown complete.');
  process.exit(0);
}

/**
 * Processes a single scraping job.
 * @param {string} jobString - The stringified job object from Redis.
 * @returns {Promise<void>}
 */
async function processJob(jobString) {
  let job;
  try {
    job = JSON.parse(jobString);
    currentJobId = job.id;
  } catch (error) {
    logger.error({ err: error, jobString }, 'Failed to parse job from queue. Discarding.');
    // Cannot report failure without a job ID, so we just log and move on.
    return;
  }

  const jobLogger = logger.child({ jobId: job.id });
  const { keyPrefix } = config.redis;
  const inProgressKey = `${keyPrefix}jobs:inprogress:${WORKER_ID}`;
  const resultsKey = `${keyPrefix}results:success`;
  const failuresKey = `${keyPrefix}results:failed`;

  try {
    // Mark job as in-progress for recovery purposes.
    await redisClient.set(inProgressKey, jobString, 'EX', config.controller.workerTimeout * 2);

    // 1. Fetch the content
    const { body, statusCode, finalUrl } = await dispatchRequest(job);

    // 2. Get the appropriate parser
    const parse = getParser(job.parser ?? 'html-cheerio');

    // 3. Parse the content
    const data = await parse(body, job);

    // 4. Report success
    const result = {
      jobId: job.id,
      workerId: WORKER_ID,
      status: 'success',
      timestamp: new Date().toISOString(),
      url: job.url,
      finalUrl,
      statusCode,
      metadata: job.metadata ?? {},
      data,
    };
    await redisClient.lpush(resultsKey, JSON.stringify(result));
    jobLogger.info('Job processed successfully.');

  } catch (error) {
    jobLogger.error({ err: error.message }, 'Job processing failed.');
    // Report failure
    const failureReport = {
      jobId: job.id,
      workerId: WORKER_ID,
      status: 'failed',
      timestamp: new Date().toISOString(),
      url: job.url,
      metadata: job.metadata ?? {},
      error: {
        message: error.message,
        stack: error.stack,
      },
    };
    await redisClient.lpush(failuresKey, JSON.stringify(failureReport));
  } finally {
    // Clean up in-progress marker and reset state
    await redisClient.del(inProgressKey);
    currentJobId = null;
  }
}

/**
 * The main loop of the worker. It continuously blocks on Redis waiting for a job,
 * then processes it.
 */
async function startMainLoop() {
  const { keyPrefix } = config.redis;
  // Create an array of queue keys, from highest priority to lowest.
  // Assuming a max priority of 10 for this example.
  const priorityQueues = Array.from({ length: 11 }, (_, i) => `${keyPrefix}queue:p${10 - i}`);

  const stopPinger = await startHealthPinger();

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  logger.info('Worker is running and waiting for jobs...');

  while (!isShuttingDown) {
    try {
      // `BRPOP` is a blocking pop. It waits for an item to be available.
      // The `0` timeout means it will wait forever.
      // It checks queues in the order they are provided.
      const result = await redisClient.brpop(priorityQueues, 0);

      if (result && !isShuttingDown) {
        // result is an array: [queueName, jobString]
        const [queueName, jobString] = result;
        const priority = queueName.split(':p')[1];
        logger.info({ priority }, `Pulled job from queue: ${queueName}`);
        await processJob(jobString);
      }
    } catch (error) {
      // This might happen if the Redis connection is lost.
      // ioredis will try to reconnect automatically. We log and pause.
      logger.error({ err: error }, 'Error in main loop. Pausing before retry...');
      if (!isShuttingDown) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5-second pause
      }
    }
  }
  stopPinger();
}

/**
 * The main entry point for the worker process.
 */
export async function run() {
  try {
    await initialize();
    await startMainLoop();
  } catch (error) {
    logger.fatal({ err: error }, 'Worker failed to start due to a critical error.');
    process.exit(1);
  }
}