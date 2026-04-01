/**
 * @file lib/repair.js
 * @description Handles the logic for constructing a 'repair prompt' to send back to the LLM upon validation failure.
 * @module lib/repair
 */

import { REPAIR_PROMPT_TEMPLATE } from './constants.js';

/**
 * A utility function to safely stringify an object, handling potential circular references.
 * This is useful for embedding complex, potentially malformed data into a string prompt.
 *
 * @param {any} obj - The object to stringify.
 * @returns {string} A string representation of the object.
 * @private
 */
function safeStringify(obj) {
  if (typeof obj === 'string') {
    return obj;
  }
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    // Fallback for circular references or other stringify errors
    return '[Unserializable Object]';
  }
}

/**
 * Constructs a "repair prompt" to send to an LLM after a validation failure.
 *
 * This function takes the original prompt, the LLM's invalid response, and the
 * specific validation error, then injects them into a predefined template.
 * The goal is to provide the LLM with enough context to understand its mistake
 * and generate a corrected, valid response on the next attempt.
 *
 * The function allows for a custom repair prompt template to be provided,
 * offering flexibility for different models or advanced use cases. If no custom
 * template is given, it uses the default `REPAIR_PROMPT_TEMPLATE`.
 *
 * @param {object} params - The parameters for constructing the repair prompt.
 * @param {string} params.originalPrompt - The initial prompt that led to the invalid response.
 * @param {string} params.invalidResponse - The full, invalid response string from the LLM.
 * @param {string} params.validationError - The detailed error message from the validation strategy.
 * @param {string} [params.customRepairTemplate] - An optional custom template string. Must contain
 *   the placeholders `{{originalPrompt}}`, `{{invalidResponse}}`, and `{{validationError}}`.
 * @returns {string} The fully constructed repair prompt, ready to be sent to the LLM.
 *
 * @example
 * const repairPrompt = constructRepairPrompt({
 *   originalPrompt: "Generate a JSON object with a 'name' and 'age'.",
 *   invalidResponse: "{ name: 'John Doe', age: 30 }", // Note: unquoted keys
 *   validationError: "Invalid JSON: The response could not be parsed.",
 * });
 *
 * // repairPrompt will be a formatted string asking the LLM to fix the JSON.
 */
export function constructRepairPrompt({
  originalPrompt,
  invalidResponse,
  validationError,
  customRepairTemplate,
}) {
  const template = customRepairTemplate ?? REPAIR_PROMPT_TEMPLATE;

  // Ensure all inputs are strings for safe replacement.
  const safeOriginalPrompt =
    typeof originalPrompt === 'string'
      ? originalPrompt
      : safeStringify(originalPrompt);

  const safeInvalidResponse =
    typeof invalidResponse === 'string'
      ? invalidResponse
      : safeStringify(invalidResponse);

  const safeValidationError =
    typeof validationError === 'string'
      ? validationError
      : safeStringify(validationError);

  // Perform the replacements.
  // We use a function with a switch statement for replacement to avoid issues
  // with special characters in the replacement strings if we were to use new RegExp().
  const repairedPrompt = template.replace(
    /\{\{(originalPrompt|invalidResponse|validationError)\}\}/g,
    (match, placeholder) => {
      switch (placeholder) {
        case 'originalPrompt':
          return safeOriginalPrompt;
        case 'invalidResponse':
          return safeInvalidResponse;
        case 'validationError':
          return safeValidationError;
        default:
          return match; // Should not happen with the given regex
      }
    },
  );

  return repairedPrompt;
}