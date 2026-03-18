/**
 * @file src/server.js
 * @description The main Fastify server setup. It initializes the framework,
 * registers plugins, routes, hooks for logging and error handling, and brings
 * all modules together.
 */

import Fastify from 'fastify';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { randomUUID } from 'node:crypto';

import logger from './utils/logger.js';
import policySchemas from './policy/schemas.js';
import healthRoutes from './routes/health.js';
import policyApiRoutes from './routes/policy-api.js';
import authorizeApiRoutes from './routes/authorize-api.js';

/**
 * Creates and configures a Fastify server instance.
 * This function encapsulates the entire server setup, including plugin registration,
 * hooks, and route definitions. It returns a server instance that is ready to be started.
 *
 * @param {object} [opts={}] - Options for server creation, primarily for testing purposes.
 * @param {import('pino').Logger} [opts.logger=logger] - A Pino logger instance. Defaults to the global logger.
 * @returns {import('fastify').FastifyInstance} A configured Fastify server instance.
 */
function buildServer(opts = {}) {
  const server = Fastify({
    // Use the provided logger, or the default application logger.
    // The `genReqId` function ensures every request has a unique ID for tracing.
    logger: opts.logger || logger,
    genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
    // Disable request logging for the built-in '404 Not Found' handler to reduce noise.
    // Our custom notFoundHandler provides more structured logging.
    disableRequestLogging: true,
  });

  // --- AJV and Schema Setup ---
  // Create a custom AJV instance to enable `ajv-formats` and other plugins.
  // This provides more powerful validation capabilities, like 'date-time' format.
  const ajv = new Ajv({
    allErrors: true, // Report all errors, not just the first one
    coerceTypes: true, // Automatically convert types where possible (e.g., "123" to 123)
    useDefaults: true, // Apply default values from schemas
    removeAdditional: 'failing', // Remove properties not in the schema
    $data: true, // Allow schemas to reference request data
  });
  addFormats(ajv); // Add formats like 'date-time', 'email', etc.

  // Set the custom AJV instance for Fastify's validation.
  server.setValidatorCompiler(({ schema }) => ajv.compile(schema));

  // Add all shared policy schemas to Fastify's schema store.
  // This allows them to be referenced by `$ref` in route schemas, promoting reusability.
  for (const schema of Object.values(policySchemas)) {
    server.addSchema(schema);
  }

  // --- Hooks ---
  // This global `onRequest` hook logs every incoming request in a structured format.
  // It's the entry point for request tracing and provides a consistent log entry.
  server.addHook('onRequest', async (request, reply) => {
    request.log.info({ req: request }, 'Incoming request');
  });

  // This global `onResponse` hook logs every outgoing response.
  // It includes key details like status code and response time, which are crucial for monitoring.
  server.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        res: reply,
        responseTime: reply.elapsedTime,
      },
      'Request completed',
    );
  });

  // --- Error Handling ---
  // A custom error handler to ensure all errors are logged and a consistent
  // JSON error format is sent to the client.
  server.setErrorHandler((error, request, reply) => {
    // Log the full error with stack trace for debugging.
    request.log.error({ err: error }, 'An error occurred while processing the request');

    // For validation errors from AJV, `error.validation` will be present.
    // We return a 400 Bad Request with detailed validation issues.
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request validation failed.',
        details: error.validation.map((v) => `${v.instancePath || 'body'} ${v.message}`),
      });
    }

    // If the error has a `statusCode` property (common in Fastify and other libs), use it.
    // Otherwise, default to a 500 Internal Server Error.
    const statusCode = error.statusCode || 500;
    const responsePayload = {
      statusCode,
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred.',
    };

    reply.status(statusCode).send(responsePayload);
  });

  // A custom handler for 404 Not Found errors. This provides a consistent JSON
  // response format instead of Fastify's default HTML or plain text response.
  server.setNotFoundHandler((request, reply) => {
    request.log.warn({ url: request.raw.url }, 'Route not found');
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
    });
  });

  // --- Route Registration ---
  // Register all route modules as plugins. This keeps the server setup clean and modular.
  // The `prefix` option automatically namespaces the routes within each file.
  server.register(healthRoutes);
  server.register(policyApiRoutes, { prefix: '/policies' });
  server.register(authorizeApiRoutes, { prefix: '/authorize' });

  return server;
}

export default buildServer;