/**
 * @file index.js
 * @description Main entry point for the AI Response Validator library.
 * This module exports the primary factory function `createValidator` for creating
 * validator instances, as well as the core `Validator` class and custom error classes
 * for advanced usage and type checking.
 * @module ai-response-validator
 */

import { Validator } from './lib/validator.js';
import {
  AIValidatorError,
  ValidationError,
  MaxRetriesExceededError,
  ConfigurationError,
  LLMHandlerError,
} from './lib/errors.js';
import {
  JsonValidator,
  XmlValidator,
  RegexValidator,
} from './lib/strategies/index.js';
import { registerStrategy, STRATEGIES } from './lib/strategies/index.js';

/**
 * Factory function to create and configure a `Validator` instance.
 *
 * This is the primary and recommended way to start using the library. It simplifies
 * the setup process by taking a single configuration object.
 *
 * @param {object} config - The configuration object for the validator.
 * @param {string} config.type - The name of the validation strategy (e.g., 'json', 'xml', 'regex').
 *   Use the exported `STRATEGIES` object for type safety (e.g., `STRATEGIES.JSON`).
 * @param {object} [config.strategyOptions={}] - Options for the chosen strategy.
 *   - For `json`: `{ schema: <JSON_SCHEMA_OBJECT> }`
 *   - For `regex`: `{ pattern: <RegExp | string>, flags?: string }`
 *   - For `xml`: `{}` (or options for fast-xml-parser)
 * @param {import('./lib/validator.js').LLMHandler} config.llmHandler - An async function that takes a prompt and returns the LLM's response string or stream.
 * @param {number} [config.maxRetries=3] - Maximum number of retry attempts on validation failure.
 * @param {string} [config.backoffStrategy='exponential'] - Backoff strategy ('exponential' or 'fixed').
 * @param {number} [config.initialDelayMs=1000] - Initial delay for backoff in milliseconds.
 * @param {number} [config.maxDelayMs=30000] - Maximum delay for exponential backoff.
 * @param {number} [config.jitter=0.2] - Jitter factor (0-1) to randomize backoff delays.
 * @param {string} [config.customRepairTemplate] - An optional custom template string for repair prompts.
 * @returns {Validator} An instance of the `Validator` class, ready to be used.
 * @throws {ConfigurationError} If the configuration is invalid (e.g., missing `type` or `llmHandler`).
 *
 * @example
 * import { createValidator, STRATEGIES } from 'ai-response-validator';
 *
 * // A mock LLM handler function
 * async function myLlmHandler(prompt) {
 *   // In a real app, this would make an API call to an LLM
 *   console.log('LLM received prompt:', prompt);
 *   if (prompt.includes("correct this")) {
 *     return '{ "name": "John Doe", "age": 30 }';
 *   }
 *   return '{ "name": "John Doe", "age": "thirty" }'; // Initially invalid
 * }
 *
 * const userSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' },
 *   },
 *   required: ['name', 'age'],
 * };
 *
 * const validator = createValidator({
 *   type: STRATEGIES.JSON,
 *   strategyOptions: { schema: userSchema },
 *   llmHandler: myLlmHandler,
 *   maxRetries: 2,
 * });
 *
 * const result = await validator.validate("Generate user JSON");
 * if (result.success) {
 *   console.log('Validation successful:', result.data);
 * } else {
 *   console.error('Validation failed:', result.error.message);
 * }
 */
function createValidator(config) {
  // The Validator constructor handles all the validation and default assignments.
  // This factory function serves as a clean, user-friendly entry point.
  return new Validator(config);
}

export {
  // Core functionality
  createValidator,
  Validator,

  // Validation Strategies (for advanced extension or type checking)
  JsonValidator,
  XmlValidator,
  RegexValidator,
  registerStrategy, // Allow users to add their own strategies
  STRATEGIES, // Export strategy name constants

  // Custom Error classes (for robust error handling)
  AIValidatorError,
  ValidationError,
  MaxRetriesExceededError,
  ConfigurationError,
  LLMHandlerError,
};

// Default export for convenience, e.g., `import aiValidator from 'ai-response-validator';`
// This makes the most common function easily accessible.
export default createValidator;