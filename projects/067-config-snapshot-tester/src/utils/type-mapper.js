/**
 * @fileoverview Utility to recursively map an object's values to their JavaScript types.
 * This is a core component for creating a structural and type-based snapshot of a
 * configuration object, abstracting away the actual values.
 */

/**
 * Returns the specific JavaScript type of a given value. It enhances `typeof` by
 * correctly identifying `null`, `array`, and distinguishing between `number` and `NaN`.
 *
 * @param {*} value - The value to determine the type of.
 * @returns {string} The name of the type (e.g., 'string', 'number', 'boolean', 'object', 'array', 'null', 'undefined', 'symbol', 'bigint', 'function', 'NaN').
 */
function getPreciseType(value) {
  if (value === null) {
    return 'null';
  }
  const baseType = typeof value;
  if (baseType === 'object') {
    if (Array.isArray(value)) {
      return 'array';
    }
    return 'object';
  }
  if (baseType === 'number') {
    // Distinguish between a valid number and NaN, as they are not interchangeable.
    return Number.isNaN(value) ? 'NaN' : 'number';
  }
  return baseType;
}

/**
 * Recursively traverses a JavaScript object or array and maps each value to its
 * JavaScript type name. This creates a "type shape" of the input data.
 *
 * Example:
 *   Input:  { port: 8080, host: 'localhost', features: { enabled: true, list: [1, 2] } }
 *   Output: { port: 'number', host: 'string', features: { enabled: 'boolean', list: 'array' } }
 *
 * This function handles nested objects and arrays, but does not traverse inside arrays.
 * An array is treated as a single type ('array') because we are typically concerned with
 * its presence and type, not the types of its individual elements, which can be inconsistent.
 *
 * @param {object | any[]} data - The input object or array to map.
 * @returns {object | any[]} A new object or array with the same structure, but with values
 *   replaced by their type names as strings.
 * @throws {Error} If the input is not a plain object or an array.
 */
export function mapObjectToTypes(data) {
  const dataType = getPreciseType(data);

  if (dataType !== 'object' && dataType !== 'array') {
    throw new Error(`Input must be a plain object or an array. Received type: ${dataType}`);
  }

  // If it's an array, we don't map its contents, just return a new empty array
  // to signify its presence and type. The differ will see an array on both sides.
  // A more advanced implementation could map each item, but for config structure,
  // simply knowing it's an array is often sufficient and more stable.
  if (dataType === 'array') {
    // We return a new array containing the types of its elements.
    // This provides more detail than just 'array'.
    return data.map(item => {
        const itemType = getPreciseType(item);
        if (itemType === 'object' || itemType === 'array') {
            // Recurse for nested objects/arrays within the array
            return mapObjectToTypes(item);
        }
        return itemType;
    });
  }

  // It's a plain object, so we map its keys.
  const typeMap = {};

  for (const key of Object.keys(data)) {
    const value = data[key];
    const valueType = getPreciseType(value);

    if (valueType === 'object') {
      // Recurse for nested objects
      typeMap[key] = mapObjectToTypes(value);
    } else if (valueType === 'array') {
      // Recurse for arrays to map their contents' types
      typeMap[key] = mapObjectToTypes(value);
    } else {
      // For all primitive types (string, number, boolean, null, etc.)
      typeMap[key] = valueType;
    }
  }

  return typeMap;
}