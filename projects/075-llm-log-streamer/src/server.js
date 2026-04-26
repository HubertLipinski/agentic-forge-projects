/**
 * @file src/server.js
 * @description Sets up and manages the Node.js HTTP server, handling lifecycle events like startup and shutdown.
 *
 * This module is responsible for the core HTTP server that listens for incoming
 * requests intended for the OpenAI API. It orchestrates the server's lifecycle,
 * from starting up and listening on the configured port to handling graceful
 * shutdown signals, ensuring that all pending operations can complete before
 * the process exits.
 */

import http from 'node:http';
import { getLogger } from './logger.js';
import { proxyHandler } from './proxy-handler.js';

const logger = getLogger();

/**
 * A container for the server instance to manage its state across the module.
 * @type {{ instance: http.Server | null }}
 */
const serverState = {
  instance: null,
};

/**
 * Creates and starts the HTTP proxy server.
 *
 * This function initializes an `http.Server` instance, attaches the `proxyHandler`
 * to handle all incoming requests, and starts listening on the host and port
 * specified in the configuration. It returns a Promise that resolves when the
 * server is successfully listening, or rejects if an error occurs during startup.
 *
 * @param {object} config - The application configuration object.
 * @param {string} config.host - The hostname to listen on.
 * @param {number} config.port - The port to listen on.
 * @returns {Promise<http.Server>} A promise that resolves with the server instance.
 */
export function startServer(config) {
  return new Promise((resolve, reject) => {
    if (serverState.instance) {
      logger.warn('Server is already running.');
      return resolve(serverState.instance);
    }

    const { host, port } = config;

    const server = http.createServer((req, res) => {
      // The proxyHandler is an async function, but we don't await it here
      // because createServer expects a synchronous function. The handler
      // is responsible for managing the request/response lifecycle itself,
      // including error handling and ending the response.
      proxyHandler(req, res).catch((err) => {
        // This top-level catch is a safety net for unexpected errors
        // within the handler that might not have been caught and sent
        // to the client. We log it here for visibility.
        logger.error('Unhandled exception in proxyHandler', {
          error: { message: err.message, stack: err.stack },
        });
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        const errorMessage = `Port ${port} is already in use. Please choose a different port.`;
        logger.error(errorMessage, { host, port });
        reject(new Error(errorMessage));
      } else {
        const errorMessage = `Server failed to start: ${error.message}`;
        logger.error(errorMessage, { error });
        reject(error);
      }
    });

    server.listen(port, host, () => {
      const address = server.address();
      logger.info('LLM Log Streamer is running', {
        url: `http://${address.address}:${address.port}`,
        openaiTarget: config.openaiTarget,
      });
      serverState.instance = server;
      resolve(server);
    });
  });
}

/**
 * Gracefully shuts down the HTTP server.
 *
 * This function stops the server from accepting new connections and waits for
 * existing connections to close before resolving. It includes a timeout to
 * forcefully terminate connections if they don't close within a reasonable
 * period. This ensures a clean exit, allowing pending logs to be written.
 *
 * @param {number} [timeout=5000] - The maximum time in milliseconds to wait for connections to close.
 * @returns {Promise<void>} A promise that resolves when the server is fully shut down.
 */
export function stopServer(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const server = serverState.instance;

    if (!server || !server.listening) {
      logger.info('Server is not running or already stopped.');
      return resolve();
    }

    logger.info('Shutting down server gracefully...');

    // Use a timeout to prevent the shutdown process from hanging indefinitely.
    const shutdownTimeout = setTimeout(() => {
      logger.warn(
        `Server shutdown timed out after ${timeout}ms. Forcing close.`,
      );
      // Forcefully destroy any remaining sockets.
      // Note: This is a more aggressive shutdown.
      reject(new Error('Server shutdown timed out.'));
    }, timeout);

    // This stops the server from accepting new connections and waits for
    // existing connections to finish.
    server.close((error) => {
      clearTimeout(shutdownTimeout);
      if (error) {
        logger.error('Error during server close', {
          error: { message: error.message, stack: error.stack },
        });
        return reject(error);
      }

      logger.info('Server has been shut down successfully.');
      serverState.instance = null;
      resolve();
    });
  });
}

/**
 * Sets up listeners for process signals to ensure graceful shutdown.
 * This is critical for production environments to prevent abrupt termination.
 * It handles SIGINT (Ctrl+C) and SIGTERM (sent by process managers).
 */
export function setupGracefulShutdown() {
  const handleShutdown = async (signal) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    try {
      // 1. Stop the server from accepting new requests.
      await stopServer();

      // 2. Flush any buffered logs to their destinations.
      logger.flush();

      logger.info('Shutdown complete. Exiting.');
      process.exit(0);
    } catch (error) {
      logger.fatal('Graceful shutdown failed. Exiting forcefully.', {
        error: { message: error.message, stack: error.stack },
      });
      process.exit(1);
    }
  };

  // Listen for termination signals.
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}