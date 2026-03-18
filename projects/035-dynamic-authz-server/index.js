/**
 * @file index.js
 * @description The application entry point. It loads configuration, initializes the server,
 * and starts listening for incoming connections. This script orchestrates the startup
 * sequence of the Dynamic Authorization Server.
 */

import { env, exit } from 'node:process';
import buildServer from './src/server.js';
import logger from './src/utils/logger.js';
import { policyStore } from './src/policy/store.js';
import memoryStore from './src/storage/memory-store.js';

// --- Configuration Loading ---
// Load default configuration. In a more complex app, this could involve a library
// like 'convict' or 'nconf' to merge defaults, environment variables, and files.
const config = {
  port: env.PORT || 3000,
  host: env.HOST || '127.0.0.1',
};

/**
 * The main asynchronous function that starts the application.
 * It handles the entire startup lifecycle:
 * 1. Initializes the storage backend.
 * 2. Initializes the policy store and performs the critical initial policy load.
 * 3. Builds the Fastify server instance.
 * 4. Starts the server to listen for incoming HTTP requests.
 * It also includes graceful shutdown logic for SIGINT and SIGTERM signals.
 *
 * @param {object} appConfig - The application configuration object.
 * @param {number} appConfig.port - The port number to listen on.
 * @param {string} appConfig.host - The host address to bind to.
 */
async function start(appConfig) {
  let server;

  try {
    logger.info('Starting Dynamic Authorization Server...');

    // 1. Initialize the storage layer.
    // This establishes a connection to the backend (in this case, just setting up memory).
    await memoryStore.connect();

    // 2. Initialize the policy store.
    // This performs the crucial first load of all policies into the in-memory cache.
    // If this fails, the server cannot function, so we let the error propagate and stop startup.
    await policyStore.initialize();

    // 3. Build the Fastify server instance.
    // This composes all routes, plugins, and hooks.
    server = buildServer({ logger });

    // 4. Start the server.
    // The server begins listening for HTTP requests on the configured host and port.
    await server.listen({ port: appConfig.port, host: appConfig.host });

    // Log a final success message after the server is fully ready.
    logger.info(`Server ready and listening at http://${appConfig.host}:${appConfig.port}`);
  } catch (err) {
    // If any part of the startup sequence fails, log a fatal error and exit.
    // This is critical because a partially started server can be misleading and dangerous.
    logger.fatal({ err }, 'Server startup failed');
    await shutdown(server, 1); // Exit with a non-zero code to indicate failure.
  }

  // --- Graceful Shutdown Handling ---
  // Register handlers for process termination signals. This ensures that we can
  // clean up resources (like database connections) before the process exits.
  const signals = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      await shutdown(server, 0);
    });
  }
}

/**
 * Performs a graceful shutdown of the application.
 * It closes the server to stop accepting new requests, disconnects from the storage
 * backend, and then exits the process.
 *
 * @param {import('fastify').FastifyInstance | undefined} server - The Fastify server instance.
 * @param {number} exitCode - The process exit code (0 for success, 1 for error).
 */
async function shutdown(server, exitCode) {
  try {
    if (server) {
      // Stop the server from accepting new connections.
      await server.close();
      logger.info('HTTP server closed.');
    }

    // Disconnect from the storage backend.
    await memoryStore.disconnect();
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown.');
    exitCode = 1; // Force an error exit code if shutdown fails.
  } finally {
    logger.info(`Shutdown complete. Exiting with code ${exitCode}.`);
    exit(exitCode);
  }
}

// --- Application Entry ---
// Unhandled promise rejections are a common source of bugs. This handler ensures
// they are logged and the process exits, preventing an unknown state.
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled Rejection at Promise. Crashing application.');
  // In a real production environment, this might trigger a more complex
  // recovery or alerting mechanism before exiting.
  shutdown(undefined, 1);
});

// Start the application by calling the main `start` function with the loaded config.
start(config);