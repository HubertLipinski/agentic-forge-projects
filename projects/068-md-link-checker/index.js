/**
 * @file index.js
 * @description The main entry point for programmatic use of the markdown-link-checker library.
 * It exports the core scanner function and related utilities, allowing other Node.js
 * projects to integrate link checking directly.
 */

import { scan as coreScan } from './src/core/scanner.js';
import { loadConfig } from './src/config/config-loader.js';
import { LINK_STATUS } from './src/util/constants.js';

/**
 * Programmatically scans Markdown files for broken links.
 *
 * This is the primary function for using `markdown-link-checker` as a library.
 * It provides a high-level interface to the scanning and validation engine,
 * abstracting away the complexities of file discovery, parsing, and configuration merging.
 *
 * @public
 * @async
 * @function check
 * @param {string | string[]} paths - A single path or an array of file/directory paths to scan.
 * @param {object} [options={}] - Optional configuration overrides. This object is merged
 *   with any configuration found in a `.linkcheckerrc.json` file.
 * @param {number} [options.timeout] - Network request timeout in milliseconds.
 * @param {number} [options.requestDelay] - Delay between each HTTP request in milliseconds.
 * @param {string} [options.userAgent] - Custom User-Agent string for network requests.
 * @param {string[]} [options.ignorePatterns] - An array of regex patterns for URLs to ignore.
 * @returns {Promise<import('./src/validation/link-validator.js').ValidationResult[]>}
 *   A promise that resolves to an array of validation result objects, each detailing a
 *   link's status.
 *
 * @example
 * // Basic usage with a single directory
 * import { check } from 'markdown-link-checker';
 *
 * const results = await check('./docs');
 * const brokenLinks = results.filter(link => link.status === 'BROKEN');
 * console.log(brokenLinks);
 *
 * @example
 * // Advanced usage with custom options
 * import { check } from 'markdown-link-checker';
 *
 * const options = {
 *   timeout: 5000, // 5-second timeout
 *   ignorePatterns: ['http://localhost:.*'], // Ignore local development links
 * };
 *
 * const results = await check(['./README.md', './guides/'], options);
 * console.log(`Found ${results.length} total links.`);
 */
export async function check(paths, options = {}) {
  // Normalize `paths` to always be an array for consistent processing.
  const targetPaths = Array.isArray(paths) ? paths : [paths];

  // The `options` object mimics the structure of CLI arguments for `loadConfig`.
  // This allows programmatic users to override file-based configurations easily.
  // We map user-friendly option names to their internal `yargs-parser` equivalents.
  const cliArgsEquivalent = {
    _: targetPaths,
    timeout: options.timeout,
    'request-delay': options.requestDelay,
    'user-agent': options.userAgent,
    ignore: options.ignorePatterns,
  };

  // Load and merge configuration from defaults, config file, and provided options.
  const config = await loadConfig(cliArgsEquivalent);

  // Execute the core scanning logic with the final configuration.
  return coreScan(targetPaths, config);
}

// Export the core `scan` function directly for users who might want to
// manage configuration loading themselves.
export { coreScan as scan };

// Export the `LINK_STATUS` enum so consumers can reliably check the status
// property of the results without using magic strings.
export { LINK_STATUS };