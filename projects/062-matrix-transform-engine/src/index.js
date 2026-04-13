/**
 * @file src/index.js
 * @description The main public entry point for the Matrix Transform Engine library.
 *
 * This file exports the core `Matrix` class and convenient factory functions for creating
 * matrix instances. It serves as the primary interface for consumers of the library.
 * By centralizing exports here, we provide a clean and consistent API surface.
 */

import { Matrix } from './matrix.js';

/**
 * Creates a new identity matrix.
 * An identity matrix represents a transformation with no translation, rotation, or scaling.
 * It is the default state for a new matrix.
 *
 * This is a factory function that provides a clear, declarative way to create a
 * base matrix. It is equivalent to `new Matrix()`.
 *
 * @returns {Matrix} A new `Matrix` instance representing the identity transformation.
 */
function createMatrix() {
  return new Matrix();
}

/**
 * Creates a `Matrix` instance from a source.
 *
 * This factory function provides a flexible way to create a matrix from various
 * representations, such as another `Matrix` instance (creating a copy), a 6-element
 * array `[a, b, c, d, e, f]`, or a plain object with `a, b, c, d, e, f` properties.
 * If the source is invalid, it throws a `TypeError`.
 *
 * @param {Matrix | [number, number, number, number, number, number] | {a: number, b: number, c: number, d: number, e: number, f: number}} [source]
 *   The source to initialize the matrix from. If undefined, an identity matrix is created.
 * @returns {Matrix} A new `Matrix` instance.
 * @throws {TypeError} If the source is not a valid type for matrix creation.
 */
function from(source) {
  if (source === undefined) {
    return new Matrix();
  }

  // Check if source is a plain object with matrix properties
  if (
    typeof source === 'object' &&
    source !== null &&
    !Array.isArray(source) &&
    !(source instanceof Matrix)
  ) {
    // Attempt to use the static fromObject method for plain objects
    try {
      return Matrix.fromObject(source);
    } catch (e) {
      // Re-throw with a more generic message if fromObject fails
      throw new TypeError(
        'Invalid source for matrix creation. Expected a Matrix instance, a 6-element array, a valid matrix object, or no argument.',
      );
    }
  }

  // For Matrix instances, arrays, or undefined
  return new Matrix(source);
}

// Export the main Matrix class as the default export for convenience.
// e.g., `import Matrix from 'matrix-transform-engine';`
export default Matrix;

// Export the Matrix class and factory functions as named exports.
// This allows for more explicit usage and future expansion of the public API.
// e.g., `import { Matrix, createMatrix, from } from 'matrix-transform-engine';`
export {
  Matrix,
  createMatrix,
  from,
};