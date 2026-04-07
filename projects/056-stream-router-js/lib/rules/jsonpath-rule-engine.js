/**
 * @file lib/rules/jsonpath-rule-engine.js
 * @description Implements a rule engine that evaluates data chunks using JSONPath expressions.
 * This engine is designed to work with streams in Object Mode, where each chunk is a
 * JavaScript object. It parses the chunk if it's a string, then applies the JSONPath
 * expression to determine if the rule matches.
 */

import { JSONPath } from 'jsonpath-plus';
import { BaseRuleEngine } from './base-rule-engine.js';
import { StreamProcessingError } from '../utils/errors.js';

/**
 * A rule engine that evaluates data chunks using JSONPath expressions.
 *
 * This engine is suitable for streams in `objectMode`. It first attempts to parse
 * the incoming data chunk as JSON if it's a string or Buffer. Then, it uses the
 * `jsonpath-plus` library to check if the provided JSONPath expression finds any
 * matching nodes within the parsed object.
 *
 * @class JSONPathRuleEngine
 * @extends {BaseRuleEngine}
 */
export class JSONPathRuleEngine extends BaseRuleEngine {
  /**
   * Evaluates a data chunk against a JSONPath expression.
   *
   * The method performs the following steps:
   * 1. Parses the input `chunk`. If the chunk is a string or Buffer, it's treated as a JSON string.
   *    If it's already an object, it's used directly.
   * 2. Applies the `expression` (a JSONPath string) to the parsed object.
   * 3. The rule is considered a match if the JSONPath query returns at least one result.
   *
   * @override
   * @param {any} chunk - The data chunk from the stream. Expected to be a JSON string, a Buffer containing a JSON string, or a JavaScript object.
   * @param {string} expression - The JSONPath expression string (e.g., '$.level' or '$.sensors[?(@.value > 50)]').
   * @returns {boolean} `true` if the JSONPath expression finds one or more matches in the chunk, `false` otherwise.
   * @throws {StreamProcessingError} If the chunk is a string or Buffer but cannot be parsed as valid JSON.
   */
  evaluate(chunk, expression) {
    let dataObject;

    try {
      if (Buffer.isBuffer(chunk)) {
        dataObject = JSON.parse(chunk.toString('utf8'));
      } else if (typeof chunk === 'string') {
        dataObject = JSON.parse(chunk);
      } else if (typeof chunk === 'object' && chunk !== null) {
        // Assume it's already a parsed object (from objectMode stream)
        dataObject = chunk;
      } else {
        // For other primitive types (number, boolean, etc.), JSONPath can't be applied.
        return false;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        // Wrap JSON parsing errors in a more informative, library-specific error.
        throw new StreamProcessingError(
          'Failed to parse chunk as JSON for JSONPath evaluation.',
          chunk,
          { cause: error }
        );
      }
      // Re-throw other unexpected errors.
      throw error;
    }

    try {
      const result = JSONPath({
        path: expression,
        json: dataObject,
        wrap: false, // Don't wrap the result in an array if it's a single value
        preventEval: true // Security: disable `eval()` for script expressions
      });

      // A match occurs if the path exists. `JSONPath` returns `undefined` for no match,
      // or an empty array if the path is valid but finds nothing.
      // We check if the result is not undefined and, if it's an array, that it's not empty.
      return result !== undefined && (!Array.isArray(result) || result.length > 0);
    } catch (error) {
      // Catch errors from jsonpath-plus, e.g., invalid path syntax.
      throw new StreamProcessingError(
        `JSONPath evaluation failed for expression: "${expression}"`,
        chunk,
        { cause: error }
      );
    }
  }
}