/**
 * @file src/constants.js
 * @description Defines shared constants used throughout the Cyclic Import Detective application.
 *
 * This centralizes configuration values like supported file extensions,
 * report formats, and default settings, making them easy to manage and
 * reference from different parts of the codebase.
 */

import path from 'node:path';

/**
 * An array of file extensions that the tool will attempt to resolve.
 * The order matters, as the resolver will try them sequentially.
 * Includes common JavaScript and TypeScript extensions.
 * @type {Readonly<string[]>}
 */
export const SUPPORTED_EXTENSIONS = Object.freeze([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
  '.json',
  '.node',
]);

/**
 * An object defining the valid string identifiers for report formats.
 * This ensures consistency when parsing CLI arguments and invoking reporters.
 * @type {Readonly<{CONSOLE: 'console', JSON: 'json', GRAPHML: 'graphml', GEXF: 'gexf'}>}
 */
export const REPORT_FORMATS = Object.freeze({
  CONSOLE: 'console',
  JSON: 'json',
  GRAPHML: 'graphml',
  GEXF: 'gexf',
});

/**
 * The default configuration values for the CLI tool.
 * These are used as fallbacks if the user does not provide corresponding
 * command-line arguments.
 * @type {Readonly<object>}
 */
export const DEFAULT_CONFIG = Object.freeze({
  /**
   * The default entry point pattern if none is specified.
   * It looks for common entry files like `index.js`, `main.js`, etc., in the `src` directory.
   * @type {string}
   */
  entry: 'src/index.{js,mjs,ts,mts}',

  /**
   * The default report format.
   * @type {string}
   */
  format: REPORT_FORMATS.CONSOLE,

  /**
   * The default base directory for resolving paths and reporting relative paths.
   * @type {string}
   */
  baseDir: process.cwd(),

  /**
   * Default patterns for files and directories to exclude from the analysis.
   * This helps avoid traversing into irrelevant or problematic directories.
   * @type {Readonly<string[]>}
   */
  exclude: Object.freeze([
    '**/node_modules/**',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.{js,ts}',
    '**/*.spec.{js,ts}',
  ]),

  /**
   * The default log level. Can be 'debug', 'info', 'warn', 'error', or 'silent'.
   * @type {string}
   */
  logLevel: 'info',
});

/**
 * The name of the cache directory created in the system's temporary folder.
 * Using a unique name prevents conflicts with other applications.
 * @type {string}
 */
export const CACHE_DIR_NAME = 'cyclic-import-detective-cache';

/**
 * The default name for the output file when a graph report format is chosen
 * without a specific output path.
 * @type {string}
 */
export const DEFAULT_GRAPH_OUTPUT_FILE = 'dependency-graph.graphml';