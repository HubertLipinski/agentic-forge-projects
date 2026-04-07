/**
 * @file lib/utils/errors.js
 * @description Defines custom error classes for the Stream Router JS library.
 * This centralizes error types, making them easier to manage, test, and handle
 * consistently throughout the application.
 */

/**
 * Base error class for all custom errors thrown by the Stream Router JS library.
 * This allows consumers to catch all library-specific errors using a single `catch` block
 * (`catch (e) { if (e instanceof StreamRouterError) { ... } }`).
 *
 * @class StreamRouterError
 * @extends {Error}
 */
export class StreamRouterError extends Error {
  /**
   * Creates an instance of StreamRouterError.
   * @param {string} message - The error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The original error that caused this error, for chaining.
   */
  constructor(message, options) {
    super(message, options);

    /**
     * The name of the error class.
     * @type {string}
     * @default 'StreamRouterError'
     */
    this.name = this.constructor.name;

    // Maintain a proper stack trace (V8-specific).
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when a provided routing rule configuration fails validation.
 * This typically occurs when a rule object does not conform to the required schema.
 * The error includes detailed validation information from the validator (e.g., AJV).
 *
 * @class RuleValidationError
 * @extends {StreamRouterError}
 */
export class RuleValidationError extends StreamRouterError {
  /**
   * Creates an instance of RuleValidationError.
   * @param {string} message - A summary of the validation failure.
   * @param {Array<object>} [validationErrors=[]] - An array of detailed error objects from the validation library (e.g., AJV).
   * @param {object} [options] - Optional parameters passed to the parent constructor.
   * @param {Error} [options.cause] - The original error that caused this error.
   */
  constructor(message, validationErrors = [], options) {
    super(message, options);
    this.name = this.constructor.name;

    /**
     * An array of detailed error objects from the underlying validation library.
     * This provides specific information about which parts of the rule configuration are invalid.
     * @type {Array<object>}
     */
    this.validationErrors = validationErrors;
  }
}

/**
 * Error thrown during the stream processing lifecycle.
 * This can include issues like data parsing failures within the stream
 * or problems with rule engine evaluation.
 *
 * @class StreamProcessingError
 * @extends {StreamRouterError}
 */
export class StreamProcessingError extends StreamRouterError {
  /**
   * Creates an instance of StreamProcessingError.
   * @param {string} message - The error message.
   * @param {any} chunk - The data chunk that was being processed when the error occurred.
   * @param {object} [options] - Optional parameters passed to the parent constructor.
   * @param {Error} [options.cause] - The original error that caused this error (e.g., a JSON.parse error).
   */
  constructor(message, chunk, options) {
    super(message, options);
    this.name = this.constructor.name;

    /**
     * The data chunk that was being processed when the error was thrown.
     * This can be useful for debugging the source of the problematic data.
     * Note: This is a reference and may be a Buffer, string, or object.
     * @type {any}
     */
    this.chunk = chunk;
  }
}

/**
 * Error thrown for invalid configuration options provided to the StreamRouter constructor
 * or other setup functions, distinct from rule validation.
 *
 * @class ConfigurationError
 * @extends {StreamRouterError}
 */
export class ConfigurationError extends StreamRouterError {
  /**
   * Creates an instance of ConfigurationError.
   * @param {string} message - The error message describing the configuration issue.
   * @param {object} [options] - Optional parameters passed to the parent constructor.
   * @param {Error} [options.cause] - The original error that caused this error.
   */
  constructor(message, options) {
    super(message, options);
    this.name = this.constructor.name;
  }
}