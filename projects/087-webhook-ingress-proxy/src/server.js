/**
 * @fileoverview Initializes and configures the Fastify server.
 * This module is responsible for creating the server instance, setting up
 * global middleware and hooks, and dynamically creating routes based on the
 * loaded application configuration. It brings together all the components
 * of the application to run the webhook proxy service.
 */

import Fastify from 'fastify';
import logger from './utils/logger.js';
import { createWebhookHandler } from './routes/handler.js';
import { getValidator } from './utils/validation.js';
import jsonata from 'jsonata';

/**
 * A hook to capture the raw request body before Fastify parses it.
 * This is crucial for signature validation (e.g., HMAC), which requires
 * the raw, unparsed payload. The raw body is attached to the request object.
 *
 * @param {import('fastify').FastifyRequest} request - The Fastify request object.
 * @param {import('fastify').FastifyReply} reply - The Fastify reply object.
 * @param {Function} done - The callback to signal completion of the hook.
 */
function rawBodyHook(request, reply, done) {
  const chunks = [];
  request.raw.on('data', (chunk) => {
    chunks.push(chunk);
  });
  request.raw.on('end', () => {
    // Attach the raw body buffer to the request object for later use.
    request.rawBody = Buffer.concat(chunks);
    done();
  });
  request.raw.on('error', (err) => {
    logger.error({ err, requestId: request.id }, 'Error reading raw request body.');
    done(err);
  });
}

/**
 * Creates and configures a Fastify server instance.
 *
 * @param {object} config - The application configuration object.
 * @returns {import('fastify').FastifyInstance} The configured Fastify server instance.
 */
function createServer(config) {
  const server = Fastify({
    logger,
    // Generate a unique request ID for each incoming request for better traceability.
    genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
    // Disable request timeout at the Fastify level, as we manage timeouts
    // in the downstream `undici` requests. We send a 202 Accepted response
    // quickly, so the connection to the client is not held open.
    requestTimeout: 0,
  });

  // Add a global hook to capture the raw request body for all routes.
  // This must be done before Fastify's body parser runs.
  server.addHook('preParsing', rawBodyHook);

  // Add a hook to log every incoming request.
  server.addHook('onRequest', (request, reply, done) => {
    request.log.info({
      method: request.raw.method,
      url: request.raw.url,
      ip: request.ip,
      headers: request.headers,
    }, 'Incoming request');
    done();
  });

  // Add a hook to log the response just before it's sent.
  server.addHook('onResponse', (request, reply, done) => {
    request.log.info({
      statusCode: reply.raw.statusCode,
      durationMs: reply.getResponseTime(),
    }, 'Request completed');
    done();
  });

  // Add a generic health check endpoint.
  server.get('/health', async (request, reply) => {
    return reply.code(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return server;
}

/**
 * Validates route configurations at startup to catch errors early.
 * This function checks for things that can't be easily enforced by JSON schema,
 * like valid JSONata expressions.
 *
 * @param {Array<object>} routes - The array of route configurations.
 */
function validateRouteLogic(routes) {
  logger.info('Performing startup validation of route logic...');
  for (const route of routes) {
    // Validate JSON Schemas by compiling them.
    try {
      if (route.validation?.payload?.schema) {
        getValidator(route.id, route.validation.payload.schema);
      }
    } catch (error) {
      // The error is already logged by getValidator, just rethrow to halt startup.
      throw new Error(`Startup failed due to invalid JSON schema in route '${route.id}'.`);
    }

    // Validate JSONata expressions by compiling them.
    try {
      if (route.transform?.expression) {
        jsonata(route.transform.expression);
      }
      if (route.match?.payload) {
        jsonata(route.match.payload);
      }
    } catch (error) {
      logger.error(
        { err: error, routeId: route.id },
        'Invalid JSONata expression in route configuration.'
      );
      throw new Error(`Startup failed due to invalid JSONata expression in route '${route.id}': ${error.message}`);
    }
  }
  logger.info('All route logic validated successfully.');
}

/**
 * Dynamically registers routes on the Fastify server based on the configuration.
 *
 * @param {import('fastify').FastifyInstance} server - The Fastify server instance.
 * @param {Array<object>} routes - The array of route configurations.
 */
function registerRoutes(server, routes) {
  if (!routes || routes.length === 0) {
    logger.warn('No routes found in the configuration. The server will not proxy any webhooks.');
    return;
  }

  // Perform deeper validation of route logic before registering.
  validateRouteLogic(routes);

  routes.forEach((routeConfig) => {
    // Fastify supports an array of methods for a single route definition.
    const methods = routeConfig.methods ?? ['POST'];

    // Create a dedicated handler for this specific route configuration.
    const handler = createWebhookHandler(routeConfig);

    server.route({
      method: methods,
      url: routeConfig.path,
      // Pass the route config to the handler via route-level context.
      // This is a clean way to provide route-specific data without global state.
      // However, our `createWebhookHandler` factory pattern already encapsulates this.
      handler,
    });

    logger.info(
      {
        routeId: routeConfig.id,
        path: routeConfig.path,
        methods: methods.join(', '),
      },
      'Successfully registered route.'
    );
  });
}

/**
 * Initializes and starts the Fastify server.
 * This is the main entry point for running the application.
 *
 * @param {object} config - The validated application configuration.
 * @returns {Promise<import('fastify').FastifyInstance>} A promise that resolves with the running server instance.
 */
export async function startServer(config) {
  try {
    const server = createServer(config);

    registerRoutes(server, config.routes);

    const host = config.server?.host ?? '0.0.0.0';
    const port = config.server?.port ?? 3000;

    await server.listen({ host, port });

    // The logger is already configured in Fastify, but this provides a clear startup message.
    logger.info(`Server listening on http://${host}:${port}`);
    logger.info('Webhook Ingress Proxy is running.');

    return server;
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server.');
    // Exit the process with a non-zero code to indicate a fatal startup error.
    // This is important for process managers and container orchestration systems.
    process.exit(1);
  }
}