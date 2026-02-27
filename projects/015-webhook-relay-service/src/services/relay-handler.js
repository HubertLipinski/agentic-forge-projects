/**
 * @fileoverview Core logic for relaying an incoming webhook request to its target URL.
 *
 * This module encapsulates the process of forwarding a validated webhook. It handles
 * constructing the request to the internal service, including forwarding relevant headers
 * and the request body. Crucially, it implements a configurable retry mechanism with
 * exponential backoff to gracefully handle transient failures in the target service,
 * enhancing the reliability of webhook delivery.
 */

import axios from 'axios';
import logger from '../utils/logger.js';

// --- Constants ---

/**
 * Default configuration for the retry mechanism.
 * These values are used if not specified in the route's configuration.
 * @constant {object}
 */
const DEFAULT_RETRY_CONFIG = {
  attempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  factor: 2,
};

/**
 * A Set of HTTP status codes that should trigger a retry.
 * These are typically server-side errors (5xx) or rate-limiting responses (429)
 * that indicate a transient issue which might be resolved on a subsequent attempt.
 * @constant {Set<number>}
 */
const RETRYABLE_STATUS_CODES = new Set([
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

// --- Helper Functions ---

/**
 * Creates a promise that resolves after a specified duration.
 * Used to implement delays between retry attempts.
 *
 * @private
 * @param {number} ms - The delay duration in milliseconds.
 * @returns {Promise<void>} A promise that resolves when the timer completes.
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Prepares the headers to be forwarded to the target service.
 * It takes the original request headers and the route configuration to determine
 * which headers should be passed along.
 *
 * @private
 * @param {object} originalHeaders - The headers from the incoming Fastify request.
 * @param {object} routeConfig - The configuration for the specific route.
 * @returns {object} A new object containing only the headers to be forwarded.
 */
function prepareForwardedHeaders(originalHeaders, routeConfig) {
  const forwardedHeaders = {};

  // 1. Add any static headers defined in the route configuration.
  // These will override any incoming headers with the same name.
  if (routeConfig.forwardHeaders?.static) {
    Object.assign(forwardedHeaders, routeConfig.forwardHeaders.static);
  }

  // 2. Forward specific headers from the original request if configured.
  if (routeConfig.forwardHeaders?.include) {
    for (const headerName of routeConfig.forwardHeaders.include) {
      const lowerHeaderName = headerName.toLowerCase();
      if (originalHeaders[lowerHeaderName]) {
        // Only add if not already set by static headers, which have precedence.
        if (!forwardedHeaders[headerName]) {
          forwardedHeaders[headerName] = originalHeaders[lowerHeaderName];
        }
      }
    }
  }

  // 3. Always forward the content-type header if it exists, as it's crucial for body parsing.
  // This can be overridden by a static `content-type` header if specified.
  if (originalHeaders['content-type'] && !forwardedHeaders['content-type']) {
    forwardedHeaders['content-type'] = originalHeaders['content-type'];
  }

  return forwardedHeaders;
}

// --- Main Relay Logic ---

/**
 * Relays a webhook request to its configured target URL with retry logic.
 *
 * This function attempts to send the request to the `targetUrl` defined in the
 * `routeConfig`. If the request fails with a network error or a retryable HTTP
 * status code (e.g., 503 Service Unavailable), it will automatically retry the
 * request using an exponential backoff strategy.
 *
 * The retry behavior is configurable via the `retry` object in the route's configuration.
 *
 * @param {object} options - The options for relaying the request.
 * @param {object} options.request - The original Fastify request object.
 * @param {object} options.routeConfig - The configuration object for the matched route.
 * @returns {Promise<{success: boolean, status?: number, finalAttempt: number}>}
 *          An object indicating the outcome of the relay attempt.
 *          `success` is true if a 2xx response was received from the target.
 *          `status` is the final HTTP status code received from the target.
 *          `finalAttempt` is the attempt number on which the process concluded.
 */
export async function relayRequest({ request, routeConfig }) {
  const { targetUrl } = routeConfig;
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...routeConfig.retry };
  const { attempts, initialDelay, maxDelay, factor } = retryConfig;

  const forwardedHeaders = prepareForwardedHeaders(request.headers, routeConfig);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const isLastAttempt = attempt === attempts;
    const requestLogData = {
      requestId: request.id,
      targetUrl,
      attempt,
      maxAttempts: attempts,
    };

    try {
      request.log.info(requestLogData, 'Relaying request to target.');

      const response = await axios({
        method: 'POST',
        url: targetUrl,
        headers: forwardedHeaders,
        data: request.body,
        timeout: 15000, // 15-second timeout for the target to respond
        validateStatus: (status) => status >= 200 && status < 500, // Don't throw for 4xx errors
      });

      // Success case: Target responded with a 2xx status code.
      if (response.status >= 200 && response.status < 300) {
        request.log.info(
          { ...requestLogData, status: response.status },
          'Successfully relayed request.'
        );
        return { success: true, status: response.status, finalAttempt: attempt };
      }

      // Non-retryable failure: Target responded with a 3xx or 4xx status (except 429).
      if (!RETRYABLE_STATUS_CODES.has(response.status)) {
        request.log.error(
          { ...requestLogData, status: response.status },
          'Relay failed with non-retryable status code from target.'
        );
        return { success: false, status: response.status, finalAttempt: attempt };
      }

      // Retryable failure: Target responded with a status code in RETRYABLE_STATUS_CODES.
      request.log.warn(
        { ...requestLogData, status: response.status },
        `Relay attempt failed with retryable status code ${response.status}.`
      );

      if (isLastAttempt) {
        request.log.error(
          { ...requestLogData, status: response.status },
          'Final relay attempt failed. Giving up.'
        );
        return { success: false, status: response.status, finalAttempt: attempt };
      }

    } catch (error) {
      // Network error or other axios-specific error (e.g., timeout).
      request.log.warn(
        { ...requestLogData, error: { message: error.message, code: error.code } },
        'Relay attempt failed with a network or timeout error.'
      );

      if (isLastAttempt) {
        request.log.error(
          { ...requestLogData, error: { message: error.message, code: error.code } },
          'Final relay attempt failed due to network/timeout error. Giving up.'
        );
        return { success: false, status: error.response?.status, finalAttempt: attempt };
      }
    }

    // If not the last attempt, calculate delay and wait before retrying.
    const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), maxDelay);
    request.log.info({ ...requestLogData, delay }, `Waiting ${delay}ms before next attempt.`);
    await wait(delay);
  }

  // This line should theoretically be unreachable due to return statements inside the loop.
  // It serves as a fallback to ensure the function always returns a valid object.
  logger.fatal({ requestId: request.id }, 'Relay logic reached an unexpected state. This indicates a bug.');
  return { success: false, finalAttempt: attempts };
}