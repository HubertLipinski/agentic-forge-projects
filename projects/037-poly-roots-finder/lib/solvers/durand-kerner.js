'use strict';

import { Complex } from '../complex.js';

/**
 * @fileoverview Implements the Durand-Kerner (also known as Weierstrass)
 * method for finding all roots (real and complex) of a polynomial simultaneously.
 * This method is particularly effective for polynomials of degree 3 and higher.
 */

/**
 * Default options for the Durand-Kerner solver.
 * @type {{maxIterations: number, tolerance: number}}
 */
const DEFAULT_OPTIONS = {
  /**
   * The maximum number of iterations to perform before stopping.
   * This prevents infinite loops in case of non-convergence.
   */
  maxIterations: 1000,
  /**
   * The desired precision for the roots. The iteration stops when the
   * maximum change in any root between steps is smaller than this value.
   */
  tolerance: 1e-12,
};

/**
 * Generates initial estimates for the roots of a polynomial.
 * The Durand-Kerner method's convergence can be sensitive to initial guesses.
 * A common and effective strategy is to use points distributed evenly on a
 * circle in the complex plane. The radius of this circle is chosen based on
 * the polynomial's coefficients to approximate the magnitude of the roots.
 *
 * This implementation uses the formula: p_k = (0.4 + 0.9i)^k for k = 0, 1, ..., n-1.
 * This choice avoids symmetries that can slow down convergence (e.g., starting
 * with roots of unity).
 *
 * @param {number} degree - The degree of the polynomial.
 * @returns {Complex[]} An array of `degree` complex numbers to be used as initial guesses.
 */
function getInitialGuesses(degree) {
  const guesses = [];
  let currentGuess = new Complex(1.0, 0.0); // Start with p_0 = 1
  const base = new Complex(0.4, 0.9);

  for (let i = 0; i < degree; i++) {
    guesses.push(currentGuess);
    currentGuess = currentGuess.mul(base);
  }
  return guesses;
}

/**
 * Finds all roots of a polynomial using the Durand-Kerner iterative method.
 *
 * The method works by simultaneously refining a set of `n` root approximations.
 * For a monic polynomial P(x) with roots r_1, ..., r_n, we have:
 * P(x) = (x - r_1)(x - r_2)...(x - r_n)
 *
 * For a given approximation p_k to the root r_k, the update rule is:
 * p_k' = p_k - P(p_k) / Π_{j≠k}(p_k - p_j)
 *
 * This function is designed for polynomials of degree 3 or higher. For lower
 * degrees, analytical solvers are more efficient and precise.
 *
 * @param {Polynomial} polynomial - An instance of the Polynomial class.
 * @param {object} [options={}] - Configuration options for the solver.
 * @param {number} [options.maxIterations=1000] - The maximum number of iterations.
 * @param {number} [options.tolerance=1e-12] - The convergence tolerance.
 * @returns {Complex[]} An array of complex numbers representing the roots of the polynomial.
 * @throws {Error} If the method fails to converge within the specified number of iterations.
 */
export function solveDurandKerner(polynomial, options = {}) {
  const { maxIterations, tolerance } = { ...DEFAULT_OPTIONS, ...options };
  const degree = polynomial.degree();

  if (degree < 1) {
    return [];
  }

  // The polynomial must be monic (leading coefficient is 1) for the standard
  // Durand-Kerner formula. We can achieve this by dividing all coefficients
  // by the leading coefficient. This does not change the roots.
  const monicPoly = polynomial.isMonic() ? polynomial : polynomial.toMonic();

  let roots = getInitialGuesses(degree);
  let iteration = 0;

  while (iteration < maxIterations) {
    let maxDelta = 0;
    const nextRoots = [];

    for (let i = 0; i < degree; i++) {
      const p_i = roots[i];

      // Calculate the denominator: Π_{j≠i}(p_i - p_j)
      let denominator = new Complex(1, 0);
      for (let j = 0; j < degree; j++) {
        if (i !== j) {
          denominator = denominator.mul(p_i.sub(roots[j]));
        }
      }

      // Avoid division by zero if two root estimates are identical.
      // This can happen in early iterations. A small perturbation or just
      // keeping the root as is for this iteration is a common strategy.
      if (denominator.abs() < tolerance) {
        nextRoots[i] = p_i;
        continue;
      }

      // Evaluate the polynomial at the current root estimate: P(p_i)
      const numerator = monicPoly.evaluate(p_i);

      // Calculate the update delta: P(p_i) / denominator
      const delta = numerator.div(denominator);

      // Update the root: p_i' = p_i - delta
      const next_p_i = p_i.sub(delta);
      nextRoots[i] = next_p_i;

      // Track the largest change in any root for this iteration
      const currentDelta = delta.abs();
      if (currentDelta > maxDelta) {
        maxDelta = currentDelta;
      }
    }

    roots = nextRoots;

    // Check for convergence
    if (maxDelta < tolerance) {
      return roots;
    }

    iteration++;
  }

  // If the loop completes without converging, the method has failed.
  throw new Error(
    `Durand-Kerner method failed to converge within ${maxIterations} iterations. ` +
    `The solution did not reach the required tolerance of ${tolerance}. ` +
    `Try increasing maxIterations or adjusting the tolerance.`
  );
}