/**
 * @fileoverview Main Fastify application setup.
 *
 * This file is responsible for creating and configuring the Fastify server instance.
 * It orchestrates the entire application by:
 * - Initializing the server with a custom logger.
 * - Adding a crucial content type parser to access the raw request body, which is
 *   essential for HMAC signature validation.
 * - Registering the dynamic relay routes that handle all incoming webhooks.
 * - Implementing a graceful shutdown mechanism to ensure that in-flight requests
 *   are completed before the process exits, preventing data loss.
 *
 * The `buildServer` function encapsulates this setup, making the server instance
 * easily testable and reusable.
 */

import fastify from 'fastify';
import logger from './utils/logger.js';
import relayRoutes from './routes/relay.js';

/**
 * Builds and configures the Fastify server instance.
 *
 * This function encapsulates the server setup logic, making it reusable for both
 * running the application and for integration testing.
 *
 * @returns {import('fastify').FastifyInstance} The configured Fastify server instance.
 */
export function buildServer() {
  const server = fastify({
    logger,
    // Generate a unique ID for each request, which is invaluable for tracing
    // a webhook's journey through the system in logs.
    genReqId: (req) => req.headers['x-request-id'] ?? req.headers['x-github-delivery'] ?? crypto.randomUUID(),
  });

  // --- Essential Plugins and Hooks ---

  /**
   * Add a custom content type parser for 'application/json'.
   * This is CRITICAL for HMAC signature validation. The standard Fastify parser
   * consumes the stream and makes the raw, unparsed body unavailable.
   * By adding this parser, we ensure that `request.rawBody` is populated with the
   * raw Buffer of the request payload, which is required to compute a matching signature.
   * The `done(null, body)` call then proceeds with standard JSON parsing.
   */
  server.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      // Attach the raw buffer to the request object for the signature validator.
      req.rawBody = body;
      // If the body is empty, return null for the parsed body.
      if (body.length === 0) {
        done(null, null);
        return;
      }
      // Proceed with standard JSON parsing.
      const json = JSON.parse(body.toString('utf-8'));
      done(null, json);
    } catch (err) {
      err.statusCode = 400; // Bad Request
      done(err, undefined);
    }
  });

  // Register the main relay routing logic.
  server.register(relayRoutes);

  // --- Graceful Shutdown ---

  /**
   * Sets up listeners for process termination signals (SIGINT, SIGTERM)
   * to ensure a graceful shutdown. When a signal is received, the server
   * will stop accepting new connections and attempt to finish processing
   * any in-flight requests before exiting.
   */
  const setupGracefulShutdown = () => {
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        server.log.info({ signal }, 'Received shutdown signal. Closing server gracefully...');
        try {
          await server.close();
          server.log.info('Server closed successfully. Exiting process.');
          process.exit(0);
        } catch (err) {
          server.log.error({ err }, 'Error during graceful shutdown.');
          process.exit(1);
        }
      });
    });
  };

  setupGracefulShutdown();

  return server;
}