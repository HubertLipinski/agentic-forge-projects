import deepmerge from 'deepmerge';
import logger from './utils/logger.js';

/**
 * @file Core merging logic. Takes an array of parsed JSON objects and a
 * configuration object, then uses 'deepmerge' to combine them according to the
 * specified array strategy.
 */

/**
 * Enum-like object for array merge strategies.
 * Using an object provides better readability and autocompletion than raw strings.
 * @readonly
 * @enum {string}
 */
export const ArrayMergeStrategy = {
  /** Concatenate arrays. The default behavior of `deepmerge`. */
  CONCAT: 'concat',
  /** Replace the target array with the source array. */
  REPLACE: 'replace',
  /** Perform a deep merge on the elements of the arrays. */
  MERGE: 'merge',
};

/**
 * A custom array merge function for `deepmerge` that replaces the target array
 * with the source array.
 * @param {Array<any>} target - The array from the object being merged into.
 * @param {Array<any>} source - The array from the object being merged.
 * @returns {Array<any>} The source array.
 */
const replaceArrayMerge = (target, source) => source;

/**
 * A custom array merge function for `deepmerge` that deeply merges the contents
 * of two arrays. It merges objects at the same index.
 * @param {Array<any>} target - The array from the object being merged into.
 * @param {Array<any>} source - The array from the object being merged.
 * @param {object} options - The `deepmerge` options object.
 * @returns {Array<any>} The merged array.
 */
const deepMergeArray = (target, source, options) => {
  const destination = target.slice();

  source.forEach((item, index) => {
    // If the target has an item at the same index and both are mergeable objects,
    // perform a deep merge. Otherwise, replace or add the source item.
    if (
      destination[index] !== undefined &&
      typeof destination[index] === 'object' &&
      destination[index] !== null &&
      !Array.isArray(destination[index]) &&
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item)
    ) {
      destination[index] = deepmerge(destination[index], item, options);
    } else {
      // If source item is not an object or target doesn't have an item at the index,
      // we replace/set the value. Using structuredClone to avoid reference sharing.
      destination[index] = structuredClone(item);
    }
  });

  return destination;
};

/**
 * Selects the appropriate array merging function based on the specified strategy.
 *
 * @param {ArrayMergeStrategy} strategy - The desired array merging strategy.
 * @returns {Function} The corresponding array merge function for `deepmerge`.
 *   Returns `undefined` for the default 'concat' strategy, as `deepmerge`
 *   handles this natively when no custom function is provided.
 */
function getArrayMergeFunction(strategy) {
  switch (strategy) {
    case ArrayMergeStrategy.REPLACE:
      logger.verbose('Using "replace" array merge strategy.');
      return replaceArrayMerge;
    case ArrayMergeStrategy.MERGE:
      logger.verbose('Using "deep merge" array merge strategy.');
      return deepMergeArray;
    case ArrayMergeStrategy.CONCAT:
      logger.verbose('Using "concat" array merge strategy (default).');
      // `deepmerge` defaults to concatenating arrays, so we don't need a custom function.
      return undefined;
    default:
      logger.warn(
        `Unknown array merge strategy: "${strategy}". Falling back to default "concat" strategy.`
      );
      return undefined;
  }
}

/**
 * Merges an array of objects into a single object using a deep merge strategy.
 * The merge is performed sequentially, with each object in the array being merged
 * into the result of the previous merges.
 *
 * @param {object[]} objects - An array of objects to merge. Must not be empty.
 * @param {object} [options={}] - Configuration options for the merge.
 * @param {ArrayMergeStrategy} [options.arrayMerge=ArrayMergeStrategy.CONCAT] - The strategy for merging arrays.
 * @returns {object} The final merged object.
 * @throws {Error} if the input `objects` array is empty or not an array.
 */
export function mergeObjects(
  objects,
  { arrayMerge = ArrayMergeStrategy.CONCAT } = {}
) {
  if (!Array.isArray(objects) || objects.length === 0) {
    logger.warn('No objects provided to merge. Returning an empty object.');
    return {};
  }

  logger.verbose(`Starting merge of ${objects.length} objects.`);

  const arrayMergeFunction = getArrayMergeFunction(arrayMerge);

  const mergeOptions = {
    // Pass the custom array merge function if one was selected.
    ...(arrayMergeFunction && { arrayMerge: arrayMergeFunction }),
  };

  // Use reduce to sequentially merge objects. The first object is the initial value.
  // We use structuredClone on the first object to prevent mutating the original input.
  const mergedResult = objects.reduce((accumulator, currentObject) => {
    // Ensure we are only merging valid objects.
    if (typeof currentObject === 'object' && currentObject !== null) {
      return deepmerge(accumulator, currentObject, mergeOptions);
    }
    logger.warn('Encountered a non-object item in the list to be merged; it will be skipped.');
    return accumulator;
  }, structuredClone(objects[0] ?? {})); // Start with a deep copy of the first object or an empty object.

  // If there was more than one object, merge the rest.
  if (objects.length > 1) {
    const restObjects = objects.slice(1);
    return restObjects.reduce((accumulator, currentObject) => {
        if (typeof currentObject === 'object' && currentObject !== null) {
            return deepmerge(accumulator, currentObject, mergeOptions);
        }
        logger.warn('Encountered a non-object item in the list to be merged; it will be skipped.');
        return accumulator;
    }, mergedResult);
  }

  return mergedResult;
}