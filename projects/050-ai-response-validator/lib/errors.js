/**
 * @file lib/errors.js
 * @description Custom error classes for different validation and retry failure scenarios.
 * @module lib/errors
 */

/**
 * Base error class for all custom errors in the AI Response Validator library.
 * This allows consumers to catch any library-specific error using `catch (e) { if (e instanceof AIValidatorError) ... }`.
 *
 * It supports modern error features like the `cause` property for chaining errors,
 * and a `details` property for structured, machine-readable error context.
 *
 * @property {string} name - The name of the error class.
 * @property {string} message - The human-readable error message.
 * @property {Error} [cause] - The original error that led to this error, for better debugging.
 * @property {object} [details] - An object containing additional, structured information about the error.
 */
export class AIValidatorError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The underlying error.
   * @param {object} [options.details] - Additional structured details.
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.details = options.details ?? {};

    // Restore the correct prototype chain and capture a new stack trace.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when a validation strategy fails to validate a response.
 * This error is typically caught internally during the retry loop but can be
 * thrown to the user if retries are disabled.
 *
 * The `details` property often contains the invalid data and the specific
 * validation failure reason.
 *
 * @example
 * // Thrown by a JSON validator
 * new ValidationError("JSON schema validation failed", {
 *   details: {
 *     response: '{"name": "test", "age": "25"}',
 *     errors: "data.age should be number"
 *   }
 * });
 */
export class ValidationError extends AIValidatorError {
  /**
   * @param {string} message - The error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The underlying error.
   * @param {object} [options.details] - Additional structured details.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when the maximum number of retry attempts is exhausted without
 * achieving a valid response from the LLM. This is a final, terminal error
 * for a validation attempt.
 *
 * The `details` property includes the number of attempts and the last error
 * encountered, providing full context for the failure.
 *
 * @property {object} details - Structured details about the failure.
 * @property {number} details.attemptsMade - The total number of attempts made.
 * @property {Error} details.lastError - The validation or network error from the final attempt.
 */
export class MaxRetriesExceededError extends AIValidatorError {
  /**
   * @param {string} message - The error message.
   * @param {object} options - Required parameters.
   * @param {number} options.attemptsMade - The total number of attempts.
   * @param {Error} options.lastError - The error from the last attempt.
   */
  constructor(message, { attemptsMade, lastError }) {
    super(message, {
      cause: lastError,
      details: {
        attemptsMade,
        lastError: {
          name: lastError.name,
          message: lastError.message,
          details: lastError.details,
        },
      },
    });
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * Thrown when there is an issue with the configuration provided to the validator
 * or one of its strategies. This error occurs during setup, before any LLM calls
 * are made.
 *
 * Examples include providing an unknown strategy name, an invalid JSON schema,
 * or a malformed regular expression.
 *
 * @example
 * // Thrown when `getStrategy` receives an unknown name
 * new ConfigurationError('Unknown validation strategy: "yaml"');
 */
export class ConfigurationError extends AIValidatorError {
  /**
   * @param {string} message - The error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The underlying error.
   * @param {object} [options.details] - Additional structured details.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'ConfigurationError';
  }
}

/**
 * Thrown when the `llmHandler` function provided by the user fails for a reason
 * other than a validation error (e.g., network issues, API key errors, rate limits).
 *
 * This error helps distinguish between a model producing bad output vs. the model's
 * API endpoint being unreachable or rejecting the request. The library does not
 * attempt to retry on these errors by default, as they are typically not solvable
 * by resending the same prompt.
 */
export class LLMHandlerError extends AIValidatorError {
  /**
   * @param {string} message - The error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The underlying error from the handler (e.g., a fetch error).
   * @param {object} [options.details] - Additional structured details.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'LLMHandlerError';
  }
}