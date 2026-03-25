'use strict';

import UserAgent from 'user-agents';

/**
 * @fileoverview Utility functions for managing and normalizing HTTP headers.
 * This module provides helpers for handling common headers like User-Agent,
 * Referer, and for normalizing header keys to a consistent format.
 */

/**
 * A set of default headers commonly sent by modern web browsers.
 * These serve as a base to make requests look more authentic.
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_BROWSER_HEADERS = Object.freeze({
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  'sec-ch-ua': '"Not/A)Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
});

/**
 * Normalizes an object of HTTP headers by converting all keys to lowercase.
 * This ensures consistency, as HTTP header names are case-insensitive.
 * It handles various input types gracefully (objects, arrays of key-value pairs).
 *
 * @param {Record<string, string | string[]> | [string, string | string[]][] | undefined | null} headers - The headers to normalize.
 * @returns {Record<string, string | string[]>} A new object with lowercase header keys. Returns an empty object if input is invalid.
 */
export function normalizeHeaders(headers) {
  const normalized = {};
  if (!headers) {
    return normalized;
  }

  const entries = Array.isArray(headers) ? headers : Object.entries(headers);

  for (const [key, value] of entries) {
    if (key && value !== undefined && value !== null) {
      normalized[key.toLowerCase()] = value;
    }
  }
  return normalized;
}

/**
 * Merges multiple header objects into a single object.
 * Headers from later objects overwrite those from earlier ones, with case-insensitivity.
 * The resulting object has all keys in lowercase.
 *
 * @param {...(Record<string, string | string[]> | undefined | null)} headerObjects - A sequence of header objects to merge.
 * @returns {Record<string, string | string[]>} A new, merged header object.
 */
export function mergeHeaders(...headerObjects) {
  return headerObjects.reduce((acc, currentHeaders) => {
    if (!currentHeaders) {
      return acc;
    }
    // Normalizing ensures case-insensitive merging
    const normalizedCurrent = normalizeHeaders(currentHeaders);
    return { ...acc, ...normalizedCurrent };
  }, {});
}

/**
 * Generates a realistic User-Agent string.
 * This function uses the 'user-agents' library to create a plausible
 * User-Agent based on common browser and device profiles.
 *
 * @returns {string} A randomly generated User-Agent string.
 */
export function generateUserAgent() {
  // The user-agents library can sometimes return an object with a `toString` method
  // instead of a raw string. Calling `toString()` ensures we always get a string.
  const userAgent = new UserAgent();
  return userAgent.toString();
}

/**
 * Determines the appropriate Referer header for a new request based on navigation history.
 * The Referer should be the URL of the previous page in the session's navigation history.
 *
 * @param {URL[]} navigationHistory - An array of URL objects representing the user's path, with the most recent URL last.
 * @returns {string | undefined} The Referer URL string, or undefined if there is no history.
 */
export function getReferer(navigationHistory) {
  if (!Array.isArray(navigationHistory) || navigationHistory.length === 0) {
    return undefined;
  }
  // The referer is the last URL visited.
  const lastUrl = navigationHistory[navigationHistory.length - 1];
  return lastUrl?.href;
}

/**
 * Prepares the final headers for an outgoing request.
 * It merges default, session, and request-specific headers, and then
 * intelligently adds the User-Agent and Referer if they are not already set.
 *
 * @param {object} options - The options for preparing headers.
 * @param {Record<string, string | string[]>} [options.sessionHeaders={}] - Headers configured at the session level.
 * @param {Record<string, string | string[]>} [options.requestHeaders={}] - Headers specified for this particular request.
 * @param {string | undefined} [options.userAgent] - The User-Agent string to use.
 * @param {URL[]} [options.navigationHistory=[]] - The session's navigation history for determining the Referer.
 * @returns {Record<string, string | string[]>} The final, consolidated headers object.
 */
export function prepareRequestHeaders({
  sessionHeaders = {},
  requestHeaders = {},
  userAgent,
  navigationHistory = []
}) {
  // Merge headers: request-specific headers override session-level headers,
  // which in turn override the default browser headers.
  const combinedHeaders = mergeHeaders(
    DEFAULT_BROWSER_HEADERS,
    sessionHeaders,
    requestHeaders
  );

  // Set User-Agent if not already provided in session/request headers.
  if (!combinedHeaders['user-agent'] && userAgent) {
    combinedHeaders['user-agent'] = userAgent;
  }

  // Set Referer if not already provided and navigation history is available.
  if (!combinedHeaders.referer) {
    const referer = getReferer(navigationHistory);
    if (referer) {
      combinedHeaders.referer = referer;
    }
  }

  return combinedHeaders;
}