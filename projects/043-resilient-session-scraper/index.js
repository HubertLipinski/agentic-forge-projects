'use strict';

/**
 * @fileoverview The public entry point for the Resilient Session Scraper library.
 *
 * This module serves as the primary export interface for consumers of the package.
 * It exposes the main `createSession` factory function, which is the standard way
 * to instantiate a new scraping session.
 *
 * Additionally, it exports other core classes and utilities that advanced users might
 * need for customization, such as creating custom plugins or directly interacting
 * with session components. This allows for both simple, high-level usage and
 * more complex, low-level integrations.
 *
 * The exports are structured to be easily discoverable and to align with modern
 * JavaScript module practices.
 *
 * @example
 * // Basic usage:
 * import { createSession } from 'resilient-session-scraper';
 *
 * const session = createSession({
 *   headers: { 'X-Custom-Header': 'MyValue' }
 * });
 *
 * const response = await session.get('https://example.com');
 * console.log(response.statusCode);
 * console.log(response.$('h1').text());
 *
 * @example
 * // Advanced usage with plugins:
 * import { createSession, ProxyManager } from 'resilient-session-scraper';
 *
 * const proxies = ['http://user:pass@host:port'];
 * const proxyManager = new ProxyManager({ proxies });
 *
 * const session = createSession();
 * session.use(proxyManager);
 *
 * const response = await session.get('https://api.ipify.org?format=json');
 * console.log(await response.json());
 */

// Core session creation and management
import { Session, createSession } from './lib/session.js';

// Base class for creating custom plugins
import { BasePlugin } from './lib/plugins/base-plugin.js';

// A ready-to-use plugin for proxy management
import { ProxyManager } from './lib/plugins/proxy-manager.js';

// Utility functions that might be useful for advanced users
import { extractCsrfToken } from './lib/utils/csrf.js';
import {
  generateUserAgent,
  normalizeHeaders,
  mergeHeaders,
} from './lib/utils/headers.js';

// Export the main factory function as the primary entry point.
export { createSession };

// Export the core Session class for type checking or extension.
export { Session };

// Export plugin-related classes for custom plugin development.
export { BasePlugin, ProxyManager };

// Export a selection of utility functions for advanced use cases.
export const utils = {
  extractCsrfToken,
  generateUserAgent,
  normalizeHeaders,
  mergeHeaders,
};

// Default export for convenience, allowing `import scraper from '...'`.
export default {
  createSession,
  Session,
  BasePlugin,
  ProxyManager,
  utils,
};