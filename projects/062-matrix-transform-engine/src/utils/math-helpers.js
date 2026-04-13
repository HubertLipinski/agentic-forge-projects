/**
 * @file src/utils/math-helpers.js
 * @description Provides pure mathematical helper functions for trigonometric calculations
 * and floating-point number comparisons.
 *
 * These helpers are designed to handle common numerical tasks required for matrix
 * transformations, such as dealing with floating-point inaccuracies and providing
 * cached trigonometric functions for performance.
 */

import { EPSILON } from './constants.js';

/**
 * Compares two floating-point numbers for approximate equality.
 *
 * Due to the nature of floating-point arithmetic, direct comparison using `===`
 * can lead to unexpected results. This function checks if the absolute difference
 * between two numbers is within a small tolerance (EPSILON).
 *
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 * @returns {boolean} `true` if the numbers are approximately equal, `false` otherwise.
 */
export function areClose(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') {
    // This is a defensive check; in a high-performance context,
    // we assume valid inputs, but for library robustness, it's good practice.
    return false;
  }
  return Math.abs(a - b) < EPSILON;
}

/**
 * Checks if a number is approximately zero.
 *
 * This is a specialized version of `areClose` for comparing against zero, which is
 * a common operation in matrix calculations (e.g., checking for a zero determinant).
 *
 * @param {number} n - The number to check.
 * @returns {boolean} `true` if the number is close to zero, `false` otherwise.
 */
export function isZero(n) {
  if (typeof n !== 'number') {
    return false;
  }
  return Math.abs(n) < EPSILON;
}

/**
 * Calculates the sine of an angle in radians.
 *
 * This function handles specific angles where `Math.sin` might produce small
 * floating-point errors (e.g., `Math.sin(Math.PI)` is not exactly 0). It rounds
 * the result to 0 for multiples of PI.
 *
 * @param {number} radians - The angle in radians.
 * @returns {number} The sine of the angle.
 */
export function sin(radians) {
  if (typeof radians !== 'number') {
    return NaN;
  }
  // Check if the angle is a multiple of PI, where sin should be 0.
  // `radians / Math.PI` should be an integer.
  if (areClose(radians % Math.PI, 0) || areClose(radians % Math.PI, Math.PI)) {
    return 0;
  }
  return Math.sin(radians);
}

/**
 * Calculates the cosine of an angle in radians.
 *
 * This function handles specific angles where `Math.cos` might produce small
 * floating-point errors (e.g., `Math.cos(Math.PI / 2)` is not exactly 0). It rounds
 * the result to 0 for odd multiples of PI/2.
 *
 * @param {number} radians - The angle in radians.
 * @returns {number} The cosine of the angle.
 */
export function cos(radians) {
  if (typeof radians !== 'number') {
    return NaN;
  }
  // Check if the angle is an odd multiple of PI/2, where cos should be 0.
  // `(radians / (Math.PI / 2)) % 2` should be close to 1.
  if (areClose(Math.abs((radians / (Math.PI / 2)) % 2), 1)) {
    return 0;
  }
  return Math.cos(radians);
}

/**
 * Clamps a number within a specified range [min, max].
 *
 * @param {number} value - The number to clamp.
 * @param {number} min - The lower bound of the range.
 * @param {number} max - The upper bound of the range.
 * @returns {number} The clamped number.
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}