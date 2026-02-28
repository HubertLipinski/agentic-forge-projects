import pino from 'pino';
import { pinoPretty } from 'pino-pretty';
import { hostname } from 'node:os';

/**
 * @typedef {object} LoggerOptions
 * @property {string} [level='info'] - The minimum log level to output.
 * @property {boolean} [pretty=false] - Whether to format logs in a human-readable way.
 * @property {object} [base={}] - Base properties to include in every log message.
 * @property {string} [name='AdaptiveScraperCluster'] - The name of the logger.
 */

/**
 * Singleton instance of the logger.
 * This ensures that all parts of the application use the same logger instance,
 * preventing multiple initializations and inconsistent logging configurations.
 * @type {import('pino').Logger | null}
 */
let loggerInstance = null;

/**
 * Creates and configures a Pino logger instance.
 *
 * This factory function initializes a structured JSON logger with configurable
 * levels and formatting. It's designed to be a singleton to ensure consistent
 * logging throughout the application.
 *
 * In development environments (or when `pretty` is true), it uses `pino-pretty`
 * for human-readable output. In production, it defaults to efficient,
 * machine-parseable JSON logs.
 *
 * @param {LoggerOptions} [options={}] - Configuration options for the logger.
 * @returns {import('pino').Logger} A configured Pino logger instance.
 */
function createLogger({
  level = 'info',
  pretty = false,
  base = {},
  name = 'AdaptiveScraperCluster',
} = {}) {
  if (loggerInstance) {
    // Return the existing instance if it has already been created.
    // This prevents re-configuration during the application's lifecycle.
    return loggerInstance;
  }

  const defaultBase = {
    name,
    pid: process.pid,
    hostname: hostname(),
  };

  const pinoOptions = {
    level,
    base: { ...defaultBase, ...base },
  };

  let destination;
  if (pretty) {
    // Use pino-pretty for development-friendly, colorized output.
    destination = pinoPretty({
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
      ignore: 'pid,hostname,name', // These are often redundant in dev.
      messageFormat: '{name}::{if-is-node-type}{nodeType}::{end}{if-is-job-id}{jobId}::{end} {msg}',
    });
  } else {
    // Use the default stdout destination for structured JSON logging in production.
    destination = pino.destination(1); // 1 = stdout
  }

  loggerInstance = pino(pinoOptions, destination);

  // Gracefully handle process exit signals to ensure all buffered logs are flushed.
  // This is crucial for capturing logs right before a crash or shutdown.
  const finalLogger = pino.final(loggerInstance);
  process.on('beforeExit', () => finalLogger.flush());
  process.on('exit', () => finalLogger.flush());
  // For signals that terminate the process, we must flush synchronously.
  process.on('SIGINT', () => {
    finalLogger.flushSync();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    finalLogger.flushSync();
    process.exit(0);
  });
  process.on('uncaughtException', (err) => {
    finalLogger.fatal(err, 'Uncaught exception');
    finalLogger.flushSync();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    finalLogger.fatal({ reason }, 'Unhandled promise rejection');
    finalLogger.flushSync();
    process.exit(1);
  });


  return loggerInstance;
}

/**
 * Retrieves the singleton logger instance.
 *
 * If the logger has not been initialized yet, this function will throw an error.
 * This enforces a pattern where the logger must be explicitly created with a
 * configuration (e.g., in the main application entry point) before it can be used.
 *
 * @throws {Error} If the logger has not been initialized via `createLogger`.
 * @returns {import('pino').Logger} The singleton logger instance.
 */
function getLogger() {
  if (!loggerInstance) {
    throw new Error(
      'Logger not initialized. Please call createLogger() in your application entry point.',
    );
  }
  return loggerInstance;
}

export { createLogger, getLogger };