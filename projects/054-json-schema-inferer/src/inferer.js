/**
 * @file src/inferer.js
 * @description Core logic for schema inference from a single JavaScript object.
 * This module contains the recursive function that traverses a JavaScript object
 * and builds a corresponding JSON Schema representation.
 */

import {
  getJsonType,
  isObject,
  isArray,
} from './utils/type-utils.js';
import { mergeSchemas } from './utils/schema-merger.js';

/**
 * Recursively infers a JSON Schema for an array of values.
 * It merges the schemas inferred from each item in the array to produce a
 * single `items` schema that is representative of all elements.
 *
 * @param {Array<*>} arr - The array to infer a schema from.
 * @returns {object} A JSON Schema object for the array.
 */
function inferFromArray(arr) {
  const schema = {
    type: 'array',
  };

  if (arr.length === 0) {
    // If the array is empty, we cannot infer the type of its items.
    // We leave the `items` property undefined, which in JSON Schema means
    // any type is allowed.
    return schema;
  }

  // Infer schema for each item and then merge them together.
  // This correctly handles arrays with items of different types or structures.
  const itemSchemas = arr.map((item) => inferFromValue(item));

  // Use reduce with mergeSchemas to combine all individual item schemas
  // into a single, comprehensive schema for the `items` property.
  schema.items = itemSchemas.reduce(mergeSchemas);

  return schema;
}

/**
 * Recursively infers a JSON Schema for a JavaScript object.
 * It processes each key-value pair, infers the schema for the value,
 * and marks all keys as 'required' for this single object.
 *
 * @param {object} obj - The object to infer a schema from.
 * @returns {object} A JSON Schema object for the object.
 */
function inferFromObject(obj) {
  const schema = {
    type: 'object',
    properties: {},
  };

  const keys = Object.keys(obj);

  if (keys.length === 0) {
    // For an empty object, we don't add 'properties' or 'required'.
    return schema;
  }

  // In the context of a single object, all its properties are considered required.
  // The schema-merger will later adjust this if other objects lack these properties.
  schema.required = keys.sort();

  for (const key of keys) {
    const value = obj[key];
    // Recurse to infer the schema for the property's value.
    schema.properties[key] = inferFromValue(value);
  }

  return schema;
}

/**
 * Infers a JSON Schema from a single JavaScript value.
 * This function acts as a dispatcher, determining the value's type and
 * delegating to the appropriate specialized inference function (e.g.,
 * `inferFromObject`, `inferFromArray`) or handling primitive types directly.
 *
 * @param {*} value - The JavaScript value to analyze.
 * @returns {object} The inferred JSON Schema for the value.
 */
function inferFromValue(value) {
  const type = getJsonType(value);

  if (type === 'object') {
    return inferFromObject(value);
  }

  if (type === 'array') {
    return inferFromArray(value);
  }

  // For primitive types (string, number, integer, boolean, null),
  // the schema is a simple object with a 'type' property.
  return { type };
}

/**
 * Generates a draft JSON Schema (version 2020-12) from a single JSON-compatible
 * JavaScript object. This is the main exported function of the module.
 *
 * It validates the input and initiates the recursive inference process.
 *
 * @param {object} jsonObject - The JavaScript object to infer a schema from.
 * @returns {object} The generated JSON Schema object.
 * @throws {Error} If the input is not a plain object.
 */
export function inferSchema(jsonObject) {
  if (!isObject(jsonObject)) {
    throw new Error('Input must be a valid JSON object.');
  }

  // Start the inference process from the top-level object.
  const schema = inferFromValue(jsonObject);

  // Add the standard $schema property to indicate the specification version.
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...schema,
  };
}