/**
 * @fileoverview Defines and exports shared constant values used across the application.
 *
 * This centralized approach to constants makes it easier to manage and update
 * configuration values like timeouts and user-agent strings without modifying
 * multiple files.
 *
 * @module src/utils/constants
 */

/**
 * The default timeout for network requests in milliseconds.
 * This value is used when fetching feeds if no specific timeout is provided.
 * A 10-second timeout is a reasonable balance, preventing indefinite hangs
 * on unresponsive servers while allowing for slower connections.
 * @type {number}
 */
export const DEFAULT_REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * The User-Agent string sent with every fetch request.
 *
 * It's good practice to identify your client when making HTTP requests.
 * This helps server administrators understand their traffic and can prevent
 * being blocked by services that disallow unidentified bots. The string
 * includes the project name, version, and a link to the project's homepage,
 * following common conventions.
 *
 * The version is dynamically read from `package.json` at runtime.
 * @type {string}
 */
export const USER_AGENT = `RSS-Feed-Aggregator/1.0.0 (+https://github.com/your-username/rss-feed-aggregator)`;