/**
 * @fileoverview
 * Defines shared, project-wide constants.
 *
 * This centralizes configuration values that are used across multiple modules,
 * such as supported file extensions and output formats. This makes it easy to
 * update these values in one place and ensures consistency throughout the
 * application. The constants are frozen to prevent accidental modification at runtime.
 */

/**
 * An array of supported Markdown file extensions.
 * These are used by the file scanner to identify which files to process.
 * The extensions should be provided without the leading dot.
 *
 * @type {Readonly<string[]>}
 */
export const SUPPORTED_EXTENSIONS = Object.freeze(['md', 'markdown']);

/**
 * An enum-like object for the supported output formats for the graph export.
 * Using an object provides a single source of truth for format names,
 * which can be used for validation in the CLI and for selecting the
 * appropriate exporter.
 *
 * @type {Readonly<{JSON: string, DOT: string, MERMAID: string, REPORT: string}>}
 */
export const OUTPUT_FORMATS = Object.freeze({
  /** For programmatic use or re-importing into graphology. */
  JSON: 'json',
  /** For visualization with Graphviz tools. */
  DOT: 'dot',
  /** For embedding diagrams in Markdown (e.g., on GitHub). */
  MERMAID: 'mermaid',
  /** A structured analysis report in JSON format. */
  REPORT: 'report',
});

/**
 * An array of all valid output format values.
 * Useful for CLI choice validation in `commander`.
 *
 * @type {Readonly<string[]>}
 */
export const VALID_OUTPUT_FORMATS = Object.freeze(Object.values(OUTPUT_FORMATS));

/**
 * Default glob patterns for excluding files and directories from the scan.
 * This is used to prevent scanning common non-content directories.
 *
 * @type {Readonly<string[]>}
 */
export const DEFAULT_EXCLUDE_PATTERNS = Object.freeze([
  '**/node_modules/**',
  '**/.git/**',
]);