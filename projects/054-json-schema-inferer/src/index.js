/**
 * @file src/index.js
 * @description Main public API entry point for the JSON Schema Inferer library.
 * This module exports the primary `infer` function, which serves as the
 * programmatic interface for the tool. It handles both single JSON objects
 * and arrays of objects, orchestrating the inference and merging logic.
 */

import { inferSchema } from './inferer.js';
import { mergeSchemas } from './utils/schema-merger.js';
import { isObject, isArray } from './utils/type-utils.js';

/**
 * Infers a JSON Schema from a single JSON object or an array of JSON objects.
 *
 * This is the main public function of the library.
 * - If the input is a single object, it generates a schema for that object.
 * - If the input is an array of objects, it generates a schema for each object
 *   and then merges them into a single, comprehensive schema that represents
 *   the entire collection. This process correctly identifies optional properties
 *   and fields with multiple possible types.
 *
 * @public
 * @param {object|object[]} jsonData - The sample data. Can be a single JSON object
 *   or an array of JSON objects.
 * @returns {object} The generated JSON Schema object (draft 2020-12).
 * @throws {TypeError} If the input is not a plain object or an array of objects.
 * @throws {Error} If the input array is empty or contains non-object items.
 */
export function infer(jsonData) {
  if (isObject(jsonData)) {
    // Handle the case of a single JSON object.
    return inferSchema(jsonData);
  }

  if (isArray(jsonData)) {
    // Handle the case of an array of JSON objects.
    if (jsonData.length === 0) {
      throw new Error('Input array cannot be empty. Provide at least one sample object.');
    }

    // Ensure all items in the array are objects before proceeding.
    const firstNonObject = jsonData.find(item => !isObject(item));
    if (firstNonObject !== undefined) {
      const itemString = JSON.stringify(firstNonObject, null, 2);
      throw new TypeError(`Input array must contain only objects. Found non-object item: ${itemString}`);
    }

    // Infer a schema for each object in the array.
    const schemas = jsonData.map(obj => inferSchema(obj));

    // Merge all the generated schemas into one.
    // The reduce operation starts with the first schema and iteratively
    // merges the subsequent ones into it.
    const mergedSchema = schemas.reduce(mergeSchemas);

    return mergedSchema;
  }

  // If the input is neither a plain object nor an array, it's invalid.
  throw new TypeError('Input must be a single JSON object or an array of JSON objects.');
}