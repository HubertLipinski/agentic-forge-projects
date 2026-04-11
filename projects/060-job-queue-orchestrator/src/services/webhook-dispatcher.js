/**
 * src/services/webhook-dispatcher.js
 *
 * Handles sending webhook notifications for job status changes.
 *
 * This service is responsible for dispatching POST requests to configured webhook
 * URLs when a job completes or fails. It's designed to be resilient, with
 * features like a request timeout, a unique request ID for traceability, and
 * a custom User-Agent. It uses `undici`, a high-performance HTTP client,
 * for making the requests.
 */

import { request } from 'undici';
import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';
import { version } from '../../package.json' assert { type: 'json' };

const USER_AGENT = `JobQueueOrchestrator/${version}`;
const REQUEST_TIMEOUT_MS = 10000; // 10 seconds timeout for webhook requests

/**
 * Dispatches a webhook notification for a given job.
 *
 * It sends a POST request to the job's configured webhook URL with the job's
 * final state as the JSON payload. The function handles the entire lifecycle
 * of the request, including setting appropriate headers, handling timeouts,
 * and logging the outcome.
 *
 * This function is designed to be "fire-and-forget" from the caller's perspective;
 * it does not throw errors but logs them internally to prevent webhook delivery
 * failures from crashing the main application logic.
 *
 * @param {object} job - The job object that triggered the notification.
 * @returns {Promise<void>} A promise that resolves when the dispatch attempt is complete.
 */
export async function dispatchWebhook(job) {
  // A job must have a webhook URL defined in its options to be processed.
  const webhookUrl = job?.options?.webhookUrl;
  if (!webhookUrl) {
    // This is an expected case, so we log at a debug level.
    logger.debug({ jobId: job.id }, 'Job has no webhook URL, skipping dispatch.');
    return;
  }

  // Validate the URL format before attempting to send.
  try {
    // The URL constructor is a reliable way to validate a URL's structure.
    new URL(webhookUrl);
  } catch (error) {
    logger.error(
      { err: error, jobId: job.id, webhookUrl },
      'Invalid webhook URL format. Cannot dispatch.'
    );
    return;
  }

  const webhookId = `whook_${nanoid(16)}`;
  const log = logger.child({
    service: 'WebhookDispatcher',
    jobId: job.id,
    webhookId,
    webhookUrl,
  });

  log.info('Dispatching webhook...');

  try {
    const { statusCode, headers, body } = await request(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-Request-ID': webhookId, // For tracing on the receiver's end
      },
      body: JSON.stringify(job),
      // Timeout for the entire request/response cycle.
      bodyTimeout: REQUEST_TIMEOUT_MS,
      headersTimeout: REQUEST_TIMEOUT_MS,
    });

    // Consume the response body to free up resources, even if we don't use it.
    await body.dump();

    if (statusCode >= 200 && statusCode < 300) {
      log.info(
        { statusCode, responseHeaders: headers },
        'Webhook dispatched successfully.'
      );
    } else {
      // Log non-successful status codes as warnings.
      log.warn(
        { statusCode, responseHeaders: headers },
        'Webhook dispatch received a non-successful status code.'
      );
    }
  } catch (error) {
    // Catch and log any error during the request to prevent crashes.
    // This includes network errors, timeouts, DNS issues, etc.
    log.error({ err: error }, 'Webhook dispatch failed.');
  }
}