/**
 * @file src/monitors/api-request.js
 * @description Patches or listens to the discord.js REST manager to track API request rates, response times, and identify 429 responses.
 *
 * This monitor is critical for understanding the bot's interaction with the Discord API,
 * ensuring it stays within rate limits and identifying slow API endpoints.
 *
 * It works by directly listening to the `request` and `response` events emitted by
 * the `client.rest` manager in discord.js v14. This is a clean, non-intrusive way
 * to gain visibility into every API call the bot makes.
 *
 * For each request, it:
 * 1. Starts a high-resolution timer when the request is sent.
 * 2. On response, it stops the timer and calculates the latency.
 * 3. It records the latency and status code into Prometheus metrics.
 * 4. It increments a `TimeSeries` aggregator to track the request rate (e.g., requests per minute).
 * 5. It specifically tracks 429 "Too Many Requests" responses, which are a key indicator of rate limit issues.
 */

import { TimeSeries } from '../lib/aggregators/time-series.js';
import { metrics } from '../metrics/prometheus.js';

/**
 * A time-series aggregator to track the number of API requests per minute.
 * It uses 60 one-second buckets.
 */
export const apiRequestRateAggregator = new TimeSeries({
  bucketSizeMs: 1000,
  windowSize: 60,
});

/**
 * A time-series aggregator to specifically track the rate of 429 (rate limited) responses.
 */
export const apiRateLimitAggregator = new TimeSeries({
  bucketSizeMs: 1000,
  windowSize: 60,
});

/**
 * A WeakMap to store the start time of each API request.
 * Using a WeakMap is crucial here. The `request` object from discord.js is the key.
 * If the request is garbage-collected for any reason (e.g., an error during processing),
 * the WeakMap will not prevent it, avoiding memory leaks.
 * @type {WeakMap<object, [number, number]>}
 */
const requestStartTimes = new WeakMap();

/**
 * Normalizes a Discord API route to create a consistent, low-cardinality metric label.
 * This prevents creating a new Prometheus time series for every unique resource ID.
 *
 * Example:
 * - `/channels/123456789012345678/messages` -> `/channels/{id}/messages`
 * - `/users/@me` -> `/users/@me`
 * - `/guilds/987654321098765432/members/112233445566778899` -> `/guilds/{id}/members/{id}`
 *
 * @param {string} path - The raw API path from discord.js.
 * @returns {string} The normalized path.
 */
function normalizeApiPath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    return '/unknown';
  }
  // Replace any sequence of 17-20 digits (typical for snowflakes) with '{id}'.
  // The 'g' flag ensures all occurrences are replaced.
  return path.replace(/\/\d{17,20}/g, '/{id}');
}

/**
 * Handles the 'request' event from the discord.js REST manager.
 * This function is called just before an API request is sent.
 *
 * @param {import('discord.js').RequestData} request - The data for the outgoing request.
 */
function handleApiRequest(request) {
  // The `request` object itself is a stable reference we can use as a key.
  // We store a high-resolution timestamp to measure latency accurately.
  requestStartTimes.set(request, process.hrtime());
}

/**
 * Handles the 'response' event from the discord.js REST manager.
 * This function is called when a response (or error) is received for an API request.
 *
 * @param {import('discord.js').RequestData} request - The original request data.
 * @param {import('undici').Response} response - The response received from the API.
 */
function handleApiResponse(request, response) {
  const startTime = requestStartTimes.get(request);

  // If we don't have a start time, we can't measure latency. This might happen
  // if the monitor was attached after a request was already in-flight.
  if (!startTime) {
    return;
  }

  // The request is complete, so we can remove its start time from the map.
  requestStartTimes.delete(request);

  const elapsed = process.hrtime(startTime);
  const latencyMs = elapsed[0] * 1000 + elapsed[1] / 1e6;
  const latencySec = latencyMs / 1000;

  const method = request.method.toUpperCase();
  const path = normalizeApiPath(request.path);
  const statusCode = response.status;

  // --- Update Prometheus Metrics ---

  // Record the request latency.
  metrics.apiRequestLatency.observe({ method, path }, latencySec);

  // Increment the total request counter.
  metrics.apiRequestCounter.inc({ method, path, status_code: statusCode });

  // --- Update Internal Aggregators ---

  // Increment the rolling request rate counter.
  apiRequestRateAggregator.add(1);

  // If we were rate limited, increment the specific rate limit counter.
  if (statusCode === 429) {
    apiRateLimitAggregator.add(1);
    console.warn(`Discord API rate limit hit: ${method} ${request.path}`);
  }
}

/**
 * Attaches the API request monitor to a Discord client.
 * It hooks into the `client.rest` events to track API performance.
 *
 * @param {import('discord.js').Client} client - The Discord client instance.
 */
export function attachApiRequestMonitor(client) {
  if (!client?.rest) {
    console.error('Invalid Discord client or REST manager provided to attachApiRequestMonitor.');
    return;
  }

  // Wrap handlers in try-catch blocks to prevent the monitor from crashing the bot.
  // An error in monitoring should never impact the bot's core functionality.
  const safeRequestHandler = (request) => {
    try {
      handleApiRequest(request);
    } catch (error) {
      console.error('Error in API request handler (pre-request):', error);
    }
  };

  const safeResponseHandler = (request, response) => {
    try {
      handleApiResponse(request, response);
    } catch (error) {
      console.error('Error in API response handler (post-request):', error);
    }
  };

  // The 'request' event is emitted before a request is made.
  client.rest.on('request', safeRequestHandler);

  // The 'response' event is emitted when a response is received.
  client.rest.on('response', safeResponseHandler);

  // The 'rateLimited' event is another way to catch 429s, but 'response' is more general.
  // Listening to it can provide more detailed rate limit info if needed in the future.
  // For now, checking the status code in 'response' is sufficient.

  console.log('API Request Monitor attached.');
}