/**
 * @fileoverview The core webhook request handler for the Fastify server.
 * This module orchestrates the entire lifecycle of a webhook request for a matched route,
 * including validation, transformation, and forwarding. It's designed to be a
 * stateless and robust processor, handling each step in a defined sequence and
 * providing detailed logging for traceability.
 */

import { randomUUID } from 'node:crypto';
import logger from '../utils/logger.js';
import { verifyHmacSignature, validatePayload, getValidator } from '../utils/validation.js';
import { transformPayload } from '../services/transformer.js';
import { fanoutToTargets } from '../services/forwarder.js';

/**
 * Resolves a secret value, potentially from an environment variable.
 * If the secret string is in the format "${VAR_NAME}", it attempts to read
 * the corresponding environment variable. Otherwise, it returns the string as is.
 *
 * @param {string} secret - The secret string from the configuration.
 * @returns {string | undefined} The resolved secret value, or undefined if the env var is not set.
 */
function resolveSecret(secret) {
  if (typeof secret !== 'string') {
    return undefined;
  }
  const match = secret.match(/^\${(.+)}$/);
  if (match && match[1]) {
    const varName = match[1];
    return process.env[varName];
  }
  return secret;
}

/**
 * Performs signature validation on the incoming request.
 *
 * @param {object} params - The parameters for validation.
 * @param {import('fastify').FastifyRequest} params.request - The Fastify request object.
 * @param {object} params.routeConfig - The configuration for the matched route.
 * @param {object} params.logContext - The logging context for this request.
 * @returns {Promise<boolean>} A promise that resolves to `true` if validation passes, `false` otherwise.
 */
async function performSignatureValidation({ request, routeConfig, logContext }) {
  const sigConfig = routeConfig.validation?.signature;
  if (!sigConfig || sigConfig.enabled === false) {
    logger.debug(logContext, 'Signature validation is disabled for this route.');
    return true;
  }

  const { algorithm, header: headerName } = sigConfig;
  const signatureHeader = request.headers[headerName.toLowerCase()];
  const secret = resolveSecret(sigConfig.secret);

  if (!secret) {
    logger.error(
      { ...logContext, secretName: sigConfig.secret },
      'HMAC secret is not configured or environment variable is missing. Cannot validate signature.'
    );
    return false;
  }

  if (!signatureHeader) {
    logger.warn(
      { ...logContext, headerName },
      `Signature validation failed: Missing signature header.`
    );
    return false;
  }

  // `request.rawBody` is expected to be populated by a pre-handler hook in `server.js`
  const isValid = verifyHmacSignature({
    signatureHeader,
    payload: request.rawBody,
    secret,
    algorithm,
  });

  if (!isValid) {
    logger.warn(logContext, 'Signature validation failed: Invalid signature.');
  } else {
    logger.info(logContext, 'Signature validation successful.');
  }

  return isValid;
}

/**
 * Performs JSON schema validation on the request payload.
 *
 * @param {object} params - The parameters for validation.
 * @param {object} params.payload - The JSON payload to validate.
 * @param {object} params.routeConfig - The configuration for the matched route.
 * @param {object} params.logContext - The logging context for this request.
 * @returns {boolean} `true` if validation passes, `false` otherwise.
 */
function performPayloadValidation({ payload, routeConfig, logContext }) {
  const payloadConfig = routeConfig.validation?.payload;
  if (!payloadConfig || payloadConfig.enabled === false) {
    logger.debug(logContext, 'Payload schema validation is disabled for this route.');
    return true;
  }

  const validator = getValidator(routeConfig.id, payloadConfig.schema);
  const { isValid, errors } = validatePayload(validator, payload);

  if (!isValid) {
    logger.warn(
      { ...logContext, validationErrors: errors },
      'Payload schema validation failed.'
    );
  } else {
    logger.info(logContext, 'Payload schema validation successful.');
  }

  return isValid;
}

/**
 * Creates and returns a handler function for a specific route configuration.
 * This factory pattern allows us to create a dedicated, optimized handler for each
 * route defined in the configuration file at server startup.
 *
 * @param {object} routeConfig - The configuration object for a single route.
 * @returns {Function} An async Fastify route handler function.
 */
export function createWebhookHandler(routeConfig) {
  /**
   * The actual Fastify request handler.
   * @param {import('fastify').FastifyRequest} request
   * @param {import('fastify').FastifyReply} reply
   */
  return async function webhookHandler(request, reply) {
    const requestId = randomUUID();
    const logContext = {
      requestId,
      routeId: routeConfig.id,
      path: request.raw.url,
    };

    logger.info(logContext, 'Received incoming webhook request.');

    // 1. Signature Validation
    const isSignatureValid = await performSignatureValidation({
      request,
      routeConfig,
      logContext,
    });
    if (!isSignatureValid) {
      // Immediately reject requests with invalid signatures.
      // This is a security measure to prevent processing of unauthorized requests.
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Invalid request signature.',
        requestId,
      });
    }

    // Acknowledge the webhook producer as quickly as possible.
    // This is a best practice to prevent timeouts on the producer's side (e.g., GitHub).
    // The rest of the processing (validation, transformation, forwarding) happens asynchronously.
    reply.code(202).send({
      status: 'Accepted',
      message: 'Webhook accepted for processing.',
      requestId,
    });

    // The response has been sent. Now, process the webhook asynchronously.
    try {
      // The request body is already parsed by Fastify.
      let currentPayload = request.body;

      // 2. Payload Schema Validation
      const isPayloadValid = performPayloadValidation({
        payload: currentPayload,
        routeConfig,
        logContext,
      });
      if (!isPayloadValid) {
        // If payload validation fails, we stop processing for this route.
        // We've already sent a 202, so we just log and exit.
        logger.error(logContext, 'Halting processing due to failed payload validation.');
        return;
      }

      // 3. Payload Transformation
      const transformConfig = routeConfig.transform;
      if (transformConfig?.enabled !== false) {
        try {
          const transformedPayload = await transformPayload(
            currentPayload,
            transformConfig?.expression
          );
          logger.info(logContext, 'Payload transformation completed successfully.');
          currentPayload = transformedPayload;
        } catch (error) {
          logger.error(
            { ...logContext, err: error },
            'Payload transformation failed. Halting processing.'
          );
          return;
        }
      } else {
        logger.debug(logContext, 'Payload transformation is disabled for this route.');
      }

      // 4. Forwarding (Fan-out)
      await fanoutToTargets({
        routeId: routeConfig.id,
        targets: routeConfig.forward.targets,
        payload: currentPayload,
        headers: request.headers,
        requestId,
      });
    } catch (error) {
      // This is a catch-all for unexpected errors during the async processing phase.
      logger.fatal(
        { ...logContext, err: error },
        'An unexpected critical error occurred during asynchronous webhook processing.'
      );
    }
  };
}