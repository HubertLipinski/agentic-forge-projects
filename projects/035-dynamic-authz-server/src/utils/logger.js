import pino from 'pino';
import { env } from 'node:process';

// Default configuration for the logger.
// These values can be overridden by environment variables or a config file.
const defaults = {
  logLevel: 'info',
  prettyPrint: false,
};

// Determine if we are in a production environment.
// The `NODE_ENV` environment variable is the standard way to specify this.
const isProduction = env.NODE_ENV === 'production';

/**
 * Initializes and configures the Pino logger instance.
 *
 * This function creates a logger with settings that adapt to the environment.
 * In development, it enables pretty-printing for better readability.
 * In production, it outputs structured JSON logs for efficient processing by log management systems.
 * The log level is configurable via the `LOG_LEVEL` environment variable.
 *
 * @param {object} [config={}] - Configuration options for the logger.
 * @param {string} [config.logLevel] - The minimum level of logs to output (e.g., 'info', 'debug', 'warn', 'error').
 * @returns {import('pino').Logger} A configured Pino logger instance.
 */
function createLogger(config = {}) {
  const logLevel = env.LOG_LEVEL || config.logLevel || defaults.logLevel;

  // In a non-production environment (like 'development' or 'test'),
  // we enable pretty-printing for human-readable logs if pino-pretty is installed.
  // The `dev` script in package.json pipes the output to `pino-pretty`.
  // This setup ensures that structured logs are still produced, but can be
  // beautified during development.
  const transport = isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      };

  const logger = pino({
    level: logLevel,
    // Standard Pino configuration for production-grade logging.
    // Includes timestamp, level, pid, and hostname in each log entry.
    // In production, these structured logs are ideal for ingestion by
    // services like Datadog, Splunk, or the ELK stack.
    ...(transport && { transport }),
  });

  return logger;
}

// Create a singleton logger instance to be used throughout the application.
// This ensures consistent logging configuration and avoids the overhead of
// re-initializing the logger in different modules.
const logger = createLogger();

export default logger;
export { createLogger };