'use strict';

import { CookieJar } from 'tough-cookie';
import { load as cheerioLoad } from 'cheerio';
import UserAgent from 'user-agents';
import { executeRequest } from '../core/request-handler.js';
import { extractCsrfToken } from '../utils/csrf.js';
import { prepareRequestHeaders, generateUserAgent } from '../utils/headers.js';
import { BasePlugin } from '../plugins/base-plugin.js';

/**
 * @fileoverview The main `Session` class. Manages a cookie jar, navigation
 * history (for referers), and orchestrates requests, CSRF extraction, and
 * plugin hooks. This class is the primary interface for users of the library.
 */

/**
 * Represents a scraping session, maintaining state across multiple HTTP requests.
 *
 * The Session class encapsulates a cookie jar, navigation history, and CSRF tokens
 * to simulate a continuous user session on a website. It provides a high-level
 * API for making `GET` and `POST` requests, automatically handling the complexities
 * of session management.
 *
 * It is designed to be resilient and flexible, with built-in retry mechanisms,
 * User-Agent rotation, and a pluggable architecture for extending its capabilities.
 */
export class Session {
  /**
   * The cookie jar for this session.
   * @type {import('tough-cookie').CookieJar}
   * @public
   */
  cookieJar;

  /**
   * An array of registered plugins.
   * @type {import('../plugins/base-plugin.js').BasePlugin[]}
   * @private
   */
  #plugins = [];

  /**
   * The navigation history, used for setting the Referer header.
   * The most recently visited URL is at the end of the array.
   * @type {URL[]}
   * @private
   */
  #navigationHistory = [];

  /**
   * The current User-Agent string for the session.
   * @type {string}
   * @private
   */
  #userAgent;

  /**
   * The strategy for rotating the User-Agent.
   * @type {'per-session' | 'per-request'}
   * @private
   */
  #userAgentRotation;

  /**
   * Default headers to be sent with every request in this session.
   * @type {Record<string, string | string[]>}
   * @private
   */
  #sessionHeaders;

  /**
   * Default options for the `p-retry` library.
   * @type {import('p-retry').Options}
   * @private
   */
  #retryOptions;

  /**
   * The most recently extracted CSRF token.
   * @type {string | null}
   * @public
   */
  csrfToken = null;

  /**
   * The most recent response object from a request.
   * @type {import('./session.js').SessionResponse | null}
   * @public
   */
  lastResponse = null;

  /**
   * Creates a new scraping session.
   * @param {object} [options={}] - Configuration options for the session.
   * @param {Record<string, string | string[]>} [options.headers={}] - Default headers to send with every request.
   * @param {string} [options.userAgent] - A specific User-Agent to use. If not provided, a random one is generated.
   * @param {'per-session' | 'per-request'} [options.userAgentRotation='per-session'] - Strategy for rotating the User-Agent.
   * @param {import('p-retry').Options} [options.retryOptions={}] - Default options for `p-retry` (e.g., `retries`, `minTimeout`).
   */
  constructor(options = {}) {
    this.cookieJar = new CookieJar();
    this.#sessionHeaders = options.headers ?? {};
    this.#userAgentRotation = options.userAgentRotation ?? 'per-session';
    this.#userAgent = options.userAgent ?? generateUserAgent();
    this.#retryOptions = { retries: 3, minTimeout: 1000, ...options.retryOptions };
  }

  /**
   * Registers a plugin with the session.
   * Plugins can hook into the request lifecycle to add functionality like
   * proxy management or captcha solving.
   *
   * @param {import('../plugins/base-plugin.js').BasePlugin} plugin - The plugin instance to register.
   * @returns {this} The session instance for chaining.
   * @throws {TypeError} If the provided plugin is not an instance of BasePlugin.
   */
  use(plugin) {
    if (!(plugin instanceof BasePlugin)) {
      throw new TypeError('Plugin must be an instance of BasePlugin or its subclass.');
    }
    plugin._attach(this);
    this.#plugins.push(plugin);
    return this;
  }

  /**
   * Makes a GET request.
   *
   * @param {string | URL} url - The URL to request.
   * @param {import('undici').RequestOptions} [options={}] - Request options, overriding session defaults.
   * @returns {Promise<import('./session.js').SessionResponse>} A promise that resolves to the session response.
   */
  async get(url, options = {}) {
    const requestOptions = {
      ...options,
      method: 'GET',
    };
    return this.#request(url, requestOptions);
  }

