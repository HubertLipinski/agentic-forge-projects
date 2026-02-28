/**
 * @fileoverview Implements the Controller node for the Adaptive Scraper Cluster.
 *
 * The Controller is the central coordination point of the cluster. Its primary
 * responsibilities include:
 * - Managing the lifecycle of scraping jobs: It listens for new job submissions
 *   on a dedicated Redis channel and enqueues them for processing by workers.
 * - Monitoring the health of worker nodes: It periodically checks for worker
 *   heartbeats and removes unresponsive (dead) workers from the active pool.
 * - Aggregating and reporting cluster-wide metrics: It periodically collects
 *   and logs statistics about queue lengths, worker counts, and job processing
 *   rates, providing a high-level overview of the cluster's performance.
 * - Graceful shutdown: It ensures a clean shutdown process, stopping its
 *   monitoring loops and disconnecting from Redis.
 */

import { randomUUID } from 'node:crypto';
import { getLogger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { getRedisClient, disconnectRedis, ensureRedisConnected } from '../services/redis-client.js';
import { validate } from '../utils/ajv-schemas.js';

/**
 * The main class for the Controller node.
 *
 * Encapsulates all logic for managing the cluster, including job submission,
 * worker health monitoring, and metrics aggregation.
 */
class Controller {
  /**
   * @private
   * @type {import('pino').Logger}
   */
  #logger;

  /**
   * @private
   * @type {import('ioredis').Redis}
   */
  #redis;

  /**
   * A dedicated Redis client for blocking operations like BLPOP or subscriptions.
   * Using a separate client prevents blocking the main client used for other commands.
   * @private
   * @type {import('ioredis').Redis}
   */
  #subscriberRedis;

  /**
   * @private
   * @type {object}
   */
  #config;

  /**
   * @private
   * @type {string}
   */
  #redisKeyPrefix;

  /**
   * @private
   * @type {NodeJS.Timeout|null}
   */
  #healthCheckInterval = null;

  /**
   * @private
   * @type {NodeJS.Timeout|null}
   */
  #metricsInterval = null;

  /**
   * @private
   * @type {boolean}
   */
  #isShuttingDown = false;

  /**
   * Initializes the Controller instance.
   */
  constructor() {
    this.#logger = getLogger().child({ nodeType: 'Controller' });
    this.#config = getConfig();
    this.#redisKeyPrefix = this.#config.redis.keyPrefix ?? 'asc:';
    this.#redis = getRedisClient();
    // Create a dedicated client for subscriptions to avoid blocking the main client.
    this.#subscriberRedis = this.#redis.duplicate();
  }

  /**
   * Starts the controller's main operations.
   *
   * This involves:
   * 1. Connecting to Redis.
   * 2. Starting the worker health check loop.
   * 3. Starting the metrics aggregation loop.
   * 4. Subscribing to the job submission channel.
   *
   * @returns {Promise<void>}
   */
  async start() {
    this.#logger.info('Starting Controller node...');
    try {
      await ensureRedisConnected();
      this.#logger.info('Redis connection established.');

      this.#startWorkerHealthCheck();
      this.#startMetricsLoop();
      await this.#listenForJobSubmissions();

      this.#logger.info('Controller is running and ready to accept jobs.');
    } catch (error) {
      this.#logger.fatal({ err: error }, 'Failed to start Controller.');
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Initiates a graceful shutdown of the controller.
   *
   * It stops all periodic tasks, unsubscribes from Redis channels,
   * and closes Redis connections.
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.#isShuttingDown) {
      this.#logger.warn('Shutdown already in progress.');
      return;
    }
    this.#isShuttingDown = true;
    this.#logger.info('Shutting down Controller node...');

    // Stop all timers
    if (this.#healthCheckInterval) clearInterval(this.#healthCheckInterval);
    if (this.#metricsInterval) clearInterval(this.#metricsInterval);

    // Unsubscribe and close the subscriber client
    try {
      if (this.#subscriberRedis.status === 'ready') {
        await this.#subscriberRedis.unsubscribe();
        await this.#subscriberRedis.quit();
        this.#logger.info('Redis subscriber client disconnected.');
      }
    } catch (err) {
      this.#logger.error({ err }, 'Error during Redis subscriber client shutdown.');
    }

    // Disconnect the main Redis client
    await disconnectRedis();

    this.#logger.info('Controller shutdown complete.');
  }

  /**
   * Subscribes to the Redis job submission channel and processes incoming jobs.
   * @private
   */
  async #listenForJobSubmissions() {
    const channel = `${this.#redisKeyPrefix}jobs:submit`;
    this.#logger.info({ channel }, 'Subscribing to job submission channel.');

    // The 'message' event listener is added before subscribing.
    this.#subscriberRedis.on('message', (ch, message) => {
      if (ch === channel) {
        this.#handleJobSubmission(message).catch(err => {
          this.#logger.error({ err }, 'Error processing job submission message.');
        });
      }
    });

    await this.#subscriberRedis.subscribe(channel);
  }

  /**
   * Handles a raw job submission message from Redis.
   * It validates the job data and enqueues it.
   * @private
   * @param {string} message - The raw JSON string message.
   */
  async #handleJobSubmission(message) {
    this.#logger.debug('Received new job submission message.');
    let jobData;
    try {
      jobData = JSON.parse(message);
    } catch (error) {
      this.#logger.error({ err: error.message }, 'Failed to parse job submission JSON.');
      return;
    }

    const { isValid, errors } = validate('asc/job', jobData);
    if (!isValid) {
      this.#logger.error({ errors, jobData }, 'Invalid job definition received.');
      return;
    }

    // Enrich job with defaults and a unique ID if not present
    const job = {
      id: jobData.id || randomUUID(),
      priority: jobData.priority ?? 0,
      metadata: jobData.metadata ?? {},
      ...jobData,
    };

    await this.#enqueueJob(job);
  }

  /**
   * Adds a validated job to the Redis priority queue (a sorted set).
   * @private
   * @param {object} job - The job object to enqueue.
   */
  async #enqueueJob(job) {
    const queueKey = `${this.#redisKeyPrefix}queue:pending`;
    const jobKey = `${this.#redisKeyPrefix}jobs:${job.id}`;

    try {
      // Use a pipeline for atomicity and performance.
      const pipeline = this.#redis.pipeline();
      // Store the full job definition. Expires after 7 days to prevent clutter.
      pipeline.set(jobKey, JSON.stringify(job), 'EX', 60 * 60 * 24 * 7);
      // Add job ID to the priority queue. The score is the priority.
      pipeline.zadd(queueKey, job.priority, job.id);
      await pipeline.exec();

      this.#logger.info({ jobId: job.id, priority: job.priority }, 'Successfully enqueued new job.');
    } catch (error) {
      this.#logger.error({ err: error, jobId: job.id }, 'Failed to enqueue job.');
    }
  }

  /**
   * Starts a periodic task to check for and prune dead workers.
   * @private
   */
  #startWorkerHealthCheck() {
    const { workerTimeout } = this.#config.controller;
    const intervalMs = workerTimeout * 1000;

    this.#logger.info({ interval: `${intervalMs}ms` }, 'Starting worker health check loop.');
    this.#healthCheckInterval = setInterval(() => this.#pruneDeadWorkers(), intervalMs);
  }

  /**
   * Scans for workers whose heartbeats have expired and removes them.
   * @private
   */
  async #pruneDeadWorkers() {
    if (this.#isShuttingDown) return;
    this.#logger.debug('Running dead worker pruning task...');

    const workersKey = `${this.#redisKeyPrefix}workers:active`;
    const timeoutThreshold = Date.now() - (this.#config.controller.workerTimeout * 1000);

    try {
      // Get all workers with a score (timestamp) older than the threshold.
      const deadWorkerIds = await this.#redis.zrangebyscore(workersKey, 0, timeoutThreshold);

      if (deadWorkerIds.length > 0) {
        this.#logger.warn({ workers: deadWorkerIds }, `Pruning ${deadWorkerIds.length} dead worker(s).`);
        // Remove the dead workers from the sorted set.
        await this.#redis.zrem(workersKey, ...deadWorkerIds);
      } else {
        this.#logger.debug('No dead workers found.');
      }
    } catch (error) {
      this.#logger.error({ err: error }, 'Error during dead worker pruning.');
    }
  }

  /**
   * Starts a periodic task to log cluster-wide metrics.
   * @private
   */
  #startMetricsLoop() {
    const intervalMs = this.#config.controller.metricsUpdateInterval * 1000;
    this.#logger.info({ interval: `${intervalMs}ms` }, 'Starting metrics aggregation loop.');
    this.#metricsInterval = setInterval(() => this.#logClusterMetrics(), intervalMs);
  }

  /**
   * Fetches and logs key metrics about the cluster's state.
   * @private
   */
  async #logClusterMetrics() {
    if (this.#isShuttingDown) return;

    try {
      const pipeline = this.#redis.pipeline();
      const workersKey = `${this.#redisKeyPrefix}workers:active`;
      const pendingQueueKey = `${this.#redisKeyPrefix}queue:pending`;
      const processingQueueKey = `${this.#redisKeyPrefix}queue:processing`;
      const completedCountKey = `${this.#redisKeyPrefix}stats:jobs:completed`;
      const failedCountKey = `${this.#redisKeyPrefix}stats:jobs:failed`;

      // Atomically fetch all metrics
      pipeline.zcard(workersKey);
      pipeline.zcard(pendingQueueKey);
      pipeline.scard(processingQueueKey);
      pipeline.get(completedCountKey);
      pipeline.get(failedCountKey);

      const results = await pipeline.exec();

      const [
        [, activeWorkers],
        [, pendingJobs],
        [, processingJobs],
        [, completedJobs],
        [, failedJobs],
      ] = results;

      const metrics = {
        activeWorkers: activeWorkers ?? 0,
        pendingJobs: pendingJobs ?? 0,
        processingJobs: processingJobs ?? 0,
        completedJobs: parseInt(completedJobs, 10) || 0,
        failedJobs: parseInt(failedJobs, 10) || 0,
      };

      this.#logger.info({ metrics }, 'Cluster status update.');
    } catch (error) {
      this.#logger.error({ err: error }, 'Failed to fetch and log cluster metrics.');
    }
  }
}

/**
 * Main execution function to create and run a Controller instance.
 * It also sets up graceful shutdown handling for process signals.
 */
export async function runController() {
  const controller = new Controller();

  // Graceful shutdown handlers
  const shutdownHandler = async (signal) => {
    getLogger().info(`Received ${signal}. Initiating graceful shutdown...`);
    await controller.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

  await controller.start();
}