/**
 * @fileoverview Provides functionality for validating HMAC-SHA256 signatures of incoming webhooks.
 *
 * This module is a critical security component of the relay service. It ensures that
 * incoming requests originate from a trusted source by verifying a cryptographic signature.
 * The signature is expected to be an HMAC-SHA256 hash of the request body, computed
 * using a pre-shared secret key.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The standard header name used by many services (like GitHub) to send the HMAC signature.
 * The format is typically `sha256=<signature>`.
 * @constant {string}
 */
const SIGNATURE_HEADER = 'x-hub-signature-256';

/**
 * The prefix expected in the signature header value.
 * @constant {string}
 */
const SIGNATURE_PREFIX = 'sha256=';

/**
 * Computes the HMAC-SHA256 signature for a given payload and secret.
 *
 * @private
 * @param {string} secret - The secret key used for hashing.
 * @param {string | Buffer} payload - The request body content to be hashed.
 * @returns {string} The computed hexadecimal HMAC-SHA256 signature.
 */
function computeSignature(secret, payload) {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Validates an incoming request's HMAC-SHA256 signature against a secret.
 *
 * This function performs the following steps:
 * 1. Extracts the signature from the `x-hub-signature-256` header.
 * 2. Verifies the header format (must start with `sha256=`).
 * 3. Computes the expected signature using the provided secret and the raw request body.
 * 4. Compares the expected signature with the received signature using a timing-safe method
 *    to prevent timing attacks.
 *
 * @param {object} request - The Fastify request object. It must contain `headers` and `rawBody`.
 * @param {string} secret - The pre-shared secret key for the specific webhook route.
 * @returns {boolean} `true` if the signature is valid, `false` otherwise.
 */
export function validateSignature(request, secret) {
  const signatureHeader = request.headers[SIGNATURE_HEADER];

  if (!signatureHeader) {
    request.log.warn(`Signature validation failed: Missing '${SIGNATURE_HEADER}' header.`);
    return false;
  }

  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    request.log.warn({ headerValue: signatureHeader }, `Signature validation failed: Invalid format for '${SIGNATURE_HEADER}' header.`);
    return false;
  }

  // The rawBody is provided by Fastify's `addContentTypeParser` in `app.js`
  const rawBody = request.rawBody;
  if (rawBody === undefined || rawBody === null) {
      request.log.error('Signature validation failed: `request.rawBody` is not available. Ensure content type parser is configured correctly.');
      return false;
  }

  const receivedSignature = signatureHeader.substring(SIGNATURE_PREFIX.length);
  const expectedSignature = computeSignature(secret, rawBody);

  // Use Buffer objects for timingSafeEqual. Ensure they have the same byte length
  // to avoid potential timing leaks from length checks within timingSafeEqual itself.
  const receivedSignatureBuffer = Buffer.from(receivedSignature, 'hex');
  const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

  if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    request.log.warn('Signature validation failed: Signature length mismatch.');
    return false;
  }

  const isValid = timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer);

  if (!isValid) {
    request.log.warn('Signature validation failed: Mismatched signature.');
  }

  return isValid;
}