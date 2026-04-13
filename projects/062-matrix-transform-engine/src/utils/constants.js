/**
 * @file src/utils/constants.js
 * @description Exports mathematical and matrix-related constants.
 *
 * This file centralizes constants used across the library to ensure consistency
 * and make maintenance easier. It includes mathematical values like PI and
 * the structure of the identity matrix.
 */

/**
 * A small number used for floating-point comparisons to account for
 * precision errors. Operations that result in a value smaller than this
 * can often be treated as zero.
 *
 * @type {number}
 * @constant
 */
export const EPSILON = 1e-6;

/**
 * The mathematical constant PI.
 *
 * @type {number}
 * @constant
 */
export const PI = Math.PI;

/**
 * Twice the value of PI, equivalent to a full circle (360 degrees) in radians.
 *
 * @type {number}
 * @constant
 */
export const TAU = 2 * Math.PI;

/**
 * The identity matrix for a 2D affine transformation.
 * This matrix represents a transformation that has no effect (no translation,
 * rotation, scaling, or shearing). It is the starting point for new matrices.
 *
 * The matrix is represented as a 6-element array `[a, b, c, d, e, f]`,
 * corresponding to the 3x3 matrix:
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 *
 * For the identity matrix: a=1, b=0, c=0, d=1, e=0, f=0.
 *
 * @type {Readonly<[number, number, number, number, number, number]>}
 * @constant
 */
export const IDENTITY_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);

/**
 * A pre-calculated factor to convert degrees to radians.
 * To convert degrees to radians, multiply by this value: `degrees * DEG_TO_RAD`.
 *
 * @type {number}
 * @constant
 */
export const DEG_TO_RAD = Math.PI / 180;

/**
 * A pre-calculated factor to convert radians to degrees.
 * To convert radians to degrees, multiply by this value: `radians * RAD_TO_DEG`.
 *
 * @type {number}
 * @constant
 */
export const RAD_TO_DEG = 180 / Math.PI;