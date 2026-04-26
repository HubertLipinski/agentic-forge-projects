/**
 * @file src/transports/console.js
 * @description A log transport that formats and writes log events to the console using Pino.
 *
 * This module provides a factory function to create a Pino logger instance
 * specifically configured for console output. It supports both structured JSON
 * logging (for production/machine-readability) and pretty-printed, human-readable
 * output (for development), based on the application's configuration.
 */

import pino from 'pino';
import pinoPretty from 'pino-pretty';

/**
 * Creates and configures a Pino logger instance for console output.
 *
 * This factory function sets up a logger that can either output structured
 * JSON logs or human-readable, colorized logs based on the `logPretty`
 * configuration option. This flexibility is crucial for balancing development
 * experience with production-grade logging practices.
 *
 * @param {object} config - The application configuration object.
 * @param {string} config.logLevel - The minimum level of logs to process (e.g., 'info', 'debug').
 * @param {boolean} config.logPretty - If true, enables pretty-printing for development.
 * @returns {import('pino').Logger} A configured Pino logger instance.
 * @throws {Error} If the configuration object is invalid or missing required properties.
 */
export function createConsoleTransport(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid configuration object provided to createConsoleTransport.');
  }

  const { logLevel = 'info', logPretty = false } = config;

  const pinoOptions = {
    level: logLevel,
    // Base object can be used to add static properties to all logs.
    // For this project, we keep it minimal as dynamic data is added per-log.
    base: {
      // pid: process.pid, // Pino adds this by default
      // hostname: os.hostname(), // Pino adds this by default
    },
    // Timestamp is enabled by default, which is what we want.
    // Format can be customized if needed, e.g., timestamp: () => `,"time":"${new Date().toISOString()}"`
  };

  let destination;

  if (logPretty) {
    // For development: use pino-pretty for human-readable, colorized output.
    // This is piped to stdout, making it easier to debug during development.
    try {
      const prettyStream = pinoPretty({
        colorize: true,
        sync: true, // Use synchronous flushing for pretty print, as it's for development.
        ignore: 'pid,hostname', // Clean up the output by removing redundant fields.
        messageFormat: '{msg} [id:{reqId}]', // Customize the message line format.
      });
      destination = pino.destination({ dest: prettyStream.stdout, sync: true });
    } catch (error) {
      // Fallback to default pino destination if pino-pretty fails.
      console.error('Failed to initialize pino-pretty, falling back to default console logger.', error);
      // Pino's default destination is process.stdout.
      destination = pino.destination({ sync: true });
    }
  } else {
    // For production: use the default high-performance, non-blocking,
    // structured (JSON) logger. This is ideal for log aggregation systems.
    // pino.destination() with default options is optimized for this.
    destination = pino.destination({ sync: false }); // Use async writing in production.
  }

  // The final logger instance combines the options and the chosen destination.
  const logger = pino(pinoOptions, destination);

  return logger;
}