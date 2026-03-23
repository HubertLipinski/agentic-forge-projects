import pino from 'pino';
import env from '../config/env.js';

/**
 * @fileoverview Configures a Pino logger for structured logging.
 *
 * This module sets up a singleton logger instance with different configurations
 * for development and production environments.
 *
 * In development (NODE_ENV !== 'production'):
 * - Logs are pretty-printed to the console for readability using `pino-pretty`.
 * - The log level is determined by the `LOG_LEVEL` environment variable, defaulting to 'info'.
 *
 * In production (NODE_ENV === 'production'):
 * - Logs are formatted as JSON for efficient parsing by log management systems.
 * - The log level is also determined by `LOG_LEVEL`, defaulting to 'info'.
 *
 * The logger instance is exported as a singleton, ensuring consistent logging
 * configuration across the entire application.
 */

/**
 * Creates and configures a Pino logger instance.
 *
 * This function determines the appropriate transport and options based on the
 * `NODE_ENV` environment variable. It defaults to a production-friendly JSON
 * format unless `NODE_ENV` is explicitly set to something other than 'production'.
 *
 * @returns {pino.Logger} A configured Pino logger instance.
 */
function createLogger() {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = env.LOG_LEVEL || 'info';

  const pinoOptions = {
    level: logLevel,
  };

  let transport;

  if (isProduction) {
    // In production, log directly to stdout as JSON.
    // This is standard practice for containerized environments where logs
    // are collected from stdout by a logging agent.
    transport = pino.transport({
      target: 'pino/file', // Default transport for JSON output to stdout
      options: {}, // No special options needed
    });
  } else {
    // In development, use pino-pretty for human-readable output.
    transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true, // Add colors to the output
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l', // Human-readable timestamp
        ignore: 'pid,hostname', // Hide process ID and hostname for cleaner logs
      },
    });
  }

  return pino(pinoOptions, transport);
}

/**
 * A singleton instance of the configured Pino logger.
 * Import this instance into any module that needs to perform logging.
 *
 * @example
 * import logger from './utils/logger.js';
 * logger.info('Bot is starting up...');
 * logger.error({ err: new Error('Something went wrong') }, 'An error occurred');
 */
const logger = createLogger();

export default logger;