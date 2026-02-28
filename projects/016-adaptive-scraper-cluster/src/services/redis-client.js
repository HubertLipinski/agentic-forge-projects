import Redis from 'ioredis';
import { getLogger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';

/**
 * @fileoverview Manages a singleton Redis client instance for the application.
 *
 * This module ensures that only one Redis connection is established and shared
 * across all components of the application (controller and workers). It handles
 * connection logic, event logging, and provides a graceful shutdown mechanism.
 * The singleton pattern prevents resource exhaustion from multiple redundant
 * connections and centralizes Redis configuration and state management.
 */

/**
 * The singleton Redis client instance.
 * @type {import('ioredis').Redis | null}
 */
let redisClient = null;

/**
 * A promise that resolves when the initial Redis connection is established.
 * This is used to queue operations until the client is ready, preventing
 * "Connection is not ready" errors on application startup.
 * @type {Promise<void> | null}
 */
let connectionPromise = null;

/**
 * Creates and returns a singleton Redis client instance.
 *
 * On the first call, it initializes a new `ioredis` client using the application's
 * configuration. It sets up event listeners to log connection status changes
 * (connect, error, reconnecting) for better observability. Subsequent calls
 * will return the existing instance.
 *
 * @returns {{client: import('ioredis').Redis, connectionPromise: Promise<void>}}
 *          An object containing the client instance and a promise that resolves
 *          on successful connection.
 * @throws {Error} If the Redis configuration is missing.
 */
function createClient() {
  if (redisClient) {
    return { client: redisClient, connectionPromise };
  }

  const logger = getLogger();
  const config = getConfig();

  if (!config.redis) {
    logger.fatal('Redis configuration is missing. Cannot initialize Redis client.');
    throw new Error('Redis configuration is missing.');
  }

  logger.info({ redis: { host: config.redis.host, port: config.redis.port, db: config.redis.db } }, 'Initializing Redis client...');

  // Configure ioredis with robust reconnection logic.
  // `maxRetriesPerRequest: null` is crucial for commands issued while disconnected;
  // it ensures they are retried indefinitely until the connection is back,
  -  // preventing data loss for critical operations like job queueing.
  const clientOptions = {
    ...config.redis,
    // Lazy connect avoids an immediate connection attempt on instantiation.
    // The first command will trigger the connection.
    lazyConnect: true,
    // Prevent commands from failing if the connection is temporarily down.
    maxRetriesPerRequest: null,
    // Show a friendlier error message for connection issues.
    showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
    // Enable offline queueing, but rely on maxRetriesPerRequest for robustness.
    enableOfflineQueue: true,
  };

  redisClient = new Redis(clientOptions);

  // Create a promise that resolves once the 'connect' event is fired.
  // This allows other parts of the application to wait for the connection
  // to be ready before executing commands.
  connectionPromise = new Promise((resolve, reject) => {
    redisClient.once('connect', () => {
      logger.info('Successfully connected to Redis.');
      resolve();
    });

    redisClient.once('error', (err) => {
      // This handles initial connection errors.
      logger.error({ err }, 'Initial Redis connection failed.');
      reject(err);
    });
  });

  // Set up long-term event listeners for monitoring.
  redisClient.on('error', (err) => {
    // This listener will catch errors that occur after the initial connection.
    logger.error({ err }, 'Redis client error occurred.');
  });

  redisClient.on('reconnecting', (delay) => {
    logger.warn({ delay }, `Reconnecting to Redis in ${delay}ms...`);
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed.');
  });

  return { client: redisClient, connectionPromise };
}

/**
 * Retrieves the singleton Redis client instance.
 *
 * It ensures the client is initialized before being returned. If the client
 * has not been created yet, it calls `createClient()` first.
 *
 * @returns {import('ioredis').Redis} The singleton ioredis client.
 */
export function getRedisClient() {
  if (!redisClient) {
    return createClient().client;
  }
  return redisClient;
}

/**
 * Returns a promise that resolves when the Redis client is connected.
 *
 * This utility is essential for startup sequences where operations depend on
 * a ready Redis connection. It prevents race conditions and command failures.
 *
 * @example
 * await ensureRedisConnected();
 * // It's now safe to execute Redis commands.
 *
 * @returns {Promise<void>} A promise that resolves on connection or rejects on failure.
 */
export async function ensureRedisConnected() {
  if (!connectionPromise) {
    // This case handles if getRedisClient() hasn't been called yet.
    // It triggers the connection process.
    createClient();
  }
  // Immediately connect if in a lazy state.
  if (redisClient.status === 'wait') {
    try {
      await redisClient.connect();
    } catch (err) {
      // The connectionPromise will also reject via its own error handler,
      // but we catch here to prevent an unhandled rejection from `connect()`.
      getLogger().fatal({ err }, 'Failed to establish initial Redis connection.');
      // Propagate the failure.
      throw err;
    }
  }
  return connectionPromise;
}

/**
 * Gracefully disconnects the Redis client.
 *
 * This function should be called during application shutdown to ensure
 * that the connection is closed cleanly, preventing hanging processes.
 * The `quit()` command waits for pending replies before closing.
 *
 * @returns {Promise<void>} A promise that resolves when disconnection is complete.
 */
export async function disconnectRedis() {
  const logger = getLogger();
  if (redisClient && redisClient.status !== 'end') {
    logger.info('Disconnecting from Redis...');
    try {
      // `quit` is graceful, waiting for pending commands to finish.
      await redisClient.quit();
      logger.info('Redis client disconnected successfully.');
      redisClient = null;
      connectionPromise = null;
    } catch (err) {
      logger.error({ err }, 'Error during Redis disconnection.');
      // Forcefully disconnect if quit fails.
      redisClient.disconnect();
    }
  } else {
    logger.debug('Redis client already disconnected or not initialized.');
  }
}