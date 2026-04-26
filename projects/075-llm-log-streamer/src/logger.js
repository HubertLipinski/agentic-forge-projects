/**
 * @file src/logger.js
 * @description Centralized logging service that initializes and directs log events to the configured transports.
 *
 * This module acts as the single source of truth for logging throughout the application.
 * It initializes the configured log transports (e.g., console, file) and provides
 * a unified interface to write log messages. This decouples the application logic
 * from the specifics of how and where logs are stored, making the logging system
 * flexible and extensible. It also handles sanitizing log data to prevent leaking
 * sensitive information.
 */

import { getConfig } from './utils/config.js';
import { createTransports } from './transports/index.js';
import { maskData } from './utils/masker.js';

/**
 * @typedef {import('pino').Logger} PinoLogger
 */

/**
 * Singleton instance for the logger. This ensures that the logger is initialized
 * only once during the application's lifecycle.
 * @type {Logger | null}
 */
let loggerInstance = null;

/**
 * The Logger class orchestrates logging across multiple transports.
 * It holds references to all active transport instances (which are pino loggers)
 * and provides methods to dispatch log events to them.
 */
class Logger {
  /**
   * An array of initialized pino logger instances, each representing a transport.
   * @private
   * @type {PinoLogger[]}
   */
  transports = [];

  /**
   * The minimum log level configured for the application.
   * @private
   * @type {string}
   */
  logLevel = 'info';

  /**
   * Initializes the Logger by creating transport instances based on configuration.
   * @param {object} config - The application configuration object.
   */
  constructor(config) {
    if (!config) {
      throw new Error('Logger requires a valid configuration object.');
    }
    this.logLevel = config.logLevel || 'info';
    try {
      this.transports = createTransports(config);
    } catch (error) {
      // Use console.error as a fallback if transport creation fails.
      console.error(`[Logger Init] Fatal error during transport creation: ${error.message}`);
      // Re-throw to prevent the application from starting in a non-functional state.
      throw error;
    }
  }

  /**
   * Dispatches a log event to all configured transports.
   * This is the core method that funnels log messages to the underlying pino instances.
   * It handles data masking before logging.
   *
   * @private
   * @param {string} level - The log level (e.g., 'info', 'error').
   * @param {string} message - The primary log message.
   * @param {object} [data={}] - An object containing additional structured data to log.
   */
  _dispatch(level, message, data = {}) {
    // Prevent logging if no transports are available.
    if (this.transports.length === 0) {
      return;
    }

    // Sanitize the data to prevent logging sensitive information.
    // The maskData function returns a deep-cloned, safe-to-log object.
    const sanitizedData = maskData(data);

    // Iterate over each transport and call its corresponding log method.
    for (const transport of this.transports) {
      // pino log methods have the signature: logger[level](data, message)
      // This ensures the structured data is the primary object and the message
      // is correctly assigned to the `msg` property in the final JSON log.
      if (typeof transport[level] === 'function') {
        transport[level](sanitizedData, message);
      }
    }
  }

  /**
   * Logs a message at the 'info' level.
   * Used for general operational events, such as server startup or successful requests.
   * @param {string} message - The log message.
   * @param {object} [data={}] - Additional structured data.
   */
  info(message, data = {}) {
    this._dispatch('info', message, data);
  }

  /**
   * Logs a message at the 'warn' level.
   * Used for unexpected but recoverable events that do not cause the application to fail.
   * @param {string} message - The log message.
   * @param {object} [data={}] - Additional structured data.
   */
  warn(message, data = {}) {
    this._dispatch('warn', message, data);
  }

  /**
   * Logs a message at the 'error' level.
   * Used for errors that disrupt a specific operation but do not crash the application.
   * @param {string} message - The log message.
   * @param {object} [data={}] - Additional structured data, often including error details.
   */
  error(message, data = {}) {
    this._dispatch('error', message, data);
  }

  /**
   * Logs a message at the 'debug' level.
   * Used for detailed diagnostic information useful during development and troubleshooting.
   * @param {string} message - The log message.
   * @param {object} [data={}] - Additional structured data.
   */
  debug(message, data = {}) {
    this._dispatch('debug', message, data);
  }

  /**
   * Logs a message at the 'fatal' level.
   * Used for critical errors that will likely cause the application to terminate.
   * @param {string} message - The log message.
   * @param {object} [data={}] - Additional structured data.
   */
  fatal(message, data = {}) {
    this._dispatch('fatal', message, data);
  }

  /**
   * Flushes any buffered logs in the transports.
   * This is crucial for ensuring all logs are written before the application exits,
   * especially during a graceful shutdown.
   */
  flush() {
    for (const transport of this.transports) {
      if (typeof transport.flush === 'function') {
        try {
          transport.flush();
        } catch (error) {
          console.error(`[Logger] Error flushing transport: ${error.message}`);
        }
      }
    }
  }
}

/**
 * Returns the singleton logger instance for the application.
 * If the instance doesn't exist, it initializes it using the global configuration.
 * This ensures a single, consistent logger is used throughout the application.
 *
 * @returns {Logger} The singleton Logger instance.
 */
export function getLogger() {
  if (!loggerInstance) {
    try {
      const config = getConfig();
      loggerInstance = new Logger(config);
    } catch (error) {
      // This is a critical failure, as the application cannot run without a logger.
      console.error(`[FATAL] Failed to initialize the logger: ${error.message}`);
      console.error('The application will now exit.');
      process.exit(1);
    }
  }
  return loggerInstance;
}