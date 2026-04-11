/**
 * src/utils/logger.js
 *
 * Configures and exports a shared Pino logger instance for structured logging.
 *
 * This module sets up a singleton logger for the entire application. In development,
 * it uses `pino-pretty` for human-readable, colorized output. In production, it
 * defaults to standard JSON output, which is optimal for log aggregation and
 * analysis tools.
 *
 * The log level is configurable via the `LOG_LEVEL` environment variable, defaulting
 * to 'info'.
 */

import pino from 'pino';

// Determine the logging environment. Use 'development' if NODE_ENV is not set.
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Pino logger configuration options.
 *
 * @type {import('pino').LoggerOptions}
 */
const pinoOptions = {
  level: logLevel,
  // Base object to be included in all log messages.
  base: {
    pid: process.pid,
  },
  // Timestamp function to produce ISO 8601 format timestamps.
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  // In development, we use pino-pretty for better readability.
  // In production, we use standard JSON output for machine parsing.
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
};

/**
 * A shared, singleton Pino logger instance for the application.
 *
 * It provides structured, high-performance logging.
 *
 * @example
 * import logger from './utils/logger.js';
 * logger.info('Server started on port %d', port);
 * logger.error({ err }, 'An unexpected error occurred');
 *
 * @type {import('pino').Logger}
 */
const logger = pino(pinoOptions);

// Log the initial configuration to confirm settings on startup.
logger.info(
  {
    level: logger.level,
    environment: isProduction ? 'production' : 'development',
  },
  'Logger initialized'
);

export default logger;