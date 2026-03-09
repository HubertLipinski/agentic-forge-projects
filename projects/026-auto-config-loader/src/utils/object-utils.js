/**
 * @file src/utils/object-utils.js
 * @description Utility functions for object manipulation, including deep merging and
 *              handling nested properties with dot notation.
 */

/**
 * Checks if a value is a plain object.
 * An object is considered "plain" if it's created by the `Object` constructor
 * or `Object.create(null)`.
 * @param {any} value The value to check.
 * @returns {boolean} `true` if the value is a plain object, otherwise `false`.
 */
const isObject = (value) => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Deeply merges multiple source objects into a target object.
 * Arrays are replaced, not merged. The function modifies the target object.
 * To avoid modifying the original object, pass an empty object as the first argument.
 *
 * @example
 * const obj1 = { a: 1, b: { c: 2 } };
 * const obj2 = { b: { d: 3 }, e: 4 };
 * const merged = deepMerge({}, obj1, obj2);
 * // merged is { a: 1, b: { c: 2, d: 3 }, e: 4 }
 *
 * @param {object} target The object to merge into.
 * @param {...object} sources The source objects to merge from.
 * @returns {object} The modified target object.
 */
export function deepMerge(target, ...sources) {
  if (!sources.length) {
    return target;
  }
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key] || !isObject(target[key])) {
          target[key] = {};
        }
        deepMerge(target[key], source[key]);
      } else {
        // This includes arrays, primitives, etc. The source value overwrites the target.
        target[key] = source[key];
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Retrieves a nested value from an object using a dot-notation path.
 *
 * @example
 * const obj = { a: { b: { c: 'hello' } } };
 * get(obj, 'a.b.c'); // 'hello'
 * get(obj, 'a.x.y', 'default'); // 'default'
 *
 * @param {object} obj The object to query.
 * @param {string} path The dot-notation path to the desired value.
 * @param {any} [defaultValue=undefined] The value to return if the path is not found.
 * @returns {any} The value at the specified path or the default value.
 */
export function get(obj, path, defaultValue = undefined) {
  if (!path || typeof path !== 'string') {
    return defaultValue;
  }

  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[key];
  }

  return result === undefined ? defaultValue : result;
}

/**
 * Sets a nested value in an object using a dot-notation path.
 * It creates nested objects if they do not exist along the path.
 * This function modifies the input object.
 *
 * @example
 * const obj = {};
 * set(obj, 'a.b.c', 'world');
 * // obj is now { a: { b: { c: 'world' } } }
 *
 * @param {object} obj The object to modify.
 * @param {string} path The dot-notation path where the value should be set.
 * @param {any} value The value to set.
 * @returns {object} The modified object.
 */
export function set(obj, path, value) {
  if (!isObject(obj) || typeof path !== 'string') {
    return obj;
  }

  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = obj;

  for (const key of keys) {
    if (!isObject(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }

  if (lastKey) {
    current[lastKey] = value;
  }

  return obj;
}