/**
 * @file src/utils/patch-generator.js
 * @description Utility for creating JSON Patch operations based on changes to the internal state.
 *
 * This module provides a stateful generator that tracks changes to a JavaScript
 * object and produces an array of JSON Patch (RFC 6902) operations. It uses the
 * 'fast-json-patch' library for efficient comparison and patch generation. This
 * is a core component for creating the multiplexer's delta-based output stream.
 */

import { compare } from 'fast-json-patch';
import { structuredClone } from 'node:buffer';

/**
 * Creates and manages a patch generator for a given initial state object.
 *
 * This factory function returns an object with a single method, `generate()`,
 * which, when called with a new state, computes the JSON Patch operations
 * required to transform the previous state into the new one.
 *
 * The generator maintains its own internal copy of the state to ensure
 * accurate comparisons, even if the original object is mutated elsewhere.
 * It uses `structuredClone` for deep, robust cloning of the state.
 *
 * @param {object} initialState - The initial state object to track.
 * @returns {{generate: (newState: object) => import('fast-json-patch').Operation[]}} An object containing the `generate` method.
 * @throws {TypeError} If the initialState is not an object.
 */
export function createPatchGenerator(initialState) {
  if (typeof initialState !== 'object' || initialState === null) {
    throw new TypeError('initialState must be an object.');
  }

  // Use structuredClone for a deep, reliable copy of the initial state.
  // This prevents external mutations from affecting our comparison baseline.
  let previousState = structuredClone(initialState);

  /**
   * Compares the provided `newState` against the internally stored `previousState`,
   * generates a list of JSON Patch operations, and updates the internal state.
   *
   * @param {object} newState - The new state object to compare against.
   * @returns {import('fast-json-patch').Operation[]} An array of JSON Patch operations.
   *   Returns an empty array if there are no differences.
   * @throws {TypeError} If the newState is not an object.
   */
  function generate(newState) {
    if (typeof newState !== 'object' || newState === null) {
      throw new TypeError('newState must be an object.');
    }

    // The `compare` function from fast-json-patch is highly optimized for this task.
    const patches = compare(previousState, newState);

    // After generating the patches, update the internal state to match the new state.
    // This prepares the generator for the next call. Again, use structuredClone
    // to ensure we have a clean, independent copy.
    previousState = structuredClone(newState);

    return patches;
  }

  return { generate };
}