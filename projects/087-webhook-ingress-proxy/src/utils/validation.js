/**
 * @fileoverview Provides utility functions for request validation.
 * This includes HMAC signature verification and JSON Schema validation using AJV.
 * These functions are essential for ensuring the integrity and correctness of incoming webhook data.
 */

import crypto from 'node:crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import logger from './logger.js';

/**
 * A singleton Ajv instance for JSON Schema validation.
 * Using a singleton improves performance by caching compiled schemas.
 * `ajv-formats` is added to support formats like 'date-time', 'uri', etc.
 *
 * Configuration options:
 * - `allErrors: true`: Collect all validation errors, not just the first one.
 * - `strict: 'log'`: Logs warnings for unsupported keywords or other schema issues,
 *   which is helpful during development without being overly restrictive.
 */
const ajv = new Ajv({ allErrors: true, strict: 'log' });
addFormats(ajv);

// Pre-compile an empty schema validator. This can be used as a no-op
// validator when a route has no specific schema, avoiding null checks.
const emptySchemaValidator = ajv.compile({});

/**
 * A Map to cache compiled AJV validators.
 * The key is the route ID, and the value is the compiled validator function.
 * Caching avoids the performance overhead of recompiling the same schema for every request.
 * @type {Map<string, import('ajv').ValidateFunction>}
 */
const validatorCache = new Map();

/**
 * Compiles a JSON schema using AJV or retrieves it from a cache.
 *
 * @param {string} routeId - A unique identifier for the route, used as the cache key.
 * @param {object} schema - The JSON schema object to compile.
 * @returns {import('ajv').ValidateFunction} The compiled AJV validation function.
 */
export function getValidator(routeId, schema) {
  if (!schema || Object.keys(schema).length === 0) {
    return emptySchemaValidator;
  }

  if (validatorCache.has(routeId)) {
    return validatorCache.get(routeId);
  }

  try {
    const validator = ajv.compile(schema);
    validatorCache.set(routeId, validator);
    logger.debug({ routeId }, 'JSON schema compiled and cached successfully.');
    return validator;
  } catch (error) {
    logger.error(
      { err: error, routeId, schema },
      'Failed to compile JSON schema. This is a critical configuration error.'
    );
    // Throwing here is appropriate because a malformed schema is a startup/config error,
    // not a runtime request error. The server should ideally not start with invalid schemas.
    throw new Error(`Invalid JSON schema for route '${routeId}': ${error.message}`);
  }
}

/**
 * Verifies an HMAC signature against a request body.
 * This is commonly used by services like GitHub, Stripe, and Slack to secure webhooks.
 *
 * @param {object} params - The parameters for signature verification.
 * @param {string} params.signatureHeader - The signature provided in the request header (e.g., 'sha256=...').
 * @param {string | Buffer} params.payload - The raw request body payload.
 * @param {string} params.secret - The secret key used to sign the payload.
 * @param {string} params.algorithm - The HMAC algorithm (e.g., 'sha256', 'sha1').
 * @returns {boolean} `true` if the signature is valid, `false` otherwise.
 */
export function verifyHmacSignature({ signatureHeader, payload, secret, algorithm }) {
  if (!signatureHeader || !payload || !secret || !algorithm) {
    logger.warn(
      { hasSignature: !!signatureHeader, hasPayload: !!payload, hasSecret: !!secret, hasAlgorithm: !!algorithm },
      'HMAC signature verification skipped due to missing parameters.'
    );
    return false;
  }

  try {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // The signature header often includes the algorithm and a prefix (e.g., "sha256=...").
    // We need to extract the actual signature value for comparison.
    const signatureParts = signatureHeader.split('=').map((part) => part.trim());
    const actualSignature = signatureParts.length > 1 ? signatureParts[1] : signatureParts[0];

    // Use crypto.timingSafeEqual to prevent timing attacks.
    // This requires both buffers to have the same length.
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(actualSignature, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) {
      logger.warn({
        algorithm,
        expectedLength: expectedBuffer.length,
        actualLength: actualBuffer.length
      }, 'HMAC signature length mismatch.');
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (error) {
    logger.error(
      { err: error, algorithm },
      'Error during HMAC signature verification. This may be due to an invalid algorithm or other crypto error.'
    );
    return false;
  }
}

/**
 * Validates a JSON payload against a compiled AJV validator.
 *
 * @param {import('ajv').ValidateFunction} validator - The compiled AJV validation function.
 * @param {object} payload - The JSON payload to validate.
 * @returns {{ isValid: boolean, errors: import('ajv').ErrorObject[] | null | undefined }} An object indicating if the payload is valid and any validation errors.
 */
export function validatePayload(validator, payload) {
  const isValid = validator(payload);
  if (isValid) {
    return { isValid: true, errors: null };
  }
  // validator.errors will contain the validation errors
  return { isValid: false, errors: validator.errors };
}