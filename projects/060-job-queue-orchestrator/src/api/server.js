/**
 * src/api/server.js
 *
 * Fastify server setup: registers plugins, routes, and error handlers.
 *
 * This module is responsible for assembling the Fastify application. It initializes
 * the server, configures it with necessary plugins for logging, validation, and
 * documentation, registers all API routes, and sets up global error handling
 * and a custom 404 handler. It provides a clean `start` and `stop` interface
 * for managing the server's lifecycle.
 */

import Fastify from 'fastify';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import logger from '../utils/logger.js';
import jobRoutes from './routes/jobs.js';
import {
  enqueueJobSchema,
  jobIdParamSchema,
  jobListQuerySchema,
  jobResponseSchema,
  jobListResponseSchema,
  errorResponseSchema,
} from './schemas.js';

/**
 * Creates and configures a Fastify server instance.
 *
 * @param {object} services - An object containing the application's core services.
 * @param {import('../services/queue.js').JobQueue} services.queue - The job queue service.
 * @returns {import('fastify').FastifyInstance} The configured Fastify instance.
 */
export function createServer(services) {
  if (!services || !services.queue) {
    throw new Error('Cannot create server without required services (queue).');
  }

  // Initialize Fastify with our shared Pino logger instance.
  // This ensures consistent logging across the entire application.
  const fastify = Fastify({
    logger,
    // Generate a unique request ID for each request to trace it through logs.
    requestIdHeader: 'X-Request-ID',
    requestIdLogLabel: 'reqId',
    genReqId: () => `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}`,
  });

  // --- Plugin Registration ---

  // Configure Ajv for advanced JSON Schema validation (e.g., 'date-time', 'uri').
  const ajv = new Ajv({
    allErrors: true, // Report all errors, not just the first
    coerceTypes: true, // Automatically coerce types (e.g., string '123' to number 123)
    useDefaults: true, // Apply default values from schemas
    removeAdditional: 'failing', // Remove additional properties that fail validation
    logger: false, // Disable Ajv's own logger to use Fastify's
  });
  addFormats(ajv);
  fastify.setValidatorCompiler(({ schema }) => ajv.compile(schema));

  // Add all our API schemas to Fastify so they can be referenced by ID.
  // This improves performance and allows for schema reuse.
  fastify.addSchema(enqueueJobSchema);
  fastify.addSchema(jobIdParamSchema);
  fastify.addSchema(jobListQuerySchema);
  fastify.addSchema(jobResponseSchema);
  fastify.addSchema(jobListResponseSchema);
  fastify.addSchema(errorResponseSchema);

  // --- Route Registration ---

  // A simple health check endpoint.
  fastify.get('/health', {
    schema: {
      description: 'Check the health of the API server.',
      tags: ['Health'],
      summary: 'Health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register the job-related routes, passing in the queue service as a dependency.
  fastify.register(jobRoutes, {
    prefix: '/v1',
    queue: services.queue,
  });

  // --- Hooks and Error Handling ---

  // Custom 404 handler to provide a consistent JSON error response.
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
    });
  });

  // Global error handler. Catches uncaught errors from route handlers.
  fastify.setErrorHandler((error, request, reply) => {
    // Log the error with request context.
    request.log.error({ err: error }, 'An unhandled error occurred in a request handler');

    // If the error is a validation error from Fastify/Ajv, it will have a `validation` property.
    if (error.validation) {
      reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request validation failed.',
        details: error.validation.map(v => `${v.instancePath || 'body'} ${v.message}`),
      });
      return;
    }

    // For other client-side errors, use the status code from the error if available.
    const statusCode = error.statusCode ?? 500;
    if (statusCode < 500) {
      reply.status(statusCode).send({
        statusCode,
        error: error.name ?? 'Error',
        message: error.message,
      });
      return;
    }

    // For server errors, return a generic 500 response to avoid leaking details.
    reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred on the server.',
    });
  });

  return fastify;
}