'use strict';

/**
 * @fileoverview Utility functions for the structured-config-loader.
 * This module provides helpers for deep merging objects, coercing string values
 * to their appropriate types, and making objects immutable. These utilities are
 * foundational to the core logic of the configuration loader.
 *
 * @module src/utils
 */

/**
 * Checks if a value is a plain object (i.e., created by `{}` or `new Object()`).
 * This is used to determine if an object should be deeply merged.
 *
 * @param {any} value The value to check.
 * @returns {boolean} True if the value is a plain object, false otherwise.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || value.nodeType || (value.constructor && value.constructor.prototype.hasOwnProperty('isPrototypeOf') === false)) {
    return false;
  }
  // Check if the prototype has a constructor.
  if (!value.constructor.prototype.isPrototypeOf(value)) {
    return false;
  }
  // It's a plain object.
  return true;
}

/**
 * Deeply merges multiple source objects into a target object.
 * The merge is performed in order, with later sources overwriting earlier ones.
 *
 * - Nested objects are recursively merged.
 * - Arrays are replaced, not merged, as merging array contents can lead to unpredictable results.
 * - Primitives and other types from later sources overwrite earlier ones.
 *
 * @param {object} target The initial object to merge into.
 * @param {...object} sources The source objects to merge.
 * @returns {object} The deeply merged object.
 */
export function deepMerge(target, ...sources) {
  if (!sources.length) {
    return target;
  }

  const source = sources.shift();

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key in source) {
      if (isPlainObject(source[key])) {
        if (!target[key] || !isPlainObject(target[key])) {
          // If target key doesn't exist or is not an object, create a new one.
          target[key] = {};
        }
        // Recursively merge the nested object.
        deepMerge(target[key], source[key]);
      } else {
        // For non-object properties (including arrays), the source value overwrites the target.
        target[key] = source[key];
      }
    }
  }

  // Recurse with the remaining sources.
  return deepMerge(target, ...sources);
}

/**
 * Coerces a string value into a boolean, number, null, or keeps it as a string.
 * This is essential for parsing environment variables and command-line arguments,
 * which are always strings.
 *
 * - 'true' -> true
 * - 'false' -> false
 * - 'null' -> null
 * - '123', '1.23' -> 123, 1.23
 * - 'abc' -> 'abc'
 *
 * @param {string} value The string value to coerce.
 * @returns {boolean | number | null | string} The coerced value.
 */
export function coerceType(value) {
  // If not a string, return as is.
  if (typeof value !== 'string' || value.trim() === '') {
    return value;
  }

  const lowercasedValue = value.toLowerCase();

  if (lowercasedValue === 'true') {
    return true;
  }
  if (lowercasedValue === 'false') {
    return false;
  }
  if (lowercasedValue === 'null') {
    return null;
  }

  // Check if the value is a valid number (integer or float), but not an empty string.
  // The `+value` conversion handles various number formats.
  // `String(+value) === value` ensures that no information was lost (e.g., '123a' becomes 123).
  if (!Number.isNaN(Number(value)) && String(Number(value)) === value) {
    return Number(value);
  }

  return value;
}

/**
 * Creates a deep, immutable copy of an object.
 * This function prevents the final configuration object from being mutated at runtime,
 * ensuring predictable application behavior. It uses `structuredClone` for a robust
 * deep copy and then recursively freezes the object and its nested properties.
 *
 * @param {T} obj The object to make immutable.
 * @returns {Readonly<T>} A deeply frozen, immutable version of the object.
 * @template T
 */
export function makeImmutable(obj) {
  // Use structuredClone for a deep, safe copy. This is more robust than
  // JSON.parse(JSON.stringify(obj)) as it handles more data types (e.g., Date, RegExp).
  const clonedObj = structuredClone(obj);

  // Recursively freeze the cloned object.
  // Object.freeze is shallow, so we must traverse the entire structure.
  const stack = [clonedObj];

  while (stack.length > 0) {
    const current = stack.pop();

    // Freeze the current object/array.
    Object.freeze(current);

    // Add nested objects and arrays to the stack to be frozen.
    for (const key in current) {
      // Ensure we only process own properties and avoid cycles (though structuredClone helps).
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        const prop = current[key];
        // Check if the property is an object or array and not already frozen.
        if (prop !== null && typeof prop === 'object' && !Object.isFrozen(prop)) {
          stack.push(prop);
        }
      }
    }
  }

  return clonedObj;
}