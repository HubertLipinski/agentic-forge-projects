'use strict';

/**
 * @fileoverview This is the main entry point for the polynomial-roots-finder library.
 * It exposes a single factory function, `findRoots`, which serves as the public API.
 * This function intelligently delegates the root-finding task to the most appropriate
 * solver based on the polynomial's degree.
 */

import { Polynomial } from './polynomial.js';
import { solveLinear, solveQuadratic } from './solvers/analytical.js';
import { solveDurandKerner } from './solvers/durand-kerner.js';

/**
 * Finds all real and complex roots of a polynomial given its coefficients.
 *
 * This function acts as a dispatcher, selecting the most efficient and stable
 * solver based on the degree of the polynomial:
 * - **Degree 0 (Constant):** A non-zero constant has no roots. The zero polynomial
 *   has infinite roots, but we return an empty array for consistency.
 * - **Degree 1 (Linear):** Solved using the direct formula `x = -b/a`.
 * - **Degree 2 (Quadratic):** Solved using the quadratic formula, correctly
 *   handling both real and complex roots.
 * - **Degree 3 and higher:** Solved using the Durand-Kerner method, a robust
 *   iterative numerical algorithm for finding all roots simultaneously.
 *
 * The coefficients should be provided as an array of numbers, ordered from the
 * highest degree term to the constant term. For example, for the polynomial
 * `P(x) = 2x^2 - 3x + 1`, the coefficients would be `[2, -3, 1]`.
 *
 * @param {number[]} coeffs - An array of coefficients for the polynomial,
 *   ordered from the highest degree term to the constant term.
 * @param {object} [options={}] - Optional configuration for the numerical solver
 *   (currently applies to Durand-Kerner for degree >= 3).
 * @param {number} [options.maxIterations=1000] - The maximum number of iterations
 *   for the numerical solver to prevent infinite loops.
 * @param {number} [options.tolerance=1e-12] - The desired precision for the roots.
 *   The iteration stops when the change in any root is smaller than this value.
 * @returns {Complex[]} An array of `Complex` objects representing the roots of the
 *   polynomial. The number of roots will equal the degree of the polynomial,
 *   except for constant polynomials which have no roots.
 * @throws {Error} if the coefficients array is invalid (e.g., empty, contains non-finite numbers).
 * @throws {Error} if the numerical solver (Durand-Kerner) fails to converge within
 *   the specified number of iterations.
 *
 * @example
 * // Find roots of x^2 - 4 = 0 (coeffs: [1, 0, -4])
 * const roots = findRoots([1, 0, -4]);
 * // roots will be an array of Complex objects: [Complex(2, 0), Complex(-2, 0)]
 *
 * @example
 * // Find roots of x^3 - 1 = 0 (coeffs: [1, 0, 0, -1])
 * const rootsCubic = findRoots([1, 0, 0, -1]);
 * // rootsCubic will contain 1, and the two complex cube roots of unity.
 */
export function findRoots(coeffs, options = {}) {
  // Input validation is handled by the Polynomial constructor, which will throw
  // an error for invalid coefficient arrays (empty, non-finite numbers, etc.).
  const polynomial = new Polynomial(coeffs);
  const degree = polynomial.degree();

  // Select the appropriate solver based on the polynomial's degree.
  switch (degree) {
    case 0:
      // A constant polynomial (e.g., P(x) = 5) has no roots, unless it's the
      // zero polynomial (P(x) = 0), which has infinitely many. In either case,
      // returning an empty array is the most practical result.
      return [];

    case 1:
      // Use the fast and precise analytical solver for linear equations.
      return solveLinear(polynomial.coeffs);

    case 2:
      // Use the fast and precise analytical solver for quadratic equations.
      return solveQuadratic(polynomial.coeffs);

    default:
      // For degree 3 and higher, use the robust Durand-Kerner numerical method.
      // Pass along any user-provided options for tolerance and max iterations.
      return solveDurandKerner(polynomial, options);
  }
}