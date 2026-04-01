/**
 * @file lib/validator.js
 * @description Core orchestrator class that takes a configuration, applies a validation strategy, and manages the retry/repair loop.
 * @module lib/validator
 */

import { getStrategy } from './strategies/index.js';
import { RetryManager } from './retry.js';
import { constructRepairPrompt } from './repair.js';
import {
  ConfigurationError,
  LLMHandlerError,
  MaxRetriesExceededError,
  ValidationError,
} from './errors.js';
import {
  DEFAULT_VALIDATOR_CONFIG,
  ERROR_MESSAGES,
} from './constants.js';

/**
 * Represents the result of a successful validation operation.
 * @typedef {object} ValidationSuccess
 * @property {true} success - Indicates the operation was successful.
 * @property {*} data - The validated and parsed data from the LLM response.
 * @property {number} attempts - The total number of attempts made to get a valid response.
 * @property {object} metadata - Additional metadata about the operation.
 * @property {string} metadata.rawResponse - The final, valid raw response string from the LLM.
 * @property {boolean} metadata.wasRepaired - True if the response was corrected through a repair loop.
 */

/**
 * Represents the result of a failed validation operation.
 * @typedef {object} ValidationFailure
 * @property {false} success - Indicates the operation failed.
 * @property {Error} error - The final error that caused the failure (e.g., MaxRetriesExceededError).
 * @property {number} attempts - The total number of attempts made.
 * @property {object} metadata - Additional metadata about the operation.
 * @property {string|null} metadata.lastInvalidResponse - The last invalid response received from the LLM.
 */

/**
 * The result of a validation operation, which can be either a success or a failure.
 * @typedef {ValidationSuccess | ValidationFailure} ValidationResult
 */

/**
 * @callback LLMHandler
 * @param {string|object} prompt - The prompt to send to the LLM.
 * @param {object} [options] - Optional parameters for the LLM call (e.g., model, temperature).
 * @returns {Promise<string|ReadableStream>} The raw string or a streaming response from the LLM.
 */

/**
 * Core orchestrator class that manages the validation, retry, and repair loop for LLM responses.
 *
 * This class ties together the validation strategy, retry logic, and repair prompt generation.
 * It provides a single `validate` method to process an LLM response, automatically handling
 * failures and attempting to recover until a valid response is received or retries are exhausted.
 */
export class Validator {
  #config;
  #strategy;
  #llmHandler;

  /**
   * Creates an instance of the Validator.
   * It is recommended to use the `createValidator` factory function instead of this constructor directly.
   *
   * @param {object} config - The configuration object for the validator.
   * @param {string} config.type - The name of the validation strategy (e.g., 'json', 'xml').
   * @param {object} [config.strategyOptions={}] - Options for the chosen strategy (e.g., `{ schema: ... }` for JSON).
   * @param {LLMHandler} config.llmHandler - An async function that takes a prompt and returns the LLM's response.
   * @param {number} [config.maxRetries] - Maximum number of retry attempts.
   * @param {string} [config.backoffStrategy] - 'exponential' or 'fixed'.
   * @param {number} [config.initialDelayMs] - Initial delay for backoff.
   * @param {string} [config.customRepairTemplate] - A custom template for repair prompts.
   * @throws {ConfigurationError} If the configuration is invalid.
   */
  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new ConfigurationError('Validator configuration must be an object.');
    }

    if (typeof config.llmHandler !== 'function') {
      throw new ConfigurationError(ERROR_MESSAGES.INVALID_LLM_HANDLER);
    }

    this.#config = { ...DEFAULT_VALIDATOR_CONFIG, ...config };
    this.#llmHandler = this.#config.llmHandler;

    // The getStrategy function will throw a ConfigurationError if 'type' is missing or invalid.
    this.#strategy = getStrategy(
      this.#config.type,
      this.#config.strategyOptions,
    );
  }

  /**
   * Reads a streaming response from an LLM and aggregates it into a single string.
   *
   * @param {ReadableStream} stream - The readable stream from the LLM API.
   * @returns {Promise<string>} The complete, aggregated string.
   * @private
   */
  async #aggregateStream(stream) {
    let aggregatedResponse = '';
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aggregatedResponse += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
    return aggregatedResponse;
  }

  /**
   * Executes the main validation loop for a given prompt.
   *
   * This method orchestrates the entire process:
   * 1. Initializes a `RetryManager`.
   * 2. Enters a loop that continues as long as retries are permitted.
   * 3. In each attempt, it calls the user-provided `llmHandler` with the current prompt.
   * 4. It validates the LLM's response using the configured strategy.
   * 5. If valid, the loop terminates, and the successful result is returned.
   * 6. If invalid, it constructs a "repair prompt" and continues to the next attempt.
   * 7. If retries are exhausted, it returns a final failure result.
   *
   * @param {string|object} initialPrompt - The initial prompt to send to the LLM.
   * @param {object} [llmOptions={}] - Options to pass directly to the `llmHandler`.
   * @returns {Promise<ValidationResult>} The result of the validation process.
   */
  async validate(initialPrompt, llmOptions = {}) {
    const retryManager = new RetryManager(this.#config);
    let currentPrompt = initialPrompt;
    let lastError = null;
    let lastInvalidResponse = null;

    while (retryManager.canRetry()) {
      await retryManager.nextAttempt();
      const attempt = retryManager.currentAttempt;

      try {
        const llmResponse = await this.#llmHandler(currentPrompt, llmOptions);

        const rawResponse =
          typeof llmResponse === 'string'
            ? llmResponse
            : await this.#aggregateStream(llmResponse);

        lastInvalidResponse = rawResponse;

        const validationResult = await this.#strategy.validate(rawResponse);

        if (validationResult.isValid) {
          return {
            success: true,
            data: validationResult.data,
            attempts: attempt,
            metadata: {
              rawResponse,
              wasRepaired: attempt > 1,
            },
          };
        }

        // Validation failed, prepare for next attempt
        lastError = new ValidationError(validationResult.error, {
          details: { response: rawResponse },
        });

        currentPrompt = constructRepairPrompt({
          originalPrompt: initialPrompt,
          invalidResponse: rawResponse,
          validationError: validationResult.error,
          customRepairTemplate: this.#config.customRepairTemplate,
        });
      } catch (error) {
        // This catches errors from the llmHandler (e.g., network, API key)
        // or from stream aggregation. We treat these as non-recoverable
        // and do not retry.
        const handlerError = new LLMHandlerError(
          `LLM handler failed during attempt ${attempt}: ${error.message}`,
          { cause: error },
        );

        return {
          success: false,
          error: handlerError,
          attempts: attempt,
          metadata: {
            lastInvalidResponse: null,
          },
        };
      }
    }

    // If the loop finishes, it means max retries were exceeded.
    const finalError = new MaxRetriesExceededError(
      ERROR_MESSAGES.MAX_RETRIES_REACHED,
      {
        attemptsMade: retryManager.currentAttempt,
        lastError: lastError ?? new Error('An unknown validation error occurred.'),
      },
    );

    return {
      success: false,
      error: finalError,
      attempts: retryManager.currentAttempt,
      metadata: {
        lastInvalidResponse,
      },
    };
  }
}