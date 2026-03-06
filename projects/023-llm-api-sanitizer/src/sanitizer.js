/**
 * @file src/sanitizer.js
 * @description Core module containing the Sanitizer class. This class orchestrates the
 * sanitization of input prompts and the validation and parsing of LLM outputs.
 * @module sanitizer
 */

import defaultInputRules from './rules/input-rules.js';
import { safeJsonParse } from './utils/output-parser.js';

/**
 * A custom error class for sanitization-related failures.
 */
class SanitizationError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {object} [details] - Additional details about the error.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'SanitizationError';
    this.details = details;
  }
}

/**
 * A lightweight, zero-dependency wrapper for sanitizing inputs and validating outputs
 * of Large Language Model (LLM) APIs.
 */
export class Sanitizer {
  #config;
  #prompt;

  /**
   * Creates an instance of the Sanitizer.
   * @param {object} [options={}] - Configuration options for the sanitizer.
   * @param {Array<object>} [options.inputRules] - Custom rules to add to the default input sanitization rules.
   * @param {boolean} [options.removeMatched] - If true, removes matched injection patterns from the prompt. If false, throws an error on match. Defaults to false.
   * @param {number} [options.maxRetries=2] - The number of times to retry the API call if JSON output parsing fails.
   * @param {number} [options.retryDelay=100] - The delay in milliseconds between retries.
   */
  constructor(options = {}) {
    const defaultConfig = {
      inputRules: [],
      removeMatched: false,
      maxRetries: 2,
      retryDelay: 100,
    };

    this.#config = { ...defaultConfig, ...options };
    this.#config.inputRules = [...defaultInputRules, ...this.#config.inputRules];
    this.#prompt = null;
  }

  /**
   * Sets the input prompt to be sanitized.
   * This is the first step in the fluent API chain.
   *
   * @param {string} prompt - The user-provided prompt string.
   * @returns {this} The Sanitizer instance for chaining.
   * @throws {SanitizationError} If the prompt is not a non-empty string.
   */
  setPrompt(prompt) {
    if (typeof prompt !== 'string' || prompt.trim() === '') {
      throw new SanitizationError('Prompt must be a non-empty string.');
    }
    this.#prompt = prompt;
    return this;
  }

  /**
   * Applies the configured input sanitization rules to the prompt.
   *
   * If `config.removeMatched` is true, it strips any parts of the prompt that match
   * the sanitization rules.
   *
   * If `config.removeMatched` is false (default), it throws a `SanitizationError`
   * upon the first match.
   *
   * @returns {string} The sanitized prompt.
   * @throws {SanitizationError} If a rule is matched and `removeMatched` is false.
   * @throws {SanitizationError} If `setPrompt` has not been called first.
   */
  sanitize() {
    if (this.#prompt === null) {
      throw new SanitizationError('Prompt has not been set. Call setPrompt(prompt) before sanitizing.');
    }

    let sanitizedPrompt = this.#prompt;

    for (const rule of this.#config.inputRules) {
      const match = sanitizedPrompt.match(rule.pattern);
      if (match) {
        if (this.#config.removeMatched) {
          sanitizedPrompt = sanitizedPrompt.replace(rule.pattern, '').trim();
        } else {
          throw new SanitizationError('Prompt injection attempt detected.', {
            rule: rule.name,
            description: rule.description,
            matched: match[0],
          });
        }
      }
    }
    return sanitizedPrompt;
  }

  /**
   * Wraps an asynchronous LLM API call, providing input sanitization and
   * output validation with an automatic retry mechanism for JSON parsing.
   *
   * @template T
   * @param {() => Promise<T>} apiCall - An async function that performs the API call and returns the raw LLM response.
   * @returns {Promise<object | Array>} A promise that resolves to the parsed, valid JSON object or array.
   * @throws {SanitizationError} If input sanitization fails or if the output cannot be parsed after all retries.
   * @throws {Error} Propagates errors from the `apiCall` itself (e.g., network errors).
   */
  async process(apiCall) {
    if (typeof apiCall !== 'function') {
      throw new SanitizationError('The "apiCall" argument must be a function that returns a Promise.');
    }

    // Input sanitization is implicitly performed by calling `sanitize()`.
    // The user is expected to pass the result of `sanitize()` to their API call function.
    // This method focuses on the output processing part of the chain.

    let lastError = null;

    for (let attempt = 0; attempt <= this.#config.maxRetries; attempt++) {
      try {
        const rawResponse = await apiCall();

        // Assuming the relevant text is in a standard location.
        // Users can adapt their apiCall to return just the string.
        const responseText = this.#extractResponseText(rawResponse);

        return safeJsonParse(responseText);
      } catch (error) {
        lastError = error;

        // Only retry on JSON parsing errors. Propagate other errors immediately.
        if (error.name !== 'JSONParseError') {
          throw error;
        }

        if (attempt < this.#config.maxRetries) {
          // Optional: Log the retry attempt for debugging purposes.
          // console.log(`Attempt ${attempt + 1} failed. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, this.#config.retryDelay));
        }
      }
    }

    throw new SanitizationError('Failed to process LLM output after all retries.', {
      cause: lastError,
      retries: this.#config.maxRetries,
    });
  }

  /**
   * Helper function to extract the string content from a typical API response.
   * It handles common structures from libraries like axios.
   *
   * @private
   * @param {any} response - The raw response from the API call.
   * @returns {string} The extracted text content.
   */
  #extractResponseText(response) {
    if (typeof response === 'string') {
      return response;
    }
    if (typeof response === 'object' && response !== null) {
      // Common for axios: response.data
      if (response.data) {
        // OpenAI-like structure: response.data.choices[0].message.content
        if (
          Array.isArray(response.data.choices) &&
          response.data.choices.length > 0 &&
          response.data.choices[0].message?.content
        ) {
          return response.data.choices[0].message.content;
        }
        // If response.data is the string itself
        if (typeof response.data === 'string') {
          return response.data;
        }
      }
    }
    // Fallback: convert the response to a string if its structure is unknown.
    return String(response);
  }
}