'use strict';

import { request } from 'undici';
import pRetry from 'p-retry';

/**
 * @fileoverview Core logic for making HTTP requests using `undici`,
 * integrated with `p-retry` for resiliency. Manages injecting cookies,
 * headers, and proxy info for each request.
 */

/**
 * A custom error class for HTTP-related failures that occur within the request handler.
 * This helps distinguish between generic errors and specific response-related issues.
 * It encapsulates the response status, headers, and body for easier debugging.
 */
class RequestHandlerError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {object} details - Additional details about the error.
   * @param {number} [details.statusCode] - The HTTP status code of the response.
   * @param {import('undici').Dispatcher.ResponseData['headers']} [details.headers] - The response headers.
   * @param {string} [details.body] - The response body text.
   */
  constructor(message, { statusCode, headers, body }) {
    super(message);
    this.name = 'RequestHandlerError';
    this.statusCode = statusCode;
    this.headers = headers;
    this.body = body;
    this.isRequestHandlerError = true; // For easy type checking without `instanceof`
  }
}

/**
 * Prepares the request body and corresponding 'Content-Type' header.
 * - For URLSearchParams, it sets 'application/x-www-form-urlencoded'.
 * - For objects, it stringifies them as JSON and sets 'application/json'.
 * - For strings or Buffers, it passes them through directly.
 *
 * @param {string | Buffer | object | URLSearchParams | undefined} body - The request body.
 * @param {Record<string, string | string[]>} headers - The request headers object, which may be mutated.
 * @returns {string | Buffer | undefined} The processed request body.
 */
function prepareRequestBody(body, headers) {
  if (body instanceof URLSearchParams) {
    headers['content-type'] = headers['content-type'] ?? 'application/x-www-form-urlencoded';
    return body.toString();
  }

  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    headers['content-type'] = headers['content-type'] ?? 'application/json; charset=utf-8';
    return JSON.stringify(body);
  }

  // String, Buffer, or undefined are returned as-is.
  return body;
}

/**
 * Executes an HTTP request with integrated retry logic and session management.
 * This is the central function for all outgoing requests from a `Session`.
 *
 * It orchestrates several key steps:
 * 1. Invokes `preRequest` hooks on all registered plugins.
 * 2. Prepares the request body and headers, including cookies.
 * 3. Uses `p-retry` to make the request resilient to transient network failures.
 * 4. Validates the HTTP response status code.
 * 5. Invokes `postRequest` or `onRequestError` plugin hooks based on the outcome.
 *
 * @param {URL} url - The target URL for the request.
 * @param {import('undici').RequestOptions} baseRequestOptions - The user-provided options for the `undici` request.
 * @param {object} context - The session context containing cookies, plugins, and retry options.
 * @param {import('tough-cookie').CookieJar} context.cookieJar - The session's cookie jar.
 * @param {import('../plugins/base-plugin.js').BasePlugin[]} context.plugins - An array of registered plugins.
 * @param {object} context.retryOptions - Options to be passed to `p-retry`.
 * @returns {Promise<import('undici').Dispatcher.ResponseData>} A promise that resolves with the final response data from `undici`.
 * @throws {RequestHandlerError} If the request fails after all retries, or if the response status is not acceptable.
 * @throws {pRetry.AbortError} If a non-retriable error occurs.
 */
export async function executeRequest(url, baseRequestOptions, context) {
  const { cookieJar, plugins, retryOptions } = context;

  // Deep clone options to prevent mutation of the original object passed by the user.
  const requestOptions = structuredClone(baseRequestOptions);

  // Ensure headers object exists and is normalized.
  requestOptions.headers = requestOptions.headers ?? {};

  // 1. Prepare body and set Content-Type if necessary.
  requestOptions.body = prepareRequestBody(requestOptions.body, requestOptions.headers);

  // 2. Set cookies from the jar.
  const cookieString = await cookieJar.getCookieString(url.href);
  if (cookieString) {
    requestOptions.headers.cookie = cookieString;
  }

  // 3. Run pre-request plugin hooks. Plugins can modify requestOptions.
  for (const plugin of plugins) {
    await plugin.preRequest(url, requestOptions);
  }

  // The main request function to be wrapped by p-retry.
  const makeRequest = async () => {
    let response;
    try {
      response = await request(url, requestOptions);
    } catch (error) {
      // Let p-retry handle network errors, connection issues, etc.
      throw error;
    }

    // 4. Validate response status code.
    // By default, we consider 2xx (success) and 3xx (redirection) as valid.
    // Redirections are not followed automatically (`maxRedirections: 0`),
    // allowing the Session class to manage navigation history.
    if (response.statusCode < 200 || response.statusCode >= 400) {
      const responseBodyText = await response.body.text();
      const error = new RequestHandlerError(
        `Request failed with status code ${response.statusCode}`,
        {
          statusCode: response.statusCode,
          headers: response.headers,
          body: responseBodyText,
        }
      );

      // For server errors (5xx), we allow retries. For client errors (4xx), we abort.
      // This prevents retrying requests that are fundamentally invalid (e.g., 404 Not Found, 403 Forbidden).
      if (response.statusCode >= 400 && response.statusCode < 500) {
        throw new pRetry.AbortError(error);
      }

      throw error;
    }

    return response;
  };

  try {
    // 5. Execute the request with retry logic.
    const response = await pRetry(makeRequest, {
      ...retryOptions,
      onFailedAttempt: async (error) => {
        // This hook is called by p-retry on each failed attempt.
        // We use it to notify plugins about the transient failure.
        // Note: `error.cause` is used if it's an AbortError from a 4xx status.
        const underlyingError = error instanceof pRetry.AbortError ? error.cause : error;
        for (const plugin of plugins) {
          // Pass the original request options to the error hook for context.
          await plugin.onRequestError(underlyingError, url, requestOptions);
        }
        // Re-call the original onFailedAttempt if the user provided one.
        if (retryOptions.onFailedAttempt) {
          await retryOptions.onFailedAttempt(error);
        }
      },
    });

    // 6. Process `set-cookie` headers from the successful response.
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      for (const cookie of cookies) {
        await cookieJar.setCookie(cookie, url.href);
      }
    }

    // 7. Run post-request plugin hooks for success.
    for (const plugin of plugins) {
      await plugin.postRequest(response);
    }

    return response;
  } catch (error) {
    // This block catches the final error after all retries are exhausted,
    // or an AbortError from a non-retriable condition.
    const finalError = error instanceof pRetry.AbortError ? error.cause : error;

    // We re-throw the underlying error to provide a cleaner stack trace and error object to the caller.
    throw finalError;
  }
}