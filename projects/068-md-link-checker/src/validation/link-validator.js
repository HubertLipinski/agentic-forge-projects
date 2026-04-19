/**
 * @file src/validation/link-validator.js
 * @description Handles the logic for checking a link's validity.
 * Uses `fs.promises.stat` for local file paths and Node's native `fetch`
 * for HTTP/HTTPS URLs.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { LINK_STATUS } from '../util/constants.js';

/**
 * Represents the result of a link validation check.
 * @typedef {object} ValidationResult
 * @property {string} url - The original URL that was checked.
 * @property {string} file - The file where the link was found.
 * @property {number} line - The line number of the link in the file.
 * @property {string} status - The validation status (e.g., 'VALID', 'BROKEN').
 * @property {number|string} [statusCode] - The HTTP status code for remote links, or an error code (e.g., 'ENOENT') for local links.
 * @property {string} [error] - A descriptive error message if the link is broken.
 */

/**
 * Checks if a given URL string is an absolute HTTP or HTTPS URL.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the URL is an absolute HTTP/HTTPS URL, false otherwise.
 */
function isHttpUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Validates a local file link by checking if the file exists on the filesystem.
 *
 * @param {string} linkUrl - The relative or absolute path of the link.
 * @param {string} sourceFilePath - The path of the Markdown file containing the link.
 * @returns {Promise<{status: string, statusCode?: string, error?: string}>} An object with the validation status.
 */
async function validateLocalLink(linkUrl, sourceFilePath) {
  try {
    // Resolve the link path relative to the directory of the source markdown file.
    const sourceDir = path.dirname(sourceFilePath);
    const absolutePath = path.resolve(sourceDir, linkUrl);

    // Check if the file or directory exists.
    await fs.stat(absolutePath);
    return { status: LINK_STATUS.VALID };
  } catch (error) {
    // fs.stat throws an error if the path does not exist.
    // We capture the specific error code (e.g., 'ENOENT' for 'not found').
    return {
      status: LINK_STATUS.BROKEN,
      statusCode: error.code || 'UNKNOWN',
      error: `Local file not found: ${error.message}`,
    };
  }
}

/**
 * Validates a remote HTTP/HTTPS link by making a network request.
 *
 * @param {string} url - The absolute URL to check.
 * @param {object} options - Configuration options for the request.
 * @param {number} options.timeout - The request timeout in milliseconds.
 * @param {string} options.userAgent - The User-Agent string for the request.
 * @returns {Promise<{status: string, statusCode?: number, error?: string}>} An object with the validation status.
 */
async function validateHttpLink(url, { timeout, userAgent }) {
  // AbortController is used to enforce the timeout, as `fetch` timeout is experimental.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to be efficient; we only need status, not content.
      headers: { 'User-Agent': userAgent },
      signal: controller.signal,
      redirect: 'follow', // Automatically follow redirects.
    });

    if (response.ok) {
      // Any 2xx status code is considered valid.
      return { status: LINK_STATUS.VALID, statusCode: response.status };
    } else {
      // 4xx and 5xx status codes indicate a broken link.
      return {
        status: LINK_STATUS.BROKEN,
        statusCode: response.status,
        error: `Request failed with status: ${response.status} ${response.statusText}`,
      };
    }
  } catch (error) {
    // Handle various network-related errors.
    let errorMessage = error.message;
    if (error.name === 'AbortError') {
      errorMessage = `Request timed out after ${timeout}ms`;
    } else if (error.cause) {
      // Provide more specific network error details if available.
      errorMessage = `${error.message} (cause: ${error.cause.code || 'Unknown'})`;
    }
    return {
      status: LINK_STATUS.BROKEN,
      statusCode: error.cause?.code || 'FETCH_ERROR',
      error: errorMessage,
    };
  } finally {
    // It's crucial to clear the timeout to prevent it from running
    // after the fetch operation has completed.
    clearTimeout(timeoutId);
  }
}

/**
 * Validates a single link, determining whether it's local or remote and
 * dispatching to the appropriate validation function.
 *
 * @param {import('../parser/markdown-parser.js').MarkdownLink} link - The link object to validate.
 * @param {object} config - The application configuration.
 * @param {number} config.timeout - The request timeout for remote links.
 * @param {string} config.userAgent - The User-Agent for remote links.
 * @returns {Promise<ValidationResult>} A promise that resolves to a validation result object.
 */
export async function validateLink(link, config) {
  const { url, file, line } = link;
  let result;

  try {
    if (isHttpUrl(url)) {
      // Validate as a remote HTTP/HTTPS link.
      result = await validateHttpLink(url, {
        timeout: config.timeout,
        userAgent: config.userAgent,
      });
    } else {
      // Validate as a local file path.
      result = await validateLocalLink(url, file);
    }
  } catch (error) {
    // This is a fallback for unexpected errors during validation logic.
    result = {
      status: LINK_STATUS.BROKEN,
      error: `An unexpected error occurred during validation: ${error.message}`,
    };
  }

  // Combine the original link info with the validation result.
  return {
    url,
    file,
    line,
    ...result,
  };
}