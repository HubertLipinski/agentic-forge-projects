/**
 * @file src/util/constants.js
 * @description Defines constant values used throughout the application.
 * This centralizes configuration defaults and magic strings for easier maintenance.
 */

import { createRequire } from 'node:module';

// Using createRequire to import JSON is the standard way for ES Modules in Node.js
const require = createRequire(import.meta.url);
const { version, name } = require('../../package.json');

/**
 * Default timeout for HTTP/HTTPS requests in milliseconds.
 * @type {number}
 */
export const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Default delay between consecutive HTTP/HTTPS requests in milliseconds.
 * This helps to avoid rate-limiting issues when checking many external links.
 * @type {number}
 */
export const DEFAULT_REQUEST_DELAY = 100; // 100 milliseconds

/**
 * The User-Agent string to be sent with HTTP/HTTPS requests.
 * Identifies the client making the request, which is good practice.
 * Includes the package name and version for traceability.
 * @type {string}
 */
export const DEFAULT_USER_AGENT = `${name}/${version}`;

/**
 * An array of file extensions recognized as Markdown files.
 * The scanner will look for files with these extensions.
 * @type {string[]}
 */
export const SUPPORTED_MARKDOWN_EXTENSIONS = ['.md', '.markdown'];

/**
 * The standard name for the project's configuration file.
 * The application will search for this file in the current working directory.
 * @type {string}
 */
export const CONFIG_FILE_NAME = '.linkcheckerrc.json';

/**
 * Regular expression to extract Markdown links.
 * Captures the link text (group 1) and the URL (group 2).
 * Handles standard `[text](url)` and reference-style `[text]: url` links.
 * It is intentionally non-greedy (`.*?`) to handle multiple links on the same line.
 * @type {RegExp}
 */
export const MARKDOWN_LINK_REGEX = /\[([^\]]+?)\]\((?!#)([^)]+?)\)|\[([^\]]+?)\]:\s*([^\s]+)/g;

/**
 * An enumeration of possible link status codes used in the final report.
 * @type {Readonly<object>}
 */
export const LINK_STATUS = Object.freeze({
  VALID: 'VALID',
  BROKEN: 'BROKEN',
  SKIPPED: 'SKIPPED',
  IGNORED: 'IGNORED',
});

/**
 * An enumeration for exit codes to be used by the CLI.
 * Follows standard conventions for success and error codes.
 * @type {Readonly<object>}
 */
export const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  ERROR: 1,
  BROKEN_LINKS_FOUND: 2,
});