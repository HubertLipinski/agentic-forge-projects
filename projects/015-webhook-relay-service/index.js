/**
 * @fileoverview Main entry point for the Webhook Relay Service.
 *
 * This script orchestrates the startup of the application. It performs the
 * following critical steps in order:
 *
 * 1.  **Environment Loading**: Loads environment variables from a `.env` file
 *     using `dotenv`. This allows for flexible configuration of port, log level,
 *     and other settings without modifying the code.
 *
 * 2.  **Configuration Initialization**: Asynchronously loads and validates the
 *     `routes.json` file. This is a crucial step, as the service cannot operate
 *     without a valid routing configuration. The application will exit if the
 *     initial configuration is missing or invalid.
 *
 * 3.  **Server Instantiation**: Builds the Fastify server instance by calling
 *     `buildServer` from `src/app.js`. This function encapsulates all server-
 *     specific setup, including plugins, routes, and graceful shutdown logic.
 *
 * 4.  **Server Start**: Binds the server to the configured host and port, making
 *     the service available to receive webhook requests.
 *
 * Proper error handling is implemented at each stage to ensure that failures
 * during startup are logged clearly and cause the process to exit, preventing
 * the service from running in a misconfigured or non-functional state.
 */

import 'dotenv/config';
import logger from './src/utils/logger.js';
import { initializeConfig } from './src/utils/config-loader.js';
import { buildServer } from './src/app.js';

// --- Constants ---
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '127.0.0.1';

/**
 * The main asynchronous function that starts the application.
 * It handles the sequential initialization of components and starts the server.
 */
async function main() {
  try {
    // 1. Initialize the routing configuration. This must complete successfully
    // before the server can start, as the server depends on this configuration
    // to know how to route incoming requests.
    logger.info('Initializing application...');
    await initializeConfig();

    // 2. Build the Fastify server instance. This sets up the server, logger,
    // plugins, routes, and graceful shutdown handlers.
    const server = buildServer();

    // 3. Start the server and listen for incoming connections.
    await server.listen({ port: PORT, host: HOST });

    // The server logger will automatically print the listening address.
    // An additional log here confirms the application is fully ready.
    logger.info('Webhook Relay Service is now running and ready to accept requests.');

  } catch (error) {
    // If any part of the startup process fails (e.g., invalid config, port in use),
    // log the fatal error and exit the process with a non-zero status code
    // to indicate failure. This is crucial for process managers and container
    // orchestration systems like Docker or Kubernetes.
    logger.fatal({ err: error }, `Application failed to start: ${error.message}`);
    process.exit(1);
  }
}

// Execute the main function to start the application.
main();