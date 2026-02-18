/**
 * @file src/lib/webhook-caller.js
 * @description A utility module for sending POST requests to registered webhooks.
 * This module is responsible for notifying external systems about job status changes.
 * It includes a robust retry mechanism with exponential backoff to handle transient
 * network failures or temporary unavailability of the webhook receiver.
 */

import pino from 'pino';

// --- Constants ---

/**
 * The maximum number of times to attempt sending a webhook before giving up.
 * A value of 3 means 1 initial attempt + 2 retries.
 * @constant {number}
 */
const MAX_WEBHOOK_ATTEMPTS = 3;

/**
 * The base delay in milliseconds for the exponential backoff retry strategy.
 * The delay for each retry will be `BASE_RETRY_DELAY * (2 ** (attempt - 1))`.
 * @constant {number}
 */
const BASE_RETRY_DELAY_MS = 500;

/**
 * The maximum time in milliseconds to wait for a webhook request to complete.
 * This prevents the worker from being stuck on a slow or unresponsive endpoint.
 * @constant {number}
 */
const WEBHOOK_TIMEOUT_MS = 10000; // 10 seconds

/**
 * A unique user-agent string to identify requests from this job queue manager.
 * This helps webhook receivers identify the source of incoming traffic.
 * @constant {string}
 */
const USER_AGENT = 'Job-Queue-Manager/1.0';

// --- Logger Initialization ---
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
    },
  },
}).child({ module: 'webhook-caller' });

/**
 * A simple promise-based delay function.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a POST request to a specified webhook URL with a given payload.
 * Implements an automatic retry mechanism with exponential backoff for transient failures.
 *
 * @param {object} params - The parameters for sending the webhook.
 * @param {string} params.url - The URL to which the POST request will be sent.
 * @param {object} params.payload - The JSON payload to send in the request body.
 * @param {object} [params.headers={}] - Optional custom headers to include in the request.
 * @param {string} params.jobId - The ID of the job that triggered this webhook, for logging.
 * @returns {Promise<{success: boolean, status: number|null, finalAttempt: number}>} An object indicating the outcome.
 */
export async function sendWebhook({ url, payload, headers = {}, jobId }) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
  };

  const requestHeaders = { ...defaultHeaders, ...headers };

  for (let attempt = 1; attempt <= MAX_WEBHOOK_ATTEMPTS; attempt++) {
    const logContext = { jobId, url, attempt, maxAttempts: MAX_WEBHOOK_ATTEMPTS };

    try {
      // Use a new AbortController for each attempt to manage timeouts.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      logger.debug(logContext, 'Attempting to send webhook...');

      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId); // Clear the timeout if the request completes in time.

      if (response.ok) {
        // A 2xx status code indicates success.
        logger.info(
          { ...logContext, status: response.status },
          'Webhook sent successfully.'
        );
        return { success: true, status: response.status, finalAttempt: attempt };
      }

      // Handle non-2xx but non-retriable server errors (e.g., 400, 401, 403, 404).
      // We don't retry these because they indicate a client-side or configuration error.
      if (response.status >= 400 && response.status < 500) {
        const responseBody = await response.text().catch(() => 'Could not read response body');
        logger.error(
          { ...logContext, status: response.status, responseBody },
          'Webhook failed with a client error. Will not retry.'
        );
        return { success: false, status: response.status, finalAttempt: attempt };
      }

      // For 5xx server errors or other unexpected statuses, we will retry.
      logger.warn(
        { ...logContext, status: response.status },
        'Webhook failed with a server-side error. Retrying...'
      );
    } catch (error) {
      // Handle network errors, timeouts, or other fetch-related exceptions.
      if (error.name === 'AbortError') {
        logger.warn(logContext, `Webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms. Retrying...`);
      } else {
        logger.warn(
          { ...logContext, err: { message: error.message, cause: error.cause } },
          'Webhook failed due to a network or fetch error. Retrying...'
        );
      }
    }

    // If this was not the last attempt, calculate backoff delay and wait.
    if (attempt < MAX_WEBHOOK_ATTEMPTS) {
      const backoffDelay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
      logger.info(`Waiting ${backoffDelay}ms before next webhook attempt.`);
      await delay(backoffDelay);
    }
  }

  // If all attempts fail, log the final failure.
  logger.error(
    { jobId, url, attempts: MAX_WEBHOOK_ATTEMPTS },
    'Webhook delivery failed after all retry attempts.'
  );

  return { success: false, status: null, finalAttempt: MAX_WEBHOOK_ATTEMPTS };
}