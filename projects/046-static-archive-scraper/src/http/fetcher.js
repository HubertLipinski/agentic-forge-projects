/**
 * @file src/http/fetcher.js
 * @description Module for downloading web content using axios.
 *
 * This module provides a robust function for fetching resources from the web.
 * It is configured to handle different response types (text for HTML/CSS/JS,
 * and binary data for images/fonts), manage network errors gracefully, and
 * allow for a custom user-agent string to be sent with each request.
 */

import axios from 'axios';

/**
 * A centralized Axios instance.
 *
 * Using a single instance allows for default configurations to be set once,
 * such as a timeout, which is crucial for preventing the crawler from hanging
 * on unresponsive servers. This instance can be further configured for specific
 * requests if needed.
 */
const axiosInstance = axios.create({
  // Set a reasonable timeout for requests to avoid long hangs.
  // 15 seconds is a good balance between accommodating slow servers and failing fast.
  timeout: 15000,
  // Don't throw an error for non-2xx status codes. We want to inspect the
  // status code ourselves to provide more specific logging and handling.
  validateStatus: () => true,
});

/**
 * Fetches the content of a given URL.
 *
 * This function handles the download of both text-based content (like HTML, CSS)
 * and binary content (like images, fonts) by dynamically setting the `responseType`.
 * It gracefully handles network errors, non-successful HTTP status codes, and timeouts.
 *
 * @param {URL} urlObject - The URL object of the resource to fetch.
 * @param {string} userAgent - The user-agent string to use for the request.
 * @returns {Promise<{
 *   data: string | Buffer | null,
 *   contentType: string | null,
 *   status: number,
 *   ok: boolean
 * }>} An object containing the fetched data, content type, status code, and a boolean
 *       indicating if the request was successful (2xx status). `data` will be null on failure.
 */
export async function fetchUrl(urlObject, userAgent) {
  if (!(urlObject instanceof URL)) {
    throw new Error('Invalid argument: "urlObject" must be a URL object.');
  }
  if (!userAgent || typeof userAgent !== 'string') {
    throw new Error('Invalid argument: "userAgent" must be a non-empty string.');
  }

  const urlString = urlObject.href;
  const isBinary = /\.(jpg|jpeg|png|gif|webp|ico|woff|woff2|ttf|eot|otf|pdf)$/i.test(
    urlObject.pathname,
  );

  try {
    const response = await axiosInstance.get(urlString, {
      headers: {
        'User-Agent': userAgent,
        // Politely indicate that we accept compressed content.
        'Accept-Encoding': 'gzip, deflate, br',
      },
      // 'arraybuffer' is the universal choice for binary data.
      // 'text' is used for everything else to get proper string encoding.
      responseType: isBinary ? 'arraybuffer' : 'text',
    });

    const { status, headers, data } = response;
    const contentType = headers['content-type'] ?? null;
    const ok = status >= 200 && status < 300;

    if (!ok) {
      console.warn(
        `[Fetcher] Received non-successful status code ${status} for ${urlString}`,
      );
      return { data: null, contentType, status, ok };
    }

    // For binary data, axios returns an ArrayBuffer. We convert it to a Node.js Buffer
    // which is the standard for file I/O operations in Node.
    const responseData = isBinary ? Buffer.from(data) : data;

    return { data: responseData, contentType, status, ok };
  } catch (error) {
    // Handle various types of network errors that axios might throw.
    let errorMessage = `Failed to fetch ${urlString}.`;

    if (error.code === 'ECONNABORTED') {
      errorMessage += ' Reason: Request timed out.';
    } else if (error.request) {
      // The request was made but no response was received (e.g., DNS issue, network partition).
      errorMessage += ' Reason: No response received from server.';
    } else {
      // Something happened in setting up the request that triggered an Error.
      errorMessage += ` Reason: ${error.message}`;
    }

    console.error(`[Fetcher] ${errorMessage}`);

    return {
      data: null,
      contentType: null,
      // Use 0 or a custom code to indicate a network-level failure vs. an HTTP error status.
      status: 0,
      ok: false,
    };
  }
}