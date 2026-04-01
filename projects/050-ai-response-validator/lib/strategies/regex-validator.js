/**
 * @file lib/strategies/regex-validator.js
 * @description Implements the validation strategy for matching string output against a user-provided regular expression.
 * @module lib/strategies/regex-validator
 */

import { VALIDATION_STRATEGIES } from '../constants.js';
import { ValidationError } from '../errors.js';

/**
 * A validation strategy for ensuring a string matches a given regular expression.
 *
 * This class checks if the input string contains a match for the provided
 * regular expression pattern. It can be configured to find the first match
 * or all matches within the string.
 */
export class RegexValidator {
  /**
   * The unique identifier for this validation strategy.
   * @type {string}
   */
  static name = VALIDATION_STRATEGIES.REGEX;

  /**
   * The regular expression to validate against.
   * @type {RegExp}
   * @private
   */
  #regex;

  /**
   * Creates an instance of RegexValidator.
   *
   * @param {object} options - Configuration options for the validator.
   * @param {RegExp|string} options.pattern - The regular expression pattern to match against.
   *   If a string is provided, it will be converted to a RegExp object.
   * @param {string} [options.flags] - Optional regex flags (e.g., 'g', 'i', 'm') to apply
   *   if `pattern` is provided as a string. Ignored if `pattern` is already a RegExp object.
   * @throws {ValidationError} If the pattern is missing or invalid.
   */
  constructor(options = {}) {
    const { pattern, flags } = options;

    if (!pattern) {
      throw new ValidationError(
        'RegexValidator requires a `pattern` option (string or RegExp).',
      );
    }

    if (pattern instanceof RegExp) {
      this.#regex = pattern;
    } else if (typeof pattern === 'string') {
      try {
        this.#regex = new RegExp(pattern, flags);
      } catch (error) {
        throw new ValidationError(
          `Invalid regular expression pattern or flags: ${error.message}`,
          { cause: error },
        );
      }
    } else {
      throw new ValidationError(
        'The `pattern` option must be a string or a RegExp instance.',
      );
    }
  }

  /**
   * Validates the given LLM response string against the configured regular expression.
   *
   * The method tests the input string against the regex. If a match is found,
   * validation is successful. The `data` field of the result will contain the
   * match details.
   *
   * @param {string} response - The string response from the LLM.
   * @returns {Promise<{ isValid: boolean, data: RegExpExecArray | RegExpMatchArray | null, error: string | null }>}
   * An object indicating the validation result.
   * - `isValid`: `true` if the regex matches the response, `false` otherwise.
   * - `data`: If the regex has the global flag (`g`), this will be an array of all matches.
   *   Otherwise, it will be the result of `regex.exec()`, containing the first match and
   *   any capture groups. If no match is found, this is `null`.
   * - `error`: A descriptive error message if validation fails, otherwise `null`.
   */
  async validate(response) {
    if (typeof response !== 'string') {
      return {
        isValid: false,
        data: null,
        error: 'Invalid input: The response to validate must be a string.',
      };
    }

    // The 'g' flag changes the behavior of string.match().
    if (this.#regex.global) {
      const matches = response.match(this.#regex);
      if (matches) {
        return {
          isValid: true,
          data: matches, // Array of all matching substrings
          error: null,
        };
      }
    } else {
      const match = this.#regex.exec(response);
      if (match) {
        return {
          isValid: true,
          data: match, // RegExpExecArray with groups
          error: null,
        };
      }
    }

    // If we reach here, no match was found.
    return {
      isValid: false,
      data: null,
      error: `Regex validation failed: The response did not match the pattern /${this.#regex.source}/${this.#regex.flags}.`,
    };
  }
}