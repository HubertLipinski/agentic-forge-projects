/**
 * @fileoverview Fetches the raw XML content of a single feed URL.
 *
 * This module provides a robust function to download feed data from a given URL.
 * It leverages the high-performance `undici` library for HTTP requests and
 * incorporates essential features like custom user-agent headers, configurable
 * timeouts, and comprehensive error handling for network and server issues.
 *
 * @module src/core/fetcher
 */

import { request } from 'undici';
import { DEFAULT_REQUEST_TIMEOUT, USER_AGENT } from '../utils/constants.js';

/**
 * Fetches the raw XML content of a single RSS/Atom feed.
 *
 * This function performs an HTTP GET request to the specified URL. It handles
 * network errors, non-2xx status codes, and request timeouts gracefully.
 *
 * @async
 * @param {string} feedUrl - The URL of the feed to fetch.
 * @param {object} [options={}] - Configuration options for the fetch request.
 * @param {number} [options.timeout=DEFAULT_REQUEST_TIMEOUT] - The request timeout in milliseconds.
 * @returns {Promise<string>} A promise that resolves with the raw XML string content of the feed.
 * @throws {Error} Throws an error if the URL is invalid, the request fails,
 *                 the server responds with a non-200 status code, or the request times out.
 */
export async function fetchFeed(feedUrl, options = {}) {
  const { timeout = DEFAULT_REQUEST_TIMEOUT } = options;

  // 1. Validate the input URL to ensure it's a valid, parsable URL.
  let url;
  try {
    url = new URL(feedUrl);
  } catch (error) {
    // Re-throw with a more specific, user-friendly message.
    throw new Error(`Invalid URL provided: "${feedUrl}"`);
  }

  // 2. Perform the HTTP request using undici.
  try {
    const { statusCode, body } = await request(url, {
      method: 'GET',
      headers: {
        'user-agent': USER_AGENT,
        'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      // AbortSignal.timeout() is a modern, clean way to handle timeouts.
      signal: AbortSignal.timeout(timeout),
    });

    // 3. Check for successful response status code.
    if (statusCode !== 200) {
      // Consume the body to free resources, even if we don't use its content.
      await body.dump();
      throw new Error(`Failed to fetch feed from ${feedUrl}. Server responded with status code ${statusCode}.`);
    }

    // 4. Stream the response body to a string and return.
    return await body.text();

  } catch (error) {
    // 5. Handle different types of errors for better diagnostics.
    if (error.name === 'TimeoutError') {
      throw new Error(`Request to ${feedUrl} timed out after ${timeout}ms.`);
    }
    // Re-throw other network or undici-specific errors with context.
    // This preserves the original error stack while adding our own message.
    throw new Error(`Network error fetching feed from ${feedUrl}: ${error.message}`, { cause: error });
  }
}