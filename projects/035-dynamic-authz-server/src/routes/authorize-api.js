/**
 * @file src/routes/authorize-api.js
 * @description Defines the high-performance '/authorize' endpoint. It receives the
 * user/resource context, fetches relevant policies from the cache, and uses the
 * engine to make a decision.
 */

import { policyStore } from '../policy/store.js';
import { evaluatePolicies } from '../policy/engine.js';

/**
 * The JSON schema for the body of an authorization request.
 * It defines the structure for the context data that the policy engine will use.
 * The `context` object is intentionally flexible (`additionalProperties: true`)
 * to accommodate any attribute-based access control (ABAC) scenario.
 *
 * @type {import('ajv').SchemaObject}
 */
const authorizeRequestSchema = {
  $id: 'authorizeRequest',
  type: 'object',
  properties: {
    context: {
      type: 'object',
      description: 'A flexible object containing all contextual data for the authorization check, such as user attributes, resource details, and the requested action.',
      additionalProperties: true,
      minProperties: 1, // Context cannot be empty.
    },
  },
  required: ['context'],
  additionalProperties: false, // No other top-level properties are allowed.
};

/**
 * The JSON schema for the successful response of an authorization request.
 * It details the decision, the policy that matched (if any), and the reasons.
 *
 * @type {import('ajv').SchemaObject}
 */
const authorizeResponseSchema = {
  $id: 'authorizeResponse',
  type: 'object',
  properties: {
    decision: {
      type: 'string',
      enum: ['allow', 'deny'],
      description: 'The final authorization decision.',
    },
    matchedPolicyId: {
      type: ['string', 'null'],
      description: 'The ID of the policy that resulted in the decision, or null if no policy matched.',
    },
    reasons: {
      type: 'array',
      items: { type: 'string' },
      description: 'An array of human-readable explanations for the decision, useful for audit logging.',
    },
  },
  required: ['decision', 'matchedPolicyId', 'reasons'],
};

/**
 * Encapsulates the authorization endpoint logic.
 * This function is designed to be registered as a Fastify plugin.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 * @param {object} opts - Plugin options (not used in this plugin).
 */
async function authorizeApiRoutes(fastify, opts) {
  // Register schemas with Fastify's internal AJV instance.
  // This allows referencing them by their `$id` in route definitions.
  if (!fastify.hasSchema(authorizeRequestSchema.$id)) {
    fastify.addSchema(authorizeRequestSchema);
  }
  if (!fastify.hasSchema(authorizeResponseSchema.$id)) {
    fastify.addSchema(authorizeResponseSchema);
  }

  /**
   * @type {import('fastify').RouteShorthandOptions}
   * @const
   */
  const routeOptions = {
    schema: {
      summary: 'Perform an Authorization Check',
      description: 'Evaluates a set of policies against a given context to determine if an action is allowed or denied. This is the core, high-performance endpoint of the service.',
      tags: ['Authorization'],
      body: { $ref: 'authorizeRequest#' },
      response: {
        200: {
          description: 'The result of the authorization evaluation.',
          $ref: 'authorizeResponse#',
        },
        // A 503 Service Unavailable is appropriate if the policy cache isn't ready,
        // as the service cannot fulfill its primary function.
        503: {
          description: 'The service is temporarily unavailable, likely because the policy cache is not initialized.',
          type: 'object',
          properties: {
            statusCode: { type: 'number', example: 503 },
            error: { type: 'string', example: 'Service Unavailable' },
            message: { type: 'string' },
          },
        },
      },
      // This is a high-throughput endpoint. We rely on the audit log hook for detailed
      // decision logging rather than verbose request/response logging for every check.
      // The log level can be raised via configuration if needed for debugging.
      logLevel: 'info',
    },
  };

  /**
   * Handler for POST /authorize.
   * This is the hot path of the application and is optimized for performance.
   *
   * @param {import('fastify').FastifyRequest} request - The incoming request object.
   * @param {import('fastify').FastifyReply} reply - The response object.
   */
  async function authorizeHandler(request, reply) {
    const { context } = request.body;
    const requestLogger = request.log;

    let policies;
    try {
      // Fetch policies from the in-memory cache. This is a synchronous, fast operation.
      // It returns a deep clone, ensuring the cache is not accidentally mutated.
      policies = policyStore.getPolicies();
    } catch (error) {
      // This error is thrown by `getPolicies` if the cache has not been initialized.
      // It's a critical state, meaning the server started but failed its policy load.
      requestLogger.error({ err: error }, 'Authorization check failed: Policy cache is not available.');
      return reply.code(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'The authorization service is not ready to process requests. Policy cache is not initialized.',
      });
    }

    // The core logic: pass the cached policies and the request context to the engine.
    // The engine is a pure function, making this step highly predictable and testable.
    const evaluationResult = evaluatePolicies({
      policies,
      context,
      requestLogger,
    });

    // The result from the engine directly maps to the API response structure.
    return reply.send(evaluationResult);
  }

  fastify.post('/authorize', routeOptions, authorizeHandler);
}

export default authorizeApiRoutes;