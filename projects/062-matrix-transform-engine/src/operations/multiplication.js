/**
 * @file src/operations/multiplication.js
 * @description Provides the matrix multiplication logic for composing 2D affine transformations.
 *
 * This module exports a single function, `multiply`, which takes two matrices
 * and returns their product. This operation is the core of composing
 * transformations, such as applying a rotation after a translation.
 */

/**
 * Multiplies two 2D affine transformation matrices.
 *
 * An affine transformation matrix is represented by a 6-element array `[a, b, c, d, e, f]`,
 * which corresponds to the 3x3 matrix:
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 *
 * When multiplying two matrices, `m1` (the current transformation) and `m2` (the new transformation to apply),
 * the order is significant. The composition `m1.multiply(m2)` is equivalent to applying `m1` then `m2`.
 * The mathematical operation is `M_new = M2 * M1`.
 *
 * Let `m1 = [a1, b1, c1, d1, e1, f1]` and `m2 = [a2, b2, c2, d2, e2, f2]`.
 * The resulting matrix `[a, b, c, d, e, f]` is calculated as follows:
 *
 * a = a2 * a1 + c2 * b1
 * b = b2 * a1 + d2 * b1
 * c = a2 * c1 + c2 * d1
 * d = b2 * c1 + d2 * d1
 * e = a2 * e1 + c2 * f1 + e2
 * f = b2 * e1 + d2 * f1 + f2
 *
 * @param {Readonly<[number, number, number, number, number, number]>} m1 - The first matrix (left-hand side).
 * @param {Readonly<[number, number, number, number, number, number]>} m2 - The second matrix (right-hand side).
 * @returns {[number, number, number, number, number, number]} A new 6-element array representing the resulting matrix.
 * @throws {TypeError} If either input is not a valid 6-element array of numbers.
 */
export function multiply(m1, m2) {
  if (!Array.isArray(m1) || m1.length !== 6 || !Array.isArray(m2) || m2.length !== 6) {
    throw new TypeError('Matrix multiplication requires two 6-element arrays.');
  }

  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;

  // Defensive check for non-numeric values, which can cause NaN results.
  // In a high-performance scenario, this might be omitted if inputs are guaranteed.
  if (
    typeof a1 !== 'number' || typeof b1 !== 'number' || typeof c1 !== 'number' ||
    typeof d1 !== 'number' || typeof e1 !== 'number' || typeof f1 !== 'number' ||
    typeof a2 !== 'number' || typeof b2 !== 'number' || typeof c2 !== 'number' ||
    typeof d2 !== 'number' || typeof e2 !== 'number' || typeof f2 !== 'number'
  ) {
    throw new TypeError('All matrix elements must be numbers.');
  }

  const a = a2 * a1 + c2 * b1;
  const b = b2 * a1 + d2 * b1;
  const c = a2 * c1 + c2 * d1;
  const d = b2 * c1 + d2 * d1;
  const e = a2 * e1 + c2 * f1 + e2;
  const f = b2 * e1 + d2 * f1 + f2;

  return [a, b, c, d, e, f];
}