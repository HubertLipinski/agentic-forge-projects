/**
 * @fileoverview Core fetching logic for the Adaptive Scraper Cluster.
 *
 * This module, the Request Dispatcher, is responsible for executing individual
 * HTTP requests for scraping jobs. It's a critical component that integrates
 * several services to build and dispatch robust, stealthy requests:
 *
 * - `undici`: For high-performance, modern HTTP/1.1 and H2 requests.
 * - `ProxyManager`: To obtain a proxy for the request, enabling IP rotation.
 * - `UserAgentRotator`: To get a random User-Agent header, mimicking different clients.
 * - `FeedbackGovernor`: To apply an adaptive delay before the request, based on
 *   the target host's recent behavior, and to report the outcome of the request
 *   for future adjustments.
 *
 * The dispatcher handles request construction, execution, response handling,
 * and error management, providing a clean, high-level interface to the `worker`.
 */

import { request, ProxyAgent } from 'undici';
import { getLogger } from '../utils/logger.js';
import proxyManager from '../services/proxy-manager.js';
import uaRotator from '../services/ua-rotator.js';
import feedbackGovernor from '../services/feedback-governor.js';

const logger = getLogger().child({ service: 'RequestDispatcher' });

/**
 * A utility function to introduce a delay.
 *
 * @param {number} ms - The duration to wait in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified duration.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a single scraping request for a given job.
 *
 * This is the main function of the module. It orchestrates the entire process
 * of making a request:
 * 1. Extracts the target URL and hostname from the job.
 * 2. Retrieves a proxy and a random User-Agent.
 * 3. Fetches the adaptive delay required for the target host from the FeedbackGovernor.
 * 4. Applies the delay.
 * 5. Constructs and dispatches the HTTP request using `undici`, with the
 *    configured proxy, headers, method, and body.
 * 6. Analyzes the response to determine if it was successful or blocked.
 * 7. Reports the outcome back to the ProxyManager and FeedbackGovernor.
 * 8. Returns the response body and status for further processing (parsing).
 *
 * @param {object} job - The job object containing URL, HTTP settings, and metadata.
 * @returns {Promise<{body: string, statusCode: number, finalUrl: string}>} An object containing the response body, status code, and the final URL after any redirects.
 * @throws {Error} Throws an error if the request fails irrecoverably (e.g., network error, DNS failure).
 */
export async function dispatchRequest(job) {
  const { url, http = {} } = job;
  const { method = 'GET', headers: jobHeaders = {}, body: jobBody } = http;
  const jobId = job.id;

  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch (error) {
    logger.error({ jobId, url, err: error.message }, 'Invalid URL in job definition.');
    throw new Error(`Invalid URL: ${url}`);
  }

  const host = targetUrl.hostname;
  const requestLogger = logger.child({ jobId, host });

  // 1. Get a proxy from the manager.
  const proxy = proxyManager.getNextProxy();

  // 2. Get a random User-Agent.
  const userAgent = uaRotator.getRandomUserAgent();

  // 3. Get and apply the adaptive delay from the governor.
  const adaptiveDelay = await feedbackGovernor.getDelayForHost(host);
  if (adaptiveDelay > 0) {
    requestLogger.debug({ delay: adaptiveDelay }, `Applying adaptive delay for host.`);
    await delay(adaptiveDelay);
  }

  // 4. Construct request options.
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    ...jobHeaders, // User-defined headers override defaults.
  };

  if (userAgent) {
    headers['User-Agent'] = userAgent;
  }

  const requestOptions = {
    method,
    headers,
    // Allow up to 5 redirects by default.
    maxRedirections: 5,
    // Set a reasonable timeout for the entire request/response cycle.
    bodyTimeout: 30000, // 30 seconds
    headersTimeout: 30000, // 30 seconds
  };

  // Add a proxy agent if a proxy is available.
  if (proxy) {
    requestLogger.debug({ proxyUrl: proxy.url }, 'Using proxy for request.');
    requestOptions.dispatcher = new ProxyAgent(proxy.url);
  }

  // Add body for relevant methods.
  if (jobBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    if (typeof jobBody === 'object') {
      requestOptions.body = JSON.stringify(jobBody);
      // Ensure Content-Type is set for JSON bodies if not already specified.
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
    } else {
      requestOptions.body = String(jobBody);
    }
  }

  // 5. Dispatch the request and handle the response.
  let response;
  try {
    requestLogger.info({ method, url: targetUrl.href }, 'Dispatching request.');
    response = await request(targetUrl, requestOptions);

    const responseBody = await response.body.text();
    const { statusCode } = response;
    // The final URL after all redirects.
    const finalUrl = response.context?.history?.pop()?.href ?? url;

    requestLogger.info({ statusCode, finalUrl }, 'Received response.');

    // 6. Analyze and report the outcome.
    const isBlocked = feedbackGovernor.isBlocked(statusCode, responseBody);
    const wasSuccessful = !isBlocked && statusCode >= 200 && statusCode < 400;

    // Fire-and-forget feedback reporting.
    feedbackGovernor.reportResult(host, wasSuccessful).catch(err => {
      requestLogger.error({ err }, 'Failed to report result to FeedbackGovernor.');
    });
    if (proxy) {
      proxyManager.reportResult(proxy.url, wasSuccessful).catch(err => {
        requestLogger.error({ err, proxyUrl: proxy.url }, 'Failed to report result to ProxyManager.');
      });
    }

    return {
      body: responseBody,
      statusCode,
      finalUrl,
    };
  } catch (error) {
    requestLogger.error({ err: error.message, code: error.code }, 'Request failed.');

    // Report failure to governor and proxy manager for network-level errors.
    feedbackGovernor.reportResult(host, false).catch(err => {
      requestLogger.error({ err }, 'Failed to report failure to FeedbackGovernor.');
    });
    if (proxy) {
      proxyManager.reportResult(proxy.url, false).catch(err => {
        requestLogger.error({ err, proxyUrl: proxy.url }, 'Failed to report failure to ProxyManager.');
      });
    }

    // Re-throw a standardized error to be handled by the worker.
    throw new Error(`Request to ${url} failed: ${error.message}`);
  } finally {
    // Ensure the dispatcher is destroyed to close any underlying sockets,
    // especially important when using agents like ProxyAgent.
    if (requestOptions.dispatcher) {
      await requestOptions.dispatcher.close();
    }
  }
}