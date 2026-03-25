'use strict';

/**
 * @fileoverview Defines the base class and interface for plugins.
 *
 * This module provides the `BasePlugin` class, which serves as a blueprint
 * for all plugins within the Resilient Session Scraper ecosystem. Plugins
 * are designed to extend the core functionality of a session, allowing for
 * custom behaviors like proxy management, captcha solving, or advanced
 * header manipulation.
 *
 * By extending `BasePlugin`, developers can create new plugins that are
 * guaranteed to be compatible with the `Session` class's lifecycle hooks.
 * The base class provides a standardized structure, including a name,
 * a reference to the session it's attached to, and a set of lifecycle
 * methods that the session will call at specific points during a request.
 */

/**
 * Represents the base class for all plugins.
 *
 * A plugin is an object that can hook into the request lifecycle of a `Session`
 * to modify requests or handle specific responses. This class defines the
 * standard interface that all plugins must implement.
 *
 * The lifecycle methods are designed to be asynchronous to accommodate I/O
 * operations, such as fetching a proxy from a remote service or calling a
 * captcha solving API.
 *
 * @abstract
 */
export class BasePlugin {
  /**
   * The unique name of the plugin. This is used for identification and
   * potential debugging. It should be a simple, descriptive string.
   * @type {string}
   * @public
   */
  name;

  /**
   * A reference to the `Session` instance this plugin is attached to.
   * This is set automatically by the `Session` when the plugin is registered,
   * allowing the plugin to access session state if needed (e.g., cookies,
   * navigation history).
   * @type {import('../session.js').Session | null}
   * @protected
   */
  _session = null;

  /**
   * Creates an instance of a BasePlugin.
   * @param {string} name - The unique name for the plugin.
   * @throws {Error} If a name is not provided.
   * @throws {TypeError} If the name is not a non-empty string.
   */
  constructor(name) {
    if (!name || typeof name !== 'string') {
      throw new TypeError('Plugin must have a non-empty string name.');
    }
    this.name = name;
  }

  /**
   * Attaches the plugin to a session instance.
   * This method is called by the `Session` class when `session.use(plugin)`
   * is invoked. It should not be called manually.
   *
   * @param {import('../session.js').Session} session - The session instance.
   * @internal
   */
  _attach(session) {
    if (this._session) {
      console.warn(`Plugin "${this.name}" is already attached to a session. Re-attaching.`);
    }
    this._session = session;
  }

  /**
   * A lifecycle hook called before a request is made.
   *
   * This method can be used to modify the request options before they are
   * passed to `undici`. For example, a proxy plugin would use this hook
   * to add a `dispatcher` (proxy agent) to the request options.
   *
   * @param {URL} url - The URL of the outgoing request.
   * @param {import('undici').RequestOptions} requestOptions - The options for the `undici` request. This object can be mutated.
   * @returns {Promise<void>} A promise that resolves when the hook's logic is complete.
   * @abstract
   */
  async preRequest(url, requestOptions) {
    // Default implementation does nothing. Subclasses should override this.
  }

  /**
   * A lifecycle hook called after a request has successfully completed.
   *
   * This method is invoked after a successful HTTP response (i.e., not a
   * network error). It can be used to process the response, for example,
   * by reporting a successful proxy usage or parsing the response body for
   * specific information.
   *
   * @param {import('undici').Dispatcher.ResponseData} response - The response data from `undici`.
   * @returns {Promise<void>} A promise that resolves when the hook's logic is complete.
   * @abstract
   */
  async postRequest(response) {
    // Default implementation does nothing. Subclasses should override this.
  }

  /**
   * A lifecycle hook called when a request fails.
   *
   * This method is invoked if the request fails due to a network error, a
   * non-2xx/3xx status code that isn't being retried, or after all retries
   * from `p-retry` have been exhausted. It can be used for cleanup or
   * error reporting, such as marking a proxy as bad.
   *
   * @param {Error} error - The error that caused the request to fail.
   * @param {URL} url - The URL of the failed request.
   * @returns {Promise<void>} A promise that resolves when the hook's logic is complete.
   * @abstract
   */
  async onRequestError(error, url) {
    // Default implementation does nothing. Subclasses should override this.
  }
}