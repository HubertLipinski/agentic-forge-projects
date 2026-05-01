'use strict';

/**
 * @fileoverview Defines custom error classes for the structured-config-loader library.
 * These classes provide more specific information about configuration loading and
 * validation failures, improving debugging and error handling for consumers of the library.
 *
 * @module src/errors
 */

/**
 * Base error class for all errors thrown by the structured-config-loader.
 * This allows consumers to catch all library-specific errors with a single `catch (e)`
 * block if they wish to do so (`if (e instanceof ConfigLoaderError)`).
 *
 * It extends the built-in `Error` class and supports the `cause` property for
 * chaining errors, a standard feature in modern JavaScript.
 */
export class ConfigLoaderError extends Error {
  /**
   * Constructs a new ConfigLoaderError.
   * @param {string} message - The error message.
   * @param {object} [options] - Additional options.
   * @param {Error} [options.cause] - The original error that caused this one.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'ConfigLoaderError';
    // Ensure the 'cause' property is set, even on older environments if polyfilled.
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown when there is an issue related to a configuration file.
 * This can include I/O errors (e.g., file not readable), parsing errors
 * (e.g., invalid JSON/YAML), or if the file content is not of the expected type (e.g., an array instead of an object).
 */
export class ConfigFileError extends ConfigLoaderError {
  /**
   * Constructs a new ConfigFileError.
   * @param {string} message - The error message.
   * @param {object} [options] - Additional options.
   * @param {Error} [options.cause] - The original error that caused this one.
   * @param {string} [options.path] - The path to the file that caused the error.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'ConfigFileError';
    /**
     * The path to the file that was being processed when the error occurred.
     * @type {string|undefined}
     */
    this.path = options?.path;
  }
}

/**
 * Thrown when the final merged configuration object fails validation against the provided JSON Schema.
 * This error contains detailed information about the validation failures, making it easier to
 * identify and fix configuration problems.
 */
export class ConfigValidationError extends ConfigLoaderError {
  /**
   * Constructs a new ConfigValidationError.
   * @param {string} message - A summary error message.
   * @param {object[]} errors - An array of validation error objects from the `ajv` validator.
   * @param {object} [options] - Additional options.
   * @param {Error} [options.cause] - The original error that caused this one.
   */
  constructor(message, errors, options) {
    super(message, options);
    this.name = 'ConfigValidationError';
    /**
     * An array of detailed error objects provided by the `ajv` validator.
     * Each object typically contains properties like `instancePath`, `schemaPath`,
     * `keyword`, `params`, and `message`.
     * @type {object[]}
     */
    this.errors = errors;
  }
}