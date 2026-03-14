/**
 * @fileoverview Formats JavaScript objects into a stable, canonical string
 * representation for consistent snapshot storage. This ensures that snapshots
 * are deterministic and comparable across test runs, regardless of insignificant
 * variations like object property order.
 */

/**
 * A custom replacer function for `JSON.stringify` that handles special
 * JavaScript types and ensures a canonical representation.
 *
 * - Converts `undefined` to a special marker string to prevent it from being
 *   omitted in arrays or causing properties to be dropped.
 * - Converts `BigInt` values to a string representation with an 'n' suffix.
 * - Converts `Date` objects to their ISO string representation.
 * - Converts `RegExp` objects to their string representation.
 * - Converts `Set` objects to a sorted array for stable ordering.
 * - Converts `Map` objects to a sorted array of key-value pairs.
 * - Detects and handles circular references by replacing them with a marker.
 *
 * @param {string} key The key of the property being stringified.
 * @param {*} value The value of the property being stringified.
 * @returns {*} The transformed value suitable for stable stringification.
 */
function stableJsonReplacer() {
  const cache = new Set();
  const path = [];

  return (key, value) => {
    // Handle `undefined` explicitly, as JSON.stringify omits it.
    if (value === undefined) {
      return '__UNDEFINED__';
    }

    // Handle `BigInt` values, which throw a TypeError by default.
    if (typeof value === 'bigint') {
      return `${value.toString()}n`;
    }

    if (typeof value === 'object' && value !== null) {
      // Handle circular references to prevent infinite recursion.
      if (cache.has(value)) {
        return '[Circular]';
      }
      cache.add(value);
      path.push(value);

      // Convert `Date` objects to a consistent string format.
      if (value instanceof Date) {
        return value.toISOString();
      }

      // Convert `RegExp` objects to their string representation.
      if (value instanceof RegExp) {
        return value.toString();
      }

      // Convert `Set` to a sorted array for deterministic output.
      if (value instanceof Set) {
        return [...value].sort();
      }

      // Convert `Map` to a sorted array of [key, value] pairs.
      if (value instanceof Map) {
        return [...value.entries()].sort((a, b) => {
          const keyA = String(a[0]);
          const keyB = String(b[0]);
          return keyA.localeCompare(keyB);
        });
      }

      // For plain objects, sort keys to ensure a canonical order.
      if (!Array.isArray(value)) {
        const sortedObject = {};
        const keys = Object.keys(value).sort();
        for (const k of keys) {
          sortedObject[k] = value[k];
        }
        return sortedObject;
      }
    }

    // Clean up cache after processing an object's children.
    if (path.at(-1) === value) {
      cache.delete(value);
      path.pop();
    }

    return value;
  };
}

/**
 * Formats a JavaScript value into a stable, canonical, and pretty-printed
 * string suitable for storing in a snapshot file.
 *
 * This function uses a customized `JSON.stringify` process to handle various
 * JavaScript types and ensure that the output is deterministic. Object keys are
 * sorted alphabetically to prevent diffs caused by property order changes.
 *
 * @param {*} value The JavaScript value (e.g., object, array, primitive) to format.
 * @returns {string} A stable, formatted string representation of the value.
 */
export function formatSnapshot(value) {
  try {
    // The replacer handles sorting and special type conversions.
    // The `space` argument (2) ensures pretty-printing for readability.
    const jsonString = JSON.stringify(value, stableJsonReplacer(), 2);

    // `JSON.stringify` escapes special characters. We can un-escape our marker
    // for `undefined` to make it more readable in the snapshot file.
    // We use a regex with `g` flag to replace all occurrences.
    return jsonString.replace(/"__UNDEFINED__"/g, 'undefined');
  } catch (error) {
    // This might happen with very complex objects or if the replacer fails.
    throw new Error(`Failed to format value for snapshot: ${error.message}`, { cause: error });
  }
}