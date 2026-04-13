/**
 * @file src/operations/point-transform.js
 * @description Provides a function to apply a matrix transformation to a 2D point.
 *
 * This module exports `transformPoint`, which calculates the new coordinates of a point
 * after being transformed by a given 2D affine matrix. This is a fundamental operation
 * in computer graphics for mapping points from one coordinate space to another.
 */

/**
 * Transforms a 2D point using a 2D affine transformation matrix.
 *
 * The transformation is applied by multiplying the matrix with the point's
 * coordinate vector. A 2D point `(x, y)` is treated as a 3D vector `[x, y, 1]`
 * to be compatible with the 3x3 affine matrix representation.
 *
 * The matrix `[a, b, c, d, e, f]` corresponds to the 3x3 matrix:
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 *
 * The transformation is calculated as:
 * | a c e |   | x |   | a*x + c*y + e |
 * | b d f | * | y | = | b*x + d*y + f |
 * | 0 0 1 |   | 1 |   |       1       |
 *
 * So, the new point `(x', y')` is:
 * x' = a*x + c*y + e
 * y' = b*x + d*y + f
 *
 * @param {Readonly<[number, number, number, number, number, number]>} m - The 6-element transformation matrix.
 * @param {{x: number, y: number}} point - The point to transform, with `x` and `y` properties.
 * @returns {{x: number, y: number}} A new point object with the transformed coordinates.
 * @throws {TypeError} If the matrix is not a valid 6-element array, the point is not a valid object,
 * or if any of the required values are not numbers.
 */
export function transformPoint(m, point) {
  if (!Array.isArray(m) || m.length !== 6) {
    throw new TypeError('Matrix must be a 6-element array.');
  }

  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
    throw new TypeError('Point must be an object with numeric `x` and `y` properties.');
  }

  const [a, b, c, d, e, f] = m;
  const { x, y } = point;

  // Defensive check for non-numeric matrix elements. This prevents NaN results
  // which can be hard to debug.
  if (
    typeof a !== 'number' || typeof b !== 'number' || typeof c !== 'number' ||
    typeof d !== 'number' || typeof e !== 'number' || typeof f !== 'number'
  ) {
    throw new TypeError('All matrix elements must be numbers.');
  }


  const newX = a * x + c * y + e;
  const newY = b * x + d * y + f;

  return { x: newX, y: newY };
}