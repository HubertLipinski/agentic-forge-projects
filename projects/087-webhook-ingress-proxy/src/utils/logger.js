import pino from 'pino';

/**
 * @fileoverview Initializes and exports a singleton Pino logger instance.
 * The logger's level can be configured via an environment variable.
 * In development, it uses `pino-pretty` for human-readable output.
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Pino logger options.
 * @see https://getpino.io/#/docs/api?id=options
 *
 * In production, we use standard JSON logging for performance and machine-readability.
 * In development, we use `pino-pretty` to make logs easier to read.
 */
const pinoOptions = {
  level: LOG_LEVEL,
  // Standard production settings
  ...(isProduction && {
    formatters: {
      // Ensure level is a string label, not a number
      level: (label) => ({ level: label }),
    },
    // Use a Unix timestamp in milliseconds
    timestamp: () => `,"time":${Date.now()}`,
  }),
  // Pretty-printing for development
  ...(!isProduction && {
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
 * A singleton Pino logger instance.
 * This instance is shared across the entire application.
 * Using a singleton pattern ensures consistent logging configuration and avoids
 * the overhead of creating multiple logger instances.
 *
 * @example
 * import logger from './utils/logger.js';
 * logger.info('Server is starting...');
 * logger.error({ err }, 'An unexpected error occurred.');
 */
const logger = pino(pinoOptions);

logger.info(
  {
    logLevel: LOG_LEVEL,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  'Logger initialized'
);

export default logger;