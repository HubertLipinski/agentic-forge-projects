/**
 * @fileoverview A service for transforming JSON payloads using JSONata expressions.
 * This module provides a function to apply a JSONata transformation to a given
 * payload, which is a core feature for adapting incoming webhooks to the format
 * expected by downstream services. It includes caching for compiled expressions
 * to optimize performance for repeated transformations.
 */

import jsonata from 'jsonata';
import logger from '../utils/logger.js';

/**
 * A Map to cache compiled JSONata expressions.
 * The key is the JSONata expression string, and the value is the compiled
 * expression object from the `jsonata` library.
 *
 * Caching is a crucial performance optimization. Parsing and compiling a JSONata
 * expression can be computationally expensive. By caching the compiled result,
 * we avoid this overhead on subsequent requests that use the same transformation
* expression, which is the common case for a given route.
 *
 * @type {Map<string, import('jsonata').Expression>}
 */
const expressionCache = new Map();

/**
 * Compiles a JSONata expression string or retrieves it from the cache.
 *
 * This function encapsulates the logic for compiling and caching. If an expression
 * is already in the cache, it's returned immediately. Otherwise, it's compiled
 * using the `jsonata` library, added to the cache, and then returned.
 *
 * @param {string} expressionString - The JSONata expression to compile.
 * @returns {import('jsonata').Expression} The compiled JSONata expression object.
 * @throws {Error} If the expression string is invalid and fails to compile.
 */
function getCompiledExpression(expressionString) {
  if (expressionCache.has(expressionString)) {
    return expressionCache.get(expressionString);
  }

  try {
    const compiledExpression = jsonata(expressionString);
    expressionCache.set(expressionString, compiledExpression);
    logger.trace({ expression: expressionString }, 'JSONata expression compiled and cached.');
    return compiledExpression;
  } catch (error) {
    // This is a critical configuration error. An invalid expression should
    // ideally be caught at startup, but we handle it here defensively.
    logger.error(
      { err: error, expression: expressionString },
      'Failed to compile JSONata expression. This indicates an invalid expression in the route configuration.'
    );
    // Re-throw a more specific error to be handled by the calling function.
    throw new Error(`Invalid JSONata expression: ${error.message}`);
  }
}

/**
 * Transforms a JSON payload using a given JSONata expression.
 *
 * This is the main function of the module. It takes a payload and an expression,
 * retrieves the compiled expression (from cache or by compiling it), and then
 * applies the transformation. It handles potential errors during the evaluation
 * process, such as type mismatches or other runtime issues within the JSONata engine.
 *
 * @param {object} payload - The input JSON object to be transformed.
 * @param {string} expressionString - The JSONata expression string to apply.
 * @returns {Promise<object>} A promise that resolves with the transformed payload.
 * @throws {Error} If the transformation fails due to an invalid expression or an
 *                 error during evaluation.
 */
export async function transformPayload(payload, expressionString) {
  if (!expressionString) {
    logger.debug('No transformation expression provided. Returning original payload.');
    // Return a deep copy to prevent accidental mutation of the original payload
    // in subsequent processing steps, ensuring data isolation.
    return structuredClone(payload);
  }

  try {
    const expression = getCompiledExpression(expressionString);

    // `evaluate` can be synchronous or asynchronous depending on the functions used
    // in the expression. Using `await` handles both cases correctly.
    const transformedPayload = await expression.evaluate(payload);

    // The result of a JSONata expression can be any JSON type, including primitives,
    // null, or undefined. If the result is not an object, it could be an intentional
    // reduction of data or an error in the expression. We log a warning for non-object
    // results as it might be an unintended consequence.
    if (typeof transformedPayload !== 'object' || transformedPayload === null) {
      logger.warn(
        {
          expression: expressionString,
          resultType: transformedPayload === null ? 'null' : typeof transformedPayload,
        },
        'Transformation resulted in a non-object payload. This may be unintentional.'
      );
    }

    return transformedPayload;
  } catch (error) {
    // This block catches errors from both `getCompiledExpression` and `expression.evaluate`.
    logger.error(
      { err: error, expression: expressionString },
      'An error occurred during payload transformation.'
    );
    // Propagate the error to the route handler to be managed appropriately,
    // likely resulting in a 500 Internal Server Error response.
    throw new Error(`Payload transformation failed: ${error.message}`);
  }
}