/**
 * @fileoverview Fastify route handler for receiving and processing webhook relays.
 *
 * This module defines the main webhook ingestion endpoint. It's a dynamic route
 * that captures all incoming POST requests under a specified prefix. For each
 * request, it orchestrates the validation and relaying process:
 *
 * 1.  **Route Matching:** It uses the incoming request path to look up a
 *     corresponding configuration from the `routes.json` config.
 * 2.  **Signature Validation:** If the route requires it, it validates the HMAC
 *     signature of the request to ensure it comes from a trusted source.
 * 3.  **Relaying:** If validation passes (or is not required), it delegates the
 *     request to the `relay-handler` service, which manages forwarding the
 *     request to the internal target URL, including retry logic.
 * 4.  **Response Handling:** It sends an appropriate HTTP response to the original
 *     webhook source based on the outcome of the relay process.
 */

import { getRouteByPath } from '../utils/config-loader.js';
import { validateSignature } from '../services/signature-validator.js';
import { relayRequest } from '../services/relay-handler.js';

/**
 * The main route handler for all incoming webhook requests.
 * It's designed to be a catch-all for any path, which is then used to find
 * the specific routing configuration.
 *
 * @param {import('fastify').FastifyRequest} request - The Fastify request object.
 * @param {import('fastify').FastifyReply} reply - The Fastify reply object.
 */
async function handleRelay(request, reply) {
  const requestPath = request.url;
  request.log.info({ path: requestPath }, 'Received incoming webhook request.');

  // 1. Find the route configuration based on the request path.
  const routeConfig = getRouteByPath(requestPath);

  if (!routeConfig) {
    request.log.warn({ path: requestPath }, 'No matching route configuration found for this path.');
    return reply.code(404).send({
      error: 'Not Found',
      message: `No webhook relay is configured for the path: ${requestPath}`,
    });
  }

  // 2. Perform signature validation if a secret is configured for the route.
  if (routeConfig.secret) {
    if (!validateSignature(request, routeConfig.secret)) {
      // The `validateSignature` function logs the specific reason for failure.
      request.log.error({ path: requestPath }, 'Request failed signature validation.');
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Invalid signature. Request rejected.',
      });
    }
    request.log.info({ path: requestPath }, 'Signature validation successful.');
  } else {
    request.log.info({ path: requestPath }, 'No secret configured for this route, skipping signature validation.');
  }

  // 3. Asynchronously relay the request and immediately respond to the source.
  // We don't wait for the relay to complete. This "fire-and-forget" approach
  // ensures the webhook source receives a quick confirmation, preventing timeouts
  // on their end, while our service handles the delivery reliability internally.
  reply.code(202).send({
    status: 'Accepted',
    message: 'Webhook accepted for processing.',
    requestId: request.id,
  });

  // The `relayRequest` function contains its own comprehensive logging and error handling.
  // It will run in the background after the response has been sent.
  relayRequest({ request, routeConfig }).catch(error => {
    // This catch block is a safeguard. `relayRequest` is designed to handle its own
    // errors and not throw. If it does, it's an unexpected, critical failure.
    request.log.fatal(
      { err: error, path: requestPath, targetUrl: routeConfig.targetUrl },
      'An unexpected critical error occurred in the relayRequest process.'
    );
  });
}

/**
 * A Fastify plugin that registers the generic webhook relay route.
 * This function is imported and used by `app.js` to attach the routing logic
 * to the Fastify instance.
 *
 * It registers a single, dynamic POST route that captures all sub-paths.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 */
export default async function relayRoutes(fastify) {
  fastify.post('/*', handleRelay);

  fastify.log.info('Webhook relay route (POST /*) has been registered.');
}