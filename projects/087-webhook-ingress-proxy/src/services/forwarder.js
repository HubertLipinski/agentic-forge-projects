/**
 * @fileoverview Handles forwarding requests to downstream targets.
 * This service is responsible for the "last mile" of the proxy: sending the
 * (potentially transformed) webhook payload to its final destination(s).
 * It uses `undici` for high-performance HTTP requests and implements a robust
 * retry mechanism with exponential backoff and jitter to handle transient
 * failures in downstream services gracefully.
 */

import { request } from 'undici';
import logger from '../utils/logger.js';

const DEFAULT_RETRY_POLICY = {
  enabled: true,
  maxRetries: 3,
  initialInterval: 1000,
  maxInterval: 30000,
  backoffFactor: 2,
  jitter: true,
};

/**
 * A utility function to introduce a delay.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculates the delay for the next retry attempt using exponential backoff with jitter.
 * Delay = min(maxInterval, initialInterval * (backoffFactor ^ attempt))
 * Jitter is added as a random value between 0 and the calculated delay to prevent
 * thundering herd scenarios where multiple instances retry simultaneously.
 *
 * @param {number} attempt - The current retry attempt number (starting from 0).
 * @param {object} retryPolicy - The retry policy configuration for the target.
 * @returns {number} The calculated delay in milliseconds.
 */
function calculateRetryDelay(attempt, retryPolicy) {
  const { initialInterval, maxInterval, backoffFactor, jitter } = {
    ...DEFAULT_RETRY_POLICY,
    ...retryPolicy,
  };

  const exponentialDelay = initialInterval * Math.pow(backoffFactor, attempt);
  let backoff = Math.min(exponentialDelay, maxInterval);

  if (jitter) {
    // Add jitter: a random value between 0 and the backoff delay.
    // This helps spread out retry attempts from multiple concurrent processes.
    backoff += Math.random() * backoff;
  }

  return Math.floor(backoff);
}

/**
 * Forwards a single request to a specified downstream target.
 * It handles the actual HTTP request using `undici` and implements the retry logic.
 *
 * @param {object} params - The parameters for forwarding the request.
 * @param {string} params.routeId - The ID of the parent route for logging context.
 * @param {object} params.target - The downstream target configuration object.
 * @param {object} params.payload - The JSON payload to send.
 * @param {object} params.headers - The headers from the original request, to be selectively passed through.
 * @param {string} params.requestId - A unique ID for the incoming request, for traceability.
 */
async function forwardToTarget({ routeId, target, payload, headers, requestId }) {
  const { id: targetId, url, method = 'POST', headers: staticHeaders = {}, retry: retryPolicy } = target;

  const finalRetryPolicy = { ...DEFAULT_RETRY_POLICY, ...retryPolicy };
  const maxAttempts = finalRetryPolicy.enabled ? finalRetryPolicy.maxRetries + 1 : 1;

  const logContext = { routeId, targetId, targetUrl: url, requestId };

  // Prepare headers for the downstream request.
  // Start with static headers defined in the config, then add a trace header.
  const forwardHeaders = {
    ...staticHeaders,
    'X-Webhook-Proxy-Request-Id': requestId,
    'Content-Type': 'application/json',
  };

  // Avoid sending the host header from the original request, as it's for the proxy itself.
  if (headers.host) {
    delete headers.host;
  }
  // TODO: Add a configuration option to control which original headers are passed through.
  // For now, we merge them, with static headers taking precedence.
  Object.assign(forwardHeaders, headers, staticHeaders);

  const body = JSON.stringify(payload);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const isRetry = attempt > 0;
    try {
      logger.info(
        { ...logContext, attempt: attempt + 1, isRetry },
        `Forwarding request to target.`
      );

      const response = await request(url, {
        method,
        headers: forwardHeaders,
        body,
        // It's good practice to set a timeout for requests.
        bodyTimeout: 10000, // 10 seconds
        headersTimeout: 5000, // 5 seconds
      });

      const statusCode = response.statusCode;
      // Consider any 2xx status code a success.
      if (statusCode >= 200 && statusCode < 300) {
        logger.info(
          { ...logContext, attempt: attempt + 1, statusCode },
          'Successfully forwarded request to target.'
        );
        // Success, no need to retry.
        return;
      }

      // For non-successful status codes (3xx, 4xx, 5xx), decide whether to retry.
      // We generally retry on server errors (5xx) but not client errors (4xx).
      const shouldRetry = finalRetryPolicy.enabled && statusCode >= 500;

      if (shouldRetry && attempt < maxAttempts - 1) {
        const delayMs = calculateRetryDelay(attempt, finalRetryPolicy);
        logger.warn(
          { ...logContext, attempt: attempt + 1, statusCode, retryAfter: `${delayMs}ms` },
          `Forwarding failed with server error. Retrying...`
        );
        await delay(delayMs);
      } else {
        // This is the final attempt or a non-retriable error.
        logger.error(
          { ...logContext, attempt: attempt + 1, statusCode },
          'Forwarding failed. No more retries.'
        );
        // Stop retrying and exit the loop.
        return;
      }
    } catch (error) {
      // This catches network errors, timeouts, DNS issues, etc.
      const isFinalAttempt = attempt === maxAttempts - 1;
      if (isFinalAttempt || !finalRetryPolicy.enabled) {
        logger.error(
          { ...logContext, err: error, attempt: attempt + 1 },
          'Forwarding failed critically on final attempt.'
        );
        // Stop retrying.
        return;
      }

      const delayMs = calculateRetryDelay(attempt, finalRetryPolicy);
      logger.warn(
        { ...logContext, err: error, attempt: attempt + 1, retryAfter: `${delayMs}ms` },
        `Forwarding failed with network/request error. Retrying...`
      );
      await delay(delayMs);
    }
  }
}

/**
 * Orchestrates forwarding a request to all configured targets for a given route.
 * This function fans out the request by calling `forwardToTarget` for each
 * target defined in the route's configuration. The forwarding to each target
 * happens concurrently.
 *
 * @param {object} params - The parameters for the fan-out operation.
 * @param {string} params.routeId - The ID of the parent route.
 * @param {Array<object>} params.targets - An array of target configuration objects.
 * @param {object} params.payload - The final payload to be sent.
 * @param {object} params.headers - The original request headers.
 * @param {string} params.requestId - The unique ID for the incoming request.
 */
export async function fanoutToTargets({ routeId, targets, payload, headers, requestId }) {
  if (!targets || targets.length === 0) {
    logger.warn({ routeId, requestId }, 'No targets configured for this route. Nothing to forward.');
    return;
  }

  logger.info(
    { routeId, requestId, targetCount: targets.length },
    'Fanning out request to all targets.'
  );

  // Use Promise.all to forward to all targets concurrently.
  // `forwardToTarget` is designed to be self-contained and not throw exceptions,
  // so `Promise.all` will wait for all of them to complete, regardless of their
  // individual success or failure. This is a "fire-and-forget" fan-out from
  // the perspective of the main request handler.
  const forwardPromises = targets.map((target) =>
    forwardToTarget({
      routeId,
      target,
      payload,
      headers,
      requestId,
    })
  );

  await Promise.all(forwardPromises);

  logger.info(
    { routeId, requestId, targetCount: targets.length },
    'All forwarding tasks completed.'
  );
}