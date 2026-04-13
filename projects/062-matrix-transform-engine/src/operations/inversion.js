/**
 * @file src/operations/inversion.js
 * @description Implements matrix inversion logic, including determinant calculation and handling for non-invertible matrices.
 *
 * This module provides functions to calculate the determinant of a matrix and to compute its inverse.
 * The inverse of a transformation matrix can be used to "undo" the original transformation.
 * For example, if a matrix transforms world coordinates to screen coordinates, its inverse
 * transforms screen coordinates back to world coordinates.
 */

import { isZero } from '../utils/math-helpers.js';

/**
 * Calculates the determinant of a 2D affine transformation matrix.
 *
 * The matrix is represented as `[a, b, c, d, e, f]`. The determinant is calculated
 * from the linear transformation part of the matrix (the 2x2 sub-matrix `[[a, c], [b, d]]`).
 *
 * Determinant = a * d - c * b
 *
 * The determinant is a crucial value. If it is zero, the matrix is "singular" or
 * "non-invertible," meaning the transformation collapses space onto a line or a point,
 * and information is lost. Such a transformation cannot be reversed.
 *
 * @param {Readonly<[number, number, number, number, number, number]>} m - The matrix.
 * @returns {number} The determinant of the matrix.
 * @throws {TypeError} If the input is not a valid 6-element array of numbers.
 */
export function determinant(m) {
  if (!Array.isArray(m) || m.length !== 6) {
    throw new TypeError('Determinant calculation requires a 6-element array.');
  }

  const [a, b, c, d] = m;

  if (
    typeof a !== 'number' || typeof b !== 'number' ||
    typeof c !== 'number' || typeof d !== 'number'
  ) {
    throw new TypeError('Matrix elements [a, b, c, d] must be numbers to calculate the determinant.');
  }

  return a * d - b * c;
}

/**
 * Inverts a 2D affine transformation matrix.
 *
 * The inverse of a matrix `M` is a matrix `M⁻¹` such that `M * M⁻¹ = I` (the identity matrix).
 * This function computes the inverse of the given matrix.
 *
 * If the matrix's determinant is zero, it is non-invertible. In this case, the function
 * will throw an error, as a valid inverse cannot be computed. This prevents division-by-zero
 * errors and signals that the operation is mathematically impossible.
 *
 * The formula for the inverse of a matrix `[a, b, c, d, e, f]` is derived from the
 * inverse of the corresponding 3x3 matrix:
 *
 * | a c e |⁻¹   1   |  d  -c  cf-de |
 * | b d f |   = --- | -b   a  be-af |
 * | 0 0 1 |     det |  0   0   ad-bc |
 *
 * where `det = ad - bc`.
 *
 * @param {Readonly<[number, number, number, number, number, number]>} m - The matrix to invert.
 * @returns {[number, number, number, number, number, number]} A new 6-element array representing the inverted matrix.
 * @throws {Error} If the matrix is singular (determinant is zero) and cannot be inverted.
 * @throws {TypeError} If the input is not a valid 6-element array of numbers.
 */
export function invert(m) {
  if (!Array.isArray(m) || m.length !== 6) {
    throw new TypeError('Matrix inversion requires a 6-element array.');
  }

  const [a, b, c, d, e, f] = m;

  if (
    typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number' ||
    typeof d !== 'number' || typeof e !== 'number' || typeof f !== 'number'
  ) {
    throw new TypeError('All matrix elements must be numbers for inversion.');
  }

  const det = a * d - b * c;

  // Use isZero for a robust floating-point comparison.
  // A matrix is singular if its determinant is zero (or very close to it).
  if (isZero(det)) {
    throw new Error('Matrix is not invertible (determinant is zero).');
  }

  // Calculate the inverse determinant (1/det) once to avoid repeated divisions.
  const invDet = 1 / det;

  const a_inv = d * invDet;
  const b_inv = -b * invDet;
  const c_inv = -c * invDet;
  const d_inv = a * invDet;
  const e_inv = (c * f - d * e) * invDet;
  const f_inv = (b * e - a * f) * invDet;

  return [a_inv, b_inv, c_inv, d_inv, e_inv, f_inv];
}