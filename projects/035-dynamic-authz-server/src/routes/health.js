/**
 * @file src/routes/health.js
 * @description Defines the '/health' endpoint for service monitoring and readiness checks.
 *
 * This route provides a simple, unauthenticated endpoint that monitoring systems
 * can use to verify the liveness and basic health of the authorization server.
 * A successful 200 OK response indicates that the HTTP server is running and
 * able to process requests.
 */

import { version as appVersion, name as appName } from '../../package.json' with { type: 'json' };

/**
 * Encapsulates the health check route logic.
 * This function is designed to be registered as a Fastify plugin.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 * @param {object} opts - Plugin options (not used in this plugin).
 */
async function healthRoutes(fastify, opts) {
  /**
   * @type {import('fastify').RouteShorthandOptions}
   * @const
   */
  const routeOptions = {
    // Define a JSON schema for the response. This is good practice for API
    // consistency and allows Fastify to optimize JSON serialization.
    schema: {
      summary: 'Get Service Health Status',
      description: 'Returns the operational status of the service, typically used for liveness probes.',
      tags: ['Monitoring'],
      response: {
        200: {
          description: 'Successful response indicating the service is healthy.',
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            name: { type: 'string', example: 'dynamic-authorization-server' },
            version: { type: 'string', example: '1.0.0' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['status', 'name', 'version', 'timestamp'],
        },
      },
    },
    // Exclude this route from the default request logging to reduce noise
    // from frequent health checks by monitoring systems.
    logLevel: 'silent',
  };

  /**
   * Route handler for GET /health.
   * Responds with a status object indicating the service is operational.
   *
   * @param {import('fastify').FastifyRequest} request - The incoming request object.
   * @param {import('fastify').FastifyReply} reply - The response object.
   */
  async function getHealthHandler(request, reply) {
    // The payload includes basic service information which can be useful
    // for operators to quickly identify the running version.
    const healthStatus = {
      status: 'ok',
      name: appName,
      version: appVersion,
      timestamp: new Date().toISOString(),
    };

    // Fastify automatically handles setting the Content-Type header to
    // 'application/json' and serializing the object to a JSON string.
    return reply.code(200).send(healthStatus);
  }

  fastify.get('/health', routeOptions, getHealthHandler);
}

export default healthRoutes;