/**
 * @file lib/constants.js
 * @description Defines default configuration values, error messages, and internal constants for the AI Response Validator library.
 * @module lib/constants
 */

/**
 * An immutable object containing the unique string identifiers for the built-in validation strategies.
 * These values are used to select and configure the desired validation logic.
 * Using these constants helps prevent typos and ensures consistency across the library.
 *
 * @example
 * import { VALIDATION_STRATEGIES } from './constants.js';
 * createValidator({ type: VALIDATION_STRATEGIES.JSON, schema: mySchema });
 *
 * @readonly
 * @enum {string}
 */
export const VALIDATION_STRATEGIES = Object.freeze({
  /** Identifier for the JSON validation strategy. */
  JSON: 'json',
  /** Identifier for the XML well-formedness validation strategy. */
  XML: 'xml',
  /** Identifier for the regular expression matching strategy. */
  REGEX: 'regex',
});

/**
 * An immutable object defining the available retry backoff strategies.
 * These determine how the delay between retry attempts is calculated.
 *
 * @readonly
 * @enum {string}
 */
export const RETRY_BACKOFF_STRATEGIES = Object.freeze({
  /**
   * Increases the delay exponentially with each attempt (e.g., 1s, 2s, 4s, 8s).
   * This is the default and is generally recommended to avoid overwhelming a struggling service.
   */
  EXPONENTIAL: 'exponential',
  /**
   * Uses a constant, fixed delay between all retry attempts.
   */
  FIXED: 'fixed',
});

/**
 * Default configuration for the main `Validator` class.
 * These values are used if they are not explicitly provided by the user during instantiation.
 *
 * @readonly
 * @type {object}
 * @property {number} maxRetries - The default maximum number of retry attempts.
 * @property {RETRY_BACKOFF_STRATEGIES.EXPONENTIAL} backoffStrategy - The default backoff strategy.
 * @property {number} initialDelayMs - The default initial delay for retries in milliseconds.
 * @property {number} maxDelayMs - The default maximum delay for exponential backoff in milliseconds.
 * @property {number} jitter - The default factor for adding randomness to backoff delays (0 to 1).
 */
export const DEFAULT_VALIDATOR_CONFIG = Object.freeze({
  maxRetries: 3,
  backoffStrategy: RETRY_BACKOFF_STRATEGIES.EXPONENTIAL,
  initialDelayMs: 1000,
  maxDelayMs: 30000, // 30 seconds
  jitter: 0.2, // 20% jitter
});

/**
 * An immutable object containing predefined, user-facing error messages.
 * Centralizing these messages ensures consistency in communication with the user.
 *
 * @readonly
 * @type {object}
 * @property {string} MAX_RETRIES_REACHED - Error message for when all retry attempts are exhausted.
 * @property {string} INVALID_LLM_HANDLER - Error message for when the provided LLM handler is not a function.
 */
export const ERROR_MESSAGES = Object.freeze({
  MAX_RETRIES_REACHED: 'Maximum number of retries reached without a valid response.',
  INVALID_LLM_HANDLER: 'The `llmHandler` must be an asynchronous function.',
});

/**
 * A template for generating a "repair prompt".
 * This string is used to construct the new prompt sent to the LLM after a validation failure.
 * It provides context about the error and asks the model to correct its previous output.
 *
 * Placeholders:
 * - `{{originalPrompt}}`: The user's original prompt.
 * - `{{invalidResponse}}`: The full, invalid response from the LLM.
 * - `{{validationError}}`: The specific error message from the validation strategy.
 *
 * @readonly
 * @type {string}
 */
export const REPAIR_PROMPT_TEMPLATE = `
The previous response you provided was not in the correct format. Please correct it and try again.

Your task is to respond ONLY with the corrected output, without any additional commentary, apologies, or explanations.

Original Prompt:
---
{{originalPrompt}}
---

Your Invalid Response:
---
{{invalidResponse}}
---

The validation error was:
---
{{validationError}}
---

Please provide the corrected response that adheres to the required format.
`.trim();