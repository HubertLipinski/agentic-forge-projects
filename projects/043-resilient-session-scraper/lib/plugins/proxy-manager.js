'use strict';

import { Agent } from 'undici';
import { BasePlugin } from './base-plugin.js';

/**
 * @fileoverview An example plugin for managing a pool of proxies and attaching them to outgoing requests.
 *
 * This module provides the `ProxyManager` class, a concrete implementation of `BasePlugin`.
 * It demonstrates how to create a plugin that manages a list of proxy servers and rotates
 * through them for each request made by a `Session`. This is a common requirement for
 * large-scale scraping to avoid IP-based rate limiting or blocks.
 *
 * The plugin works by intercepting requests before they are sent (using the `preRequest` hook)
 * and injecting an `undici` `Agent` configured with the next available proxy. It also includes
* logic to handle proxy rotation and to mark proxies as "bad" if a request fails,
 * preventing their reuse for a configurable amount of time.
 */

/**
 * Manages a pool of proxy servers and attaches them to session requests.
 *
 * This plugin rotates through a provided list of proxies, assigning a new one
 * to each outgoing request. It uses the `preRequest` and `onRequestError`
 * lifecycle hooks to manage proxy assignment and handle failures.
 *
 * When a request fails, the proxy used for that request can be temporarily
* disabled to prevent it from being used again immediately.
 *
 * @example
 * // Proxy format: 'http://user:pass@host:port'
 * const proxies = [
 *   'http://proxyuser1:pa55w0rd@proxy.example.com:8080',
 *   'http://proxyuser2:pa55w0rd@proxy.example.com:8081',
 * ];
 * const proxyManager = new ProxyManager({ proxies });
 * session.use(proxyManager);
 */
export class ProxyManager extends BasePlugin {
  /**
   * The list of proxy URLs.
   * @type {URL[]}
   * @private
   */
  #proxies = [];

  /**
   * The index of the next proxy to use from the #proxies array.
   * @type {number}
   * @private
   */
  #currentIndex = 0;

  /**
   * A map to track temporarily disabled proxies and their re-enable timestamps.
   * Key: proxy URL string, Value: timestamp (in ms) when the proxy can be used again.
   * @type {Map<string, number>}
   * @private
   */
  #badProxies = new Map();

  /**
   * The duration (in milliseconds) to disable a proxy after a request failure.
   * @type {number}
   * @private
   */
  #banDurationMs;

  /**
   * A map to store active `undici` Agent instances for each proxy.
   * This avoids creating a new Agent for every request, improving performance.
   * @type {Map<string, Agent>}
   * @private
   */
  #agentCache = new Map();

