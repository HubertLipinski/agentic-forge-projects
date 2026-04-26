/**
 * @file src/index.js
 * @description Main application entry point. Initializes configuration, logger, and starts the proxy server.
 *
 * This file orchestrates the startup sequence of the LLM Log Streamer. It brings
 * together the configuration, logging, and server modules to launch the application.
 * It also sets up graceful shutdown handling to ensure a clean exit.
 *
 * The `start` function is the core of this module, designed to be callable
 * both from the CLI (`bin/cli.js`) and potentially programmatically if this
 * project were to be used as a library.
 */

import { getConfig } from './utils/config.js';
import { getLogger } from './logger.js';
import { startServer, setupGracefulShutdown } from './server.js';

/**
 * Initializes and starts the LLM Log Streamer application.
 *
 * This function performs the following steps in order:
 * 1. Parses and validates the application configuration from command-line arguments
 *    and environment variables.
 * 2. Initializes the centralized logger with the configured transports and log level.
 * 3. Starts the HTTP proxy server, which begins listening for incoming requests.
 * 4. Sets up signal handlers for graceful shutdown (SIGINT, SIGTERM), ensuring
 *    that pending logs are flushed and connections are closed cleanly.
 *
 * The function is designed to be robust, with comprehensive error handling at each
 * stage of the startup process. If any critical step fails, it logs a fatal
 * error and terminates the process with a non-zero exit code.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the server is running,
 *          or rejects if startup fails. In practice, on successful startup,
 *          the process will continue running until a shutdown signal is received.
 */
export async function start() {
  let logger;

  try {
    // Step 1: Initialize configuration.
    // getConfig() is a singleton that parses config on its first call.
    // We call it here to ensure it's available for all other modules.
    const config = getConfig();

    // Step 2: Initialize the logger.
    // getLogger() is also a singleton. It depends on the config being ready.
    // We capture the instance to use it for startup logging.
    logger = getLogger();
    logger.debug('Configuration and logger initialized successfully.');

    // Step 3: Set up graceful shutdown handlers.
    // This should be done before starting the server to ensure we can catch
    // shutdown signals from the very beginning.
    setupGracefulShutdown();
    logger.debug('Graceful shutdown handlers have been set up.');

    // Step 4: Start the HTTP proxy server.
    // The startServer function returns a promise that resolves when the server
    // is successfully listening or rejects on error (e.g., port in use).
    await startServer(config);

    // At this point, the server is running and listening for requests.
    // The application will now run indefinitely until a shutdown signal is received.
    // The `setupGracefulShutdown` handlers will manage the exit process.
  } catch (error) {
    // This is the top-level catch block for the entire startup sequence.
    // If an error occurs in config, logging, or server startup, it will be caught here.

    const errorMessage = `[FATAL] Application failed to start: ${error.message}`;

    if (logger) {
      // If the logger was initialized, use it to report the fatal error.
      logger.fatal(errorMessage, {
        error: {
          name: error.name,
          stack: error.stack,
          code: error.code,
        },
      });
      // Ensure the fatal log is written before exiting.
      logger.flush();
    } else {
      // If the logger failed to initialize, fall back to console.error.
      console.error(errorMessage);
      if (error.stack) {
        console.error(error.stack);
      }
    }

    // Exit the process with a failure code. This is crucial for process managers
    // and CI/CD pipelines to know that the application failed to launch.
    process.exit(1);
  }
}