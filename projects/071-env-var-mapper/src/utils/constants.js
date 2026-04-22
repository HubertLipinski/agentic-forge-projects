/**
 * @file src/utils/constants.js
 * @description Defines constant values used throughout the application.
 * This centralized approach to constants improves maintainability and consistency.
 */

/**
 * An immutable object containing Abstract Syntax Tree (AST) node types.
 * These are used by the parser to identify specific code structures.
 *
 * @see {@link https://github.com/estree/estree/blob/master/es5.md#node-objects}
 * @type {Readonly<object>}
 */
export const AST_NODE_TYPES = Object.freeze({
  /** Represents a member access expression, e.g., `object.property` or `object['property']`. */
  MEMBER_EXPRESSION: 'MemberExpression',
  /** Represents an identifier, e.g., a variable name like `process`. */
  IDENTIFIER: 'Identifier',
  /** Represents a literal value, e.g., a string `'ENV_VAR'` or a number `123`. */
  LITERAL: 'Literal',
});

/**
 * An immutable object containing identifiers for key objects in the AST.
 *
 * @type {Readonly<object>}
 */
export const AST_IDENTIFIERS = Object.freeze({
  /** The identifier for the `process` global object. */
  PROCESS: 'process',
  /** The identifier for the `env` property of the `process` object. */
  ENV: 'env',
});

/**
 * An immutable array of file extensions to be scanned by the directory scanner.
 * The tool will look for files ending with these extensions.
 *
 * @type {Readonly<string[]>}
 */
export const SUPPORTED_FILE_EXTENSIONS = Object.freeze(['js', 'mjs']);

/**
 * An immutable object defining the available output formats for the CLI reporter.
 *
 * @type {Readonly<object>}
 */
export const OUTPUT_FORMATS = Object.freeze({
  /** A simple, sorted list of unique environment variable names. */
  LIST: 'list',
  /** A detailed report showing each variable's usage location (file and line). */
  DETAIL: 'detail',
  /** A machine-readable JSON object of the findings. */
  JSON: 'json',
  /** A string formatted for a `.env.example` file. */
  ENV: 'env',
});

/**
 * The default filename for the generated environment variable example file.
 *
 * @type {string}
 */
export const DEFAULT_ENV_EXAMPLE_FILENAME = '.env.example';