  /**
   * Creates an instance of ProxyManager.
   *
   * @param {object} options - The configuration options for the proxy manager.
   * @param {string[]} options.proxies - An array of proxy URLs in the format 'http://[user:pass@]host:port'.
   * @param {number} [options.banDuration=300000] - The time in milliseconds to disable a proxy after a request fails (defaults to 5 minutes).
   * @throws {TypeError} If `proxies` is not a non-empty array of strings.
   */
  constructor({ proxies, banDuration = 300000 }) {
    super('ProxyManager');

    if (!Array.isArray(proxies) || proxies.length === 0) {
      throw new TypeError('The "proxies" option must be a non-empty array of proxy URL strings.');
    }

    this.#proxies = proxies.map(p => {
      try {
        return new URL(p);
      } catch (error) {
        throw new TypeError(`Invalid proxy URL format: "${p}". Cause: ${error.message}`);
      }
    });

    this.#banDurationMs = banDuration;
  }

  /**
   * Selects the next available proxy from the pool.
   *
   * It rotates through the proxy list and skips any that are temporarily
   * disabled. If all proxies are disabled, it returns null.
   *
   * @returns {URL | null} The next available proxy URL, or null if none are available.
   * @private
   */
  #getNextAvailableProxy() {
    if (this.#proxies.length === 0) {
      return null;
    }

    // Clean up expired entries from the bad proxies map to prevent memory leaks.
    const now = Date.now();
    for (const [proxy, expiry] of this.#badProxies.entries()) {
      if (now >= expiry) {
        this.#badProxies.delete(proxy);
      }
    }

    const initialIndex = this.#currentIndex;
    let attempts = 0;

    while (attempts < this.#proxies.length) {
      const proxy = this.#proxies[this.#currentIndex];
      const proxyHref = proxy.href;

      // Move to the next index for the subsequent call (round-robin).
      this.#currentIndex = (this.#currentIndex + 1) % this.#proxies.length;

      if (!this.#badProxies.has(proxyHref)) {
        return proxy;
      }

      attempts++;
    }

    // If we've looped through all proxies and they are all banned.
    console.warn('[ProxyManager] All proxies are currently disabled. No proxy will be used for this request.');
    // Reset index to start from the beginning on the next attempt.
    this.#currentIndex = initialIndex;
    return null;
  }

  /**
   * Retrieves or creates an `undici` Agent for a given proxy URL.
   * Caches the agent to improve performance by reusing TCP connections.
   *
   * @param {URL} proxyUrl - The URL of the proxy server.
   * @returns {Agent} An `undici` Agent configured for the proxy.
   * @private
   */
  #getOrCreateAgent(proxyUrl) {
    const proxyHref = proxyUrl.href;
    if (this.#agentCache.has(proxyHref)) {
      return this.#agentCache.get(proxyHref);
    }

    const agent = new Agent({
      connect: {
        // undici's Agent expects the proxy URI as a string.
        proxy: proxyHref,
        // You can add TLS options here if your proxy requires a custom CA, etc.
        // e.g., tls: { ca: fs.readFileSync('my-proxy-ca.crt') }
      },
    });

    this.#agentCache.set(proxyHref, agent);
    return agent;
  }

  /**
   * Lifecycle hook called before a request is made.
   *
   * It selects the next available proxy, creates or retrieves an `undici` Agent
   * for it, and attaches the Agent as the `dispatcher` in the request options.
   * This effectively routes the request through the chosen proxy.
   *
   * @param {URL} url - The URL of the outgoing request.
   * @param {import('undici').RequestOptions} requestOptions - The options for the `undici` request. This object is mutated.
   * @returns {Promise<void>}
   */
  async preRequest(url, requestOptions) {
    const proxy = this.#getNextAvailableProxy();

    if (!proxy) {
      // No available proxy, the request will proceed without one.
      return;
    }

    const agent = this.#getOrCreateAgent(proxy);
    requestOptions.dispatcher = agent;

    // Store the proxy href in the request context for error handling.
    // This is a conventional way to pass metadata through the request lifecycle.
    if (!requestOptions.context) {
      requestOptions.context = {};
    }
    requestOptions.context.proxyHref = proxy.href;
  }

  /**
   * Lifecycle hook called when a request fails.
   *
   * If the failed request was using a proxy (identified by `context.proxyHref`),
   * this method marks that proxy as "bad" by adding it to the `#badProxies` map
   * with an expiry timestamp. This prevents it from being used for the duration
   * specified in `banDuration`.
   *
   * @param {Error} error - The error that caused the request to fail.
   * @param {URL} url - The URL of the failed request.
   * @param {import('undici').RequestOptions | undefined} requestOptions - The options used for the failed request.
   * @returns {Promise<void>}
   */
  async onRequestError(error, url, requestOptions) {
    const proxyHref = requestOptions?.context?.proxyHref;

    if (proxyHref) {
      const expiryTime = Date.now() + this.#banDurationMs;
      this.#badProxies.set(proxyHref, expiryTime);
      console.warn(`[ProxyManager] Request to ${url.href} failed using proxy ${proxyHref}. Disabling it for ${this.#banDurationMs / 1000}s. Error: ${error.message}`);
    }
  }
}