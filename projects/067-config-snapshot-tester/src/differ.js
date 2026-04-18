/**
 * @fileoverview Core logic for comparing two type-mapped objects.
 *
 * This module provides the engine for detecting structural and type differences
 * between a stored snapshot and a current configuration object. It performs a
 * deep, recursive comparison and generates a structured report detailing any
 * additions, removals, or type mismatches, while respecting an ignore list.
 */

/**
 * @typedef {'added' | 'removed' | 'type-changed'} DiffType
 * The type of difference found between the snapshot and the current object.
 */

/**
 * @typedef {object} DiffEntry
 * An object representing a single difference found during comparison.
 * @property {string} path - The dot-notation path to the key where the difference occurred.
 * @property {DiffType} type - The type of change (added, removed, or type-changed).
 * @property {string} [expected] - The expected type (for 'removed' and 'type-changed').
 * @property {string} [actual] - The actual type (for 'added' and 'type-changed').
 */

/**
 * Checks if a given path should be ignored based on a list of ignore patterns.
 * Currently supports exact dot-notation path matching.
 *
 * @param {string} currentPath - The dot-notation path to check (e.g., 'db.host').
 * @param {Set<string>} ignoreSet - A Set of dot-notation paths to ignore.
 * @returns {boolean} - True if the path should be ignored, false otherwise.
 */
function isPathIgnored(currentPath, ignoreSet) {
  return ignoreSet.has(currentPath);
}

/**
 * Recursively compares two type-mapped objects to find differences.
 *
 * This is the core comparison engine. It traverses both objects simultaneously,
 * building a list of differences based on key presence and type equality.
 *
 * @param {object} snapshot - The type-mapped snapshot object (expected state).
 * @param {object} current - The type-mapped current object (actual state).
 * @param {Set<string>} ignoreSet - A Set of dot-notation paths to ignore.
 * @param {string} [currentPath=''] - The current path in the object tree, used for recursion.
 * @returns {DiffEntry[]} An array of diff entries.
 */
function recursiveDiff(snapshot, current, ignoreSet, currentPath = '') {
  // Ensure inputs are valid objects to prevent runtime errors on malformed snapshots.
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
    throw new Error(`Invalid snapshot data at path '${currentPath || 'root'}'. Expected an object.`);
  }
  if (typeof current !== 'object' || current === null || Array.isArray(current)) {
    throw new Error(`Invalid current config data at path '${currentPath || 'root'}'. Expected an object.`);
  }

  const diffs = [];
  const snapshotKeys = new Set(Object.keys(snapshot));
  const currentKeys = new Set(Object.keys(current));

  // 1. Check for removed keys and type changes
  for (const key of snapshotKeys) {
    const path = currentPath ? `${currentPath}.${key}` : key;

    if (isPathIgnored(path, ignoreSet)) {
      continue;
    }

    if (!currentKeys.has(key)) {
      diffs.push({
        path,
        type: 'removed',
        expected: typeof snapshot[key] === 'object' ? 'object' : snapshot[key],
      });
      continue;
    }

    const snapshotValue = snapshot[key];
    const currentValue = current[key];
    const snapshotType = Array.isArray(snapshotValue) ? 'array' : typeof snapshotValue;
    const currentType = Array.isArray(currentValue) ? 'array' : typeof currentValue;

    if (snapshotType === 'object' && currentType === 'object') {
      // Both are objects, recurse deeper.
      diffs.push(...recursiveDiff(snapshotValue, currentValue, ignoreSet, path));
    } else if (snapshotValue !== currentValue) {
      // For primitives or when types differ (e.g., object vs. string), record a type change.
      // This also handles array vs. non-array mismatches.
      diffs.push({
        path,
        type: 'type-changed',
        expected: String(snapshotValue),
        actual: String(currentValue),
      });
    }
  }

  // 2. Check for added keys
  for (const key of currentKeys) {
    const path = currentPath ? `${currentPath}.${key}` : key;

    if (isPathIgnored(path, ignoreSet)) {
      continue;
    }

    if (!snapshotKeys.has(key)) {
      diffs.push({
        path,
        type: 'added',
        actual: typeof current[key] === 'object' ? 'object' : current[key],
      });
    }
  }

  return diffs;
}

/**
 * Compares a snapshot type-map with a current configuration type-map and returns a structured diff.
 *
 * This function serves as the public entry point for the diffing logic. It orchestrates
 * the comparison and handles initial setup, including managing the ignore list.
 *
 * @param {object} snapshotObject - The type-mapped object from the stored snapshot.
 * @param {object} currentObject - The type-mapped object from the current configuration file.
 * @param {object} [options={}] - Configuration options for the diffing process.
 * @param {string[]} [options.ignore=[]] - An array of dot-notation paths to ignore during comparison.
 * @returns {{areEqual: boolean, diffs: DiffEntry[]}} An object containing a boolean indicating
 *   if the objects are equal and an array of differences.
 * @throws {Error} If input objects are not valid.
 */
export function compareObjects(snapshotObject, currentObject, options = {}) {
  const { ignore = [] } = options;

  if (!snapshotObject || typeof snapshotObject !== 'object') {
    throw new Error('compareObjects requires a valid snapshotObject (must be an object).');
  }
  if (!currentObject || typeof currentObject !== 'object') {
    throw new Error('compareObjects requires a valid currentObject (must be an object).');
  }
  if (!Array.isArray(ignore)) {
    throw new Error('The `ignore` option, if provided, must be an array of strings.');
  }

  // Using a Set for the ignore list provides O(1) average time complexity for lookups,
  // which is more efficient than Array.prototype.includes() in a deep recursive function.
  const ignoreSet = new Set(ignore);

  const diffs = recursiveDiff(snapshotObject, currentObject, ignoreSet);

  return {
    areEqual: diffs.length === 0,
    diffs,
  };
}