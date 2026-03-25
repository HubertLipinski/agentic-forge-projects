'use strict';

import { load } from 'cheerio';

/**
 * @fileoverview Utility functions for extracting CSRF tokens from HTML content.
 *
 * This module provides functions to parse an HTML body using Cheerio and find
 * CSRF tokens from common patterns, such as meta tags and hidden form input fields.
 * This is crucial for interacting with stateful websites that use CSRF protection
 * for forms (e.g., login, search, submissions).
 */

/**
 * A list of common names used for CSRF token meta tags.
 * The list is ordered by commonality to optimize search speed.
 * @type {Readonly<string[]>}
 */
const CSRF_META_TAG_NAMES = Object.freeze([
  'csrf-token',
  'x-csrf-token',
  'csrftoken',
  'xsrf-token',
  'x-xsrf-token',
  '_csrf',
]);

/**
 * A list of common names/IDs used for CSRF token hidden input fields.
 * The list is ordered by commonality to optimize search speed.
 * @type {Readonly<string[]>}
 */
const CSRF_INPUT_NAMES = Object.freeze([
  '_csrf',
  'csrf_token',
  'csrftoken',
  'authenticity_token',
  '_token',
  'YII_CSRF_TOKEN', // Yii framework
  '__RequestVerificationToken', // .NET
]);

/**
 * Finds a CSRF token from meta tags within the provided HTML content.
 * It searches for meta tags with `name` attributes matching a predefined list
 * of common CSRF token names and extracts the token from the `content` attribute.
 *
 * @param {import('cheerio').CheerioAPI} $ - The Cheerio instance loaded with the HTML document.
 * @returns {string | null} The found CSRF token, or null if no matching meta tag is found.
 */
function findTokenInMetaTags($) {
  for (const name of CSRF_META_TAG_NAMES) {
    // Search for a meta tag like: <meta name="csrf-token" content="TOKEN_VALUE">
    const token = $(`meta[name="${name}"]`).attr('content');
    if (token) {
      return token.trim();
    }
  }
  return null;
}

/**
 * Finds a CSRF token from hidden input fields within the provided HTML content.
 * It searches for `<input type="hidden">` elements with `name` or `id` attributes
 * matching a predefined list of common CSRF token names.
 *
 * @param {import('cheerio').CheerioAPI} $ - The Cheerio instance loaded with the HTML document.
 * @returns {string | null} The found CSRF token, or null if no matching input is found.
 */
function findTokenInInputs($) {
  for (const name of CSRF_INPUT_NAMES) {
    // Search for an input like: <input type="hidden" name="_csrf" value="TOKEN_VALUE">
    // We check both `name` and `id` attributes for wider compatibility.
    const token = $(`input[type="hidden"][name="${name}"], input[type="hidden"][id="${name}"]`).val();
    if (token) {
      return token.trim();
    }
  }
  return null;
}

/**
 * Extracts a CSRF token from an HTML string by searching for common patterns.
 *
 * The function prioritizes searching in meta tags first, as they are often
 * placed in the `<head>` for global availability (e.g., for AJAX requests).
 * If no token is found in meta tags, it then searches for hidden input fields
 * within forms.
 *
 * This function is designed to be robust and work with a variety of web frameworks
 * and their default CSRF protection mechanisms.
 *
 * @param {string | Buffer} htmlBody - The HTML content to parse.
 * @returns {string | null} The extracted CSRF token, or null if no token could be found.
 * @throws {TypeError} If `htmlBody` is not a string or Buffer.
 */
export function extractCsrfToken(htmlBody) {
  if (typeof htmlBody !== 'string' && !Buffer.isBuffer(htmlBody)) {
    throw new TypeError('htmlBody must be a string or a Buffer.');
  }

  try {
    const $ = load(htmlBody);

    // Strategy 1: Look for the token in meta tags.
    const metaToken = findTokenInMetaTags($);
    if (metaToken) {
      return metaToken;
    }

    // Strategy 2: Look for the token in hidden form inputs.
    const inputToken = findTokenInInputs($);
    if (inputToken) {
      return inputToken;
    }

    // If no token is found after checking all common patterns.
    return null;
  } catch (error) {
    // This might happen if Cheerio fails to parse malformed HTML.
    // We'll log the error and return null to avoid crashing the scraper.
    console.error('Failed to parse HTML for CSRF token extraction:', error.message);
    return null;
  }
}