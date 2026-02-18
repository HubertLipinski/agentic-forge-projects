import Redis from 'ioredis';
import pino from 'pino';

// Initialize a logger for this module.
// In a real application, this would likely be part of a shared logging utility.
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
}).child({ module: 'redis-config' });

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  logger.error(
    'REDIS_URL environment variable is not set. The application cannot connect to Redis and will exit.'
  );
  // Using a non-zero exit code indicates failure.
  process.exit(1);
}

/**
 * Configuration options for the ioredis client.
 * @see https://github.com/luin/ioredis/blob/main/API.md#new-redisport-host-options
 */
const redisOptions = {
  // The maximum number of retries per command.
  // -1 means unlimited retries.
  maxRetriesPerRequest: 10,
  // Time in ms to wait before reconnecting.
  // This uses an exponential backoff strategy.
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000); // max 2 seconds
    logger.warn(`Redis connection lost. Retrying in ${delay}ms... (Attempt ${times})`);
    return delay;
  },
  // Enable lazy connect to prevent the client from connecting until the first command is issued.
  // This is useful in scenarios where the Redis connection is not immediately needed.
  lazyConnect: true,
  // Set a name for the connection to make it identifiable in Redis client list.
  connectionName: `job-queue-manager-${process.env.NODE_ENV || 'development'}`,
  // Throws an error when the connection is lost and all retry attempts have failed.
  // This is crucial for preventing the application from running in a broken state.
  enableOfflineQueue: false,
};

let redisClient;

try {
  // Create a new Redis client instance.
  // The connection string format `redis[s]://[[username][:password]@][host][:port][/db-number]` is parsed automatically.
  redisClient = new Redis(REDIS_URL, redisOptions);

  // --- Event Listeners for Connection Health ---

  redisClient.on('connect', () => {
    logger.info('Successfully connected to Redis server.');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client is ready to process commands.');
  });

  redisClient.on('error', (err) => {
    // This event is fired when an error occurs during the connection
    // or when a command fails. We log it but don't exit, as the
    // retryStrategy will handle reconnection attempts.
    logger.error({ err }, 'An error occurred with the Redis client.');
  });

  redisClient.on('close', () => {
    logger.warn('Connection to Redis server has been closed.');
  });

  redisClient.on('reconnecting', () => {
    // This is logged by our custom retryStrategy, so we can keep this minimal.
    logger.info('Reconnecting to Redis server...');
  });

  redisClient.on('end', () => {
    // This event is fired when the connection is terminated and no more retries will be made.
    logger.fatal(
      'Redis connection ended. No more retries will be made. The application might be in a broken state.'
    );
  });

} catch (err) {
  logger.fatal({ err }, 'Failed to initialize Redis client. This is a critical error.');
  process.exit(1);
}

/**
 * A shared, pre-configured ioredis client instance.
 * It's configured to connect to the Redis server specified by the
 * REDIS_URL environment variable and includes robust retry logic.
 *
 * @type {import('ioredis').Redis}
 */
export default redisClient;