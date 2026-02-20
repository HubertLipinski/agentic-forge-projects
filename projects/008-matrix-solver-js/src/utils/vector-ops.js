/**
 * @file src/utils/vector-ops.js
 * @description A collection of high-performance vector operations optimized for large arrays.
 *
 * This module provides fundamental vector operations required by iterative linear solvers.
 * All functions are designed to work with standard JavaScript Arrays or TypedArrays
 * (like Float64Array) for maximum performance and memory efficiency.
 *
 * The functions include defensive checks to ensure vector dimensions match, preventing
 * common errors in linear algebra computations.
 */

/**
 * Validates that two vectors have the same length. Throws an error if they do not.
 * This is a critical check for operations like dot product and vector addition.
 * @param {number[] | Float64Array} v1 - The first vector.
 * @param {number[] | Float64Array} v2 - The second vector.
 * @param {string} operationName - The name of the operation being performed, for a clear error message.
 * @throws {Error} If the vectors have different lengths.
 */
const assertSameLength = (v1, v2, operationName) => {
  if (v1.length !== v2.length) {
    throw new Error(
      `Cannot perform ${operationName}: vectors have different lengths (${v1.length} vs ${v2.length}).`
    );
  }
};

/**
 * Calculates the dot (inner) product of two vectors.
 * dot(v1, v2) = v1[0]*v2[0] + v1[1]*v2[1] + ... + v1[n-1]*v2[n-1]
 *
 * @param {number[] | Float64Array} v1 - The first vector.
 * @param {number[] | Float64Array} v2 - The second vector.
 * @returns {number} The scalar dot product.
 * @throws {Error} If the vectors have different lengths.
 */
export function dot(v1, v2) {
  assertSameLength(v1, v2, 'dot product');
  const n = v1.length;
  let result = 0.0;
  for (let i = 0; i < n; i++) {
    result += v1[i] * v2[i];
  }
  return result;
}

/**
 * Calculates the Euclidean (L2) norm of a vector.
 * norm(v) = sqrt(v[0]^2 + v[1]^2 + ... + v[n-1]^2)
 * This is equivalent to sqrt(dot(v, v)).
 *
 * @param {number[] | Float64Array} v - The vector.
 * @returns {number} The L2 norm of the vector.
 */
export function norm(v) {
  const n = v.length;
  let sumOfSquares = 0.0;
  for (let i = 0; i < n; i++) {
    const val = v[i];
    sumOfSquares += val * val;
  }
  return Math.sqrt(sumOfSquares);
}

/**
 * Adds two vectors element-wise.
 * add(v1, v2) = [v1[0]+v2[0], v1[1]+v2[1], ..., v1[n-1]+v2[n-1]]
 *
 * @param {number[] | Float64Array} v1 - The first vector.
 * @param {number[] | Float64Array} v2 - The second vector.
 * @returns {Float64Array} A new vector containing the element-wise sum.
 * @throws {Error} If the vectors have different lengths.
 */
export function add(v1, v2) {
  assertSameLength(v1, v2, 'vector addition');
  const n = v1.length;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = v1[i] + v2[i];
  }
  return result;
}

/**
 * Subtracts the second vector from the first, element-wise.
 * sub(v1, v2) = [v1[0]-v2[0], v1[1]-v2[1], ..., v1[n-1]-v2[n-1]]
 *
 * @param {number[] | Float64Array} v1 - The vector to subtract from (minuend).
 * @param {number[] | Float64Array} v2 - The vector to subtract (subtrahend).
 * @returns {Float64Array} A new vector containing the element-wise difference.
 * @throws {Error} If the vectors have different lengths.
 */
export function sub(v1, v2) {
  assertSameLength(v1, v2, 'vector subtraction');
  const n = v1.length;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = v1[i] - v2[i];
  }
  return result;
}

/**
 * Multiplies a vector by a scalar value.
 * scale(v, s) = [v[0]*s, v[1]*s, ..., v[n-1]*s]
 *
 * @param {number[] | Float64Array} v - The vector.
 * @param {number} scalar - The scalar value to multiply by.
 * @returns {Float64Array} A new vector containing the scaled elements.
 */
export function scale(v, scalar) {
  const n = v.length;
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = v[i] * scalar;
  }
  return result;
}

/**
 * Creates a deep copy of a vector.
 * This is useful to avoid side effects when a vector needs to be modified
 * while preserving the original.
 *
 * @param {number[] | Float64Array} v - The vector to copy.
 * @returns {Float64Array} A new vector with the same elements.
 */
export function clone(v) {
  // Float64Array.from() is an efficient way to clone, handling both Array and TypedArray inputs.
  return Float64Array.from(v);
}

/**
 * Creates a new vector of a given size, filled with a specific value.
 *
 * @param {number} size - The desired length of the vector.
 * @param {number} [fillValue=0.0] - The value to fill the vector with. Defaults to 0.
 * @returns {Float64Array} A new vector filled with the specified value.
 */
export function fill(size, fillValue = 0.0) {
    if (size < 0 || !Number.isInteger(size)) {
        throw new Error(`Invalid vector size: ${size}. Must be a non-negative integer.`);
    }
    const result = new Float64Array(size);
    if (fillValue !== 0.0) {
        result.fill(fillValue);
    }
    return result;
}