/**
 * @file src/snapshot-differ.js
 * @description Compares two schema snapshot objects and generates a human-readable summary of changes.
 *
 * This module uses the `deep-diff` library to perform a structural comparison
 * between two schema snapshots. It then interprets the raw diff output to produce
 * a clear, user-friendly list of additions, deletions, and modifications
 * in the database schema.
 */

import { diff } from 'deep-diff';

/**
 * Formats a single difference item from `deep-diff` into a human-readable string.
 *
 * @param {object} d - A single difference object from the `deep-diff` library.
 * @returns {string} A formatted, human-readable string describing the change.
 */
const formatDifference = (d) => {
  const path = d.path ? d.path.join('.') : 'root';

  switch (d.kind) {
    // 'N' indicates a new property or element
    case 'N':
      if (path.includes('columns')) {
        return `[+] ADDED Column: ${path}.${d.rhs.name}`;
      }
      if (path.includes('constraints')) {
        return `[+] ADDED Constraint: ${path}.${d.rhs.name} (${d.rhs.type})`;
      }
      if (path.includes('indexes')) {
        return `[+] ADDED Index: ${path}.${d.rhs.name}`;
      }
      if (path.includes('tables')) {
        return `[+] ADDED Table: ${d.rhs.name}`;
      }
      return `[+] ADDED: ${path} = ${JSON.stringify(d.rhs)}`;

    // 'D' indicates a deleted property or element
    case 'D':
      if (path.includes('columns')) {
        return `[-] REMOVED Column: ${path}.${d.lhs.name}`;
      }
      if (path.includes('constraints')) {
        return `[-] REMOVED Constraint: ${path}.${d.lhs.name} (${d.lhs.type})`;
      }
      if (path.includes('indexes')) {
        return `[-] REMOVED Index: ${path}.${d.lhs.name}`;
      }
      if (path.includes('tables')) {
        return `[-] REMOVED Table: ${d.lhs.name}`;
      }
      return `[-] REMOVED: ${path}`;

    // 'E' indicates an edited property
    case 'E':
      return `[~] MODIFIED: ${path} from "${d.lhs}" to "${d.rhs}"`;

    // 'A' indicates a change in an array
    case 'A':
      // Recurse to format the nested difference within the array
      return formatDifference({ ...d.item, path: [...d.path, d.index] });

    default:
      // Fallback for any unhandled difference kinds
      return `[?] UNKNOWN CHANGE: ${path} - ${JSON.stringify(d)}`;
  }
};

/**
 * Compares two schema snapshot objects and returns a human-readable summary of the differences.
 *
 * This function is the primary export of the module. It takes two snapshot objects,
 * uses `deep-diff` to find the structural differences, and then formats these
 * differences into an array of descriptive strings.
 *
 * The `prefilter` function for `deep-diff` is used to ignore changes in the `metadata`
 * block (like `capturedAt`), as these are expected to differ and are not part of the
 * actual schema definition.
 *
 * @param {object} schema1 - The first (source/old) schema snapshot object.
 * @param {object} schema2 - The second (target/new) schema snapshot object.
 * @returns {string[]} An array of strings, where each string is a human-readable
 *   description of a single schema difference. An empty array means no differences were found.
 */
export const diffSchemas = (schema1, schema2) => {
  if (!schema1 || typeof schema1 !== 'object' || !schema2 || typeof schema2 !== 'object') {
    throw new Error('Invalid input: Both schema1 and schema2 must be valid objects.');
  }

  /**
   * A pre-filter function for `deep-diff` to ignore certain paths.
   * We ignore the entire `metadata` object because it contains information
   * like timestamps (`capturedAt`) that are expected to change and are not
   * part of the schema structure itself.
   *
   * @param {string[]} path - The path to the property being compared.
   * @param {string} key - The key of the property being compared.
   * @returns {boolean} `true` to exclude the path from diffing, `false` to include it.
   */
  const prefilter = (path, key) => {
    // If the path is empty, we are at the root. Check if the key is 'metadata'.
    if (path.length === 0 && key === 'metadata') {
      return true; // Exclude the entire metadata object from comparison
    }
    return false;
  };

  const differences = diff(schema1, schema2, prefilter);

  if (!differences || differences.length === 0) {
    return []; // No differences found
  }

  // Map each raw difference object to a formatted, readable string.
  return differences.map(formatDifference);
};