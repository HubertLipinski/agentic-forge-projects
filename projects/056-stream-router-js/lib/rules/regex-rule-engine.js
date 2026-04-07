/**
 * @file lib/rules/regex-rule-engine.js
 * @description Implements a rule engine that evaluates string/buffer data chunks using Regular Expressions.
 * This engine is ideal for text-based streams (like logs or CSV) where pattern matching
 * is required to categorize or filter data.
 */

import { BaseRuleEngine } from './base-rule-engine.js';
import { StreamProcessingError, ConfigurationError } from '../utils/errors.js';

/**
 * A cache to store compiled RegExp objects.
 * This avoids the performance overhead of recompiling the same regular expression
 * string on every chunk evaluation. The key is the regex string, and the value
 * is the compiled RegExp object.
 *
 * @private
 * @type {Map<string, RegExp>}
 */
const regexCache = new Map();

/**
 * Compiles a string into a regular expression object, with caching.
 *
 * @private
 * @param {string} pattern - The regular expression pattern string.
 * @returns {RegExp} The compiled regular expression object.
 * @throws {ConfigurationError} If the pattern is an invalid regular expression.
 */
function getCompiledRegex(pattern) {
  if (regexCache.has(pattern)) {
    return regexCache.get(pattern);
  }

  try {
    const regex = new RegExp(pattern);
    regexCache.set(pattern, regex);
    return regex;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigurationError(
        `Invalid regular expression pattern provided: "${pattern}"`,
        { cause: error }
      );
    }
    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * A rule engine that evaluates data chunks using Regular Expressions.
 *
 * This engine is suitable for streams that are not in `objectMode`. It converts
 * incoming data chunks (Buffers or strings) into strings and then tests them
 * against a regular expression.
 *
 * @class RegexRuleEngine
 * @extends {BaseRuleEngine}
 */
export class RegexRuleEngine extends BaseRuleEngine {
  /**
   * Evaluates a data chunk against a regular expression.
   *
   * The method performs the following steps:
   * 1. Converts the input `chunk` to a string. Buffers are decoded using 'utf8'.
   * 2. If the `expression` is a string, it's compiled into a `RegExp` object (and cached for performance).
   *    If it's already a `RegExp` object, it's used directly.
   * 3. The regular expression's `test()` method is called on the stringified chunk.
   *
   * @override
   * @param {Buffer|string|any} chunk - The data chunk from the stream. Best suited for Buffers and strings.
   * @param {string|RegExp} expression - The regular expression pattern string (e.g., 'ERROR|FATAL') or a `RegExp` object.
   * @returns {boolean} `true` if the regular expression finds a match in the chunk, `false` otherwise.
   * @throws {StreamProcessingError} If the chunk is an object and cannot be meaningfully converted to a string.
   * @throws {ConfigurationError} If the provided expression string is not a valid regular expression.
   */
  evaluate(chunk, expression) {
    let text;

    if (Buffer.isBuffer(chunk)) {
      text = chunk.toString('utf8');
    } else if (typeof chunk === 'string') {
      text = chunk;
    } else if (chunk === null || chunk === undefined) {
      return false; // No text to match against.
    } else if (typeof chunk.toString === 'function' && chunk.toString !== Object.prototype.toString) {
      // For objects with a custom `toString` method, use it.
      text = chunk.toString();
    } else {
      // For plain objects or other types that don't convert well to a searchable string,
      // we consider it a non-match or a misconfiguration. Throwing helps identify this.
      throw new StreamProcessingError(
        'RegexRuleEngine received a chunk that is not a Buffer, string, or object with a custom toString method. Evaluation cannot proceed.',
        chunk
      );
    }

    let regex;
    if (expression instanceof RegExp) {
      regex = expression;
    } else if (typeof expression === 'string') {
      // This will throw a ConfigurationError for invalid patterns, which is appropriate
      // as it's a setup issue, not a stream processing issue.
      regex = getCompiledRegex(expression);
    } else {
      throw new ConfigurationError(
        `Invalid expression type for RegexRuleEngine. Expected a string or RegExp object, but received ${typeof expression}.`
      );
    }

    // Use RegExp.prototype.test() for a boolean result, which is faster than `match()`
    // when we only need to know if a match exists.
    return regex.test(text);
  }
}