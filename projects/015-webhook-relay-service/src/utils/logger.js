import pino from 'pino';

/**
 * @fileoverview Configures and exports a singleton Pino logger instance.
 *
 * This module initializes a Pino logger with environment-aware settings.
 * In development, it uses a human-readable format. In production, it
 * defaults to structured JSON logging for better machine-parsability.
 * The log level is configurable via the `LOG_LEVEL` environment variable.
 */

/**
 * Determines the appropriate transport for Pino based on the environment.
 * In a 'development' environment, it uses 'pino-pretty' for human-readable logs.
 * In other environments (like 'production'), it returns undefined, causing Pino
 * to default to writing standard JSON logs to stdout.
 *
 * @returns {object | undefined} A Pino transport configuration object or undefined.
 */
const getTransport = () => {
  if (process.env.NODE_ENV === 'development') {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    };
  }
  return undefined;
};

/**
 * A singleton Pino logger instance.
 *
 * Configuration:
 * - `level`: The minimum log level to output. Defaults to 'info'.
 *   Can be overridden by the `LOG_LEVEL` environment variable.
 *   Valid levels: 'fatal', 'error', 'warn', 'info', 'debug', 'trace'.
 * - `timestamp`: Adds a Unix timestamp to each log entry.
 * - `transport`: Conditionally uses `pino-pretty` in development for better
 *   readability. In production, logs are standard JSON.
 *
 * The singleton pattern ensures that all parts of the application share the
 * same logger instance and configuration.
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.unixTime,
  transport: getTransport(),
});

export default logger;