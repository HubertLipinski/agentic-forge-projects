'use strict';

import { Complex } from '../complex.js';

/**
 * @fileoverview Provides analytical (direct formula) solvers for linear and
 * quadratic polynomials. These methods are preferred for low-degree polynomials
 * due to their speed and exactness, avoiding the overhead and potential
 * precision issues of iterative numerical methods.
 */

/**
 * Solves a linear polynomial of the form ax + b = 0.
 *
 * A linear equation has exactly one root, given by the formula x = -b / a.
 * This function handles the trivial case where the polynomial is constant
 * (a = 0) and the case of a standard linear equation.
 *
 * @param {number[]} coeffs - The coefficients [a, b] of the polynomial.
 *   `a` is the coefficient of x, `b` is the constant term.
 * @returns {Complex[]} An array containing the single complex root of the polynomial.
 * @throws {Error} if the leading coefficient `a` is zero and the constant `b` is non-zero,
 *   indicating a contradiction (e.g., 5 = 0), or if `a` and `b` are both zero,
 *   which is an identity true for all x.
 */
export function solveLinear(coeffs) {
  const [a, b] = coeffs;

  // This check is for robustness, though the main solver logic in index.js
  // should prevent this by normalizing coefficients.
  if (Math.abs(a) === 0) {
    if (Math.abs(b) !== 0) {
      // Equation is of the form `b = 0` where b is non-zero (e.g., 5 = 0).
      // This is a contradiction and has no solutions.
      // In the context of root-finding, this is an edge case.
      // A polynomial of degree 0 (a constant) has no roots unless it's the zero polynomial.
      return [];
    } else {
      // Equation is 0 = 0. This is an identity, true for all x.
      // The polynomial is the zero polynomial, which has infinitely many roots.
      // We return an empty array as there's no finite set of specific roots.
      return [];
    }
  }

  // Standard case: ax + b = 0  =>  x = -b / a
  const root = new Complex(-b / a, 0);
  return [root];
}

/**
 * Solves a quadratic polynomial of the form ax^2 + bx + c = 0 using the quadratic formula.
 *
 * The roots are given by x = [-b ± sqrt(b^2 - 4ac)] / 2a.
 * This implementation correctly handles real and complex roots by evaluating the
 * discriminant (Δ = b^2 - 4ac).
 *
 * - If Δ ≥ 0, the roots are real.
 * - If Δ < 0, the roots are a complex conjugate pair.
 *
 * @param {number[]} coeffs - The coefficients [a, b, c] of the polynomial.
 *   `a` is x^2 coeff, `b` is x coeff, `c` is the constant.
 * @returns {Complex[]} An array containing the two complex roots of the polynomial.
 */
export function solveQuadratic(coeffs) {
  const [a, b, c] = coeffs;

  // The main solver should have already handled the case where 'a' is zero
  // by dispatching to solveLinear. This check is a safeguard.
  if (Math.abs(a) === 0) {
    return solveLinear([b, c]);
  }

  // Calculate the discriminant: Δ = b^2 - 4ac
  const discriminant = b * b - 4 * a * c;
  const twoA = 2 * a;

  let root1, root2;

  if (discriminant >= 0) {
    // Two real roots (or one repeated real root if discriminant is 0)
    const sqrtDiscriminant = Math.sqrt(discriminant);
    const r1 = (-b + sqrtDiscriminant) / twoA;
    const r2 = (-b - sqrtDiscriminant) / twoA;
    root1 = new Complex(r1, 0);
    root2 = new Complex(r2, 0);
  } else {
    // Two complex conjugate roots
    const sqrtAbsDiscriminant = Math.sqrt(-discriminant);
    const realPart = -b / twoA;
    const imagPart = sqrtAbsDiscriminant / twoA;
    root1 = new Complex(realPart, imagPart);
    root2 = new Complex(realPart, -imagPart);
  }

  return [root1, root2];
}