  /**
   * Makes a POST request.
   *
   * @param {string | URL} url - The URL to post to.
   * @param {string | Buffer | object | URLSearchParams} [body] - The request body.
   * @param {import('undici').RequestOptions} [options={}] - Request options, overriding session defaults.
   * @returns {Promise<import('./session.js').SessionResponse>} A promise that resolves to the session response.
   */
  async post(url, body, options = {}) {
    const requestOptions = {
      ...options,
      method: 'POST',
      body: body,
    };
    return this.#request(url, requestOptions);
  }

  /**
   * The core request method that orchestrates the entire request lifecycle.
   *
   * @param {string | URL} url - The target URL.
   * @param {import('undici').RequestOptions} options - The request options.
   * @returns {Promise<import('./session.js').SessionResponse>} The processed session response.
   * @private
   */
  async #request(url, options) {
    const targetUrl = url instanceof URL ? url : new URL(url);

    // Rotate User-Agent if configured to do so per request.
    if (this.#userAgentRotation === 'per-request') {
      this.#userAgent = generateUserAgent();
    }

    // Prepare all headers for the request.
    const finalHeaders = prepareRequestHeaders({
      sessionHeaders: this.#sessionHeaders,
      requestHeaders: options.headers,
      userAgent: this.#userAgent,
      navigationHistory: this.#navigationHistory,
    });

    const requestOptions = {
      ...options,
      headers: finalHeaders,
      maxRedirections: 0, // We handle navigation manually.
    };

    const context = {
      cookieJar: this.cookieJar,
      plugins: this.#plugins,
      retryOptions: this.#retryOptions,
    };

    const response = await executeRequest(targetUrl, requestOptions, context);

    // Update navigation history only for successful GET requests.
    // This prevents POST requests or API calls from polluting the "Referer" history.
    if (requestOptions.method === 'GET') {
      this.#navigationHistory.push(targetUrl);
    }

    const body = await response.body.text();
    const sessionResponse = this.#buildSessionResponse(response, body);

    // Automatically parse and store CSRF token from the response body.
    const newCsrfToken = extractCsrfToken(body);
    if (newCsrfToken) {
      this.csrfToken = newCsrfToken;
    }

    this.lastResponse = sessionResponse;
    return sessionResponse;
  }

  /**
   * Constructs a standardized `SessionResponse` object.
   *
   * @param {import('undici').Dispatcher.ResponseData} undiciResponse - The raw response from `undici`.
   * @param {string} body - The response body as a string.
   * @returns {import('./session.js').SessionResponse} The constructed session response.
   * @private
   */
  #buildSessionResponse(undiciResponse, body) {
    let memoizedCheerio = null;

    return {
      statusCode: undiciResponse.statusCode,
      headers: undiciResponse.headers,
      body,
      json: () => JSON.parse(body),
      get $() {
        if (memoizedCheerio === null) {
          memoizedCheerio = cheerioLoad(body);
        }
        return memoizedCheerio;
      },
    };
  }

  /**
   * Gets the current User-Agent string.
   * @returns {string} The User-Agent.
   */
  getUserAgent() {
    return this.#userAgent;
  }

  /**
   * Gets the current navigation history.
   * @returns {URL[]} A copy of the navigation history array.
   */
  getNavigationHistory() {
    return [...this.#navigationHistory];
  }

  /**
   * Clears the session's navigation history. This will result in no
   * `Referer` header being sent on the next request.
   */
  clearHistory() {
    this.#navigationHistory = [];
  }
}

/**
 * Factory function to create a new `Session` instance.
 * This is the recommended way to start a new scraping session.
 *
 * @param {object} [options={}] - Configuration options passed to the `Session` constructor.
 * @returns {Session} A new `Session` instance.
 */
export function createSession(options) {
  return new Session(options);
}

/**
 * @typedef {object} SessionResponse
 * @property {number} statusCode - The HTTP status code of the response.
 * @property {import('http').IncomingHttpHeaders} headers - The response headers.
 * @property {string} body - The raw response body as a string.
 * @property {() => any} json - A function to parse the response body as JSON.
 * @property {import('cheerio').CheerioAPI} $ - A Cheerio instance loaded with the response body for easy DOM traversal. Lazily loaded on first access.
 */