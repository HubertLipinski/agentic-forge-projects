/**
 * @file src/utils/type-utils.js
 * @description Utility functions for determining the JSON type of JavaScript values.
 * This module provides a set of pure functions to check the type of a given value,
 * aligning with the types defined in the JSON Schema specification.
 */

/**
 * Checks if a value is a string.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a string, false otherwise.
 */
export const isString = (value) => typeof value === 'string';

/**
 * Checks if a value is a number (including integers and floats).
 * Note: This returns false for NaN and Infinity, which are not valid JSON numbers.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a finite number, false otherwise.
 */
export const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Checks if a value is an integer.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is an integer, false otherwise.
 */
export const isInteger = (value) => Number.isInteger(value);

/**
 * Checks if a value is a boolean.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a boolean, false otherwise.
 */
export const isBoolean = (value) => typeof value === 'boolean';

/**
 * Checks if a value is null.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is null, false otherwise.
 */
export const isNull = (value) => value === null;

/**
 * Checks if a value is a plain object (i.e., not an array or null).
 * In the context of JSON, an "object" is a collection of key/value pairs.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a plain object, false otherwise.
 */
export const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Checks if a value is an array.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is an array, false otherwise.
 */
export const isArray = (value) => Array.isArray(value);

/**
 * Determines the JSON schema type name for a given JavaScript value.
 * This function maps a JavaScript value to one of the seven primitive types
 * defined in the JSON Schema specification: "string", "number", "integer",
 * "boolean", "object", "array", or "null".
 *
 * @param {*} value - The JavaScript value to analyze.
 * @returns {string} The corresponding JSON schema type name.
 */
export const getJsonType = (value) => {
  if (isNull(value)) return 'null';
  if (isBoolean(value)) return 'boolean';
  if (isInteger(value)) return 'integer';
  if (isNumber(value)) return 'number';
  if (isString(value)) return 'string';
  if (isArray(value)) return 'array';
  if (isObject(value)) return 'object';

  // This case should theoretically be unreachable for any valid JSON value,
  // but it handles edge cases like `undefined`, `Symbol`, or `Function`.
  // We'll classify them as 'null' as they don't have a direct JSON representation.
  return 'null';
};