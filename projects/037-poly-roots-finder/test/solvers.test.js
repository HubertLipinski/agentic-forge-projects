'use strict';

import { expect } from 'chai';
import { findRoots } from '../lib/index.js';
import { Complex } from '../lib/complex.js';

/**
 * A small tolerance for comparing floating-point numbers in tests.
 * This is crucial for numerical methods where exact results are not guaranteed.
 */
const EPSILON = 1e-9;

/**
 * A helper function to sort an array of Complex numbers.
 * Sorting is done first by the real part, then by the imaginary part.
 * This allows for consistent comparison of root sets, as the order
 * returned by solvers is not guaranteed.
 *
 * @param {Complex[]} roots - An array of complex numbers.
 * @returns {Complex[]} The sorted array of complex numbers.
 */
function sortRoots(roots) {
  return [...roots].sort((a, b) => {
    if (Math.abs(a.re - b.re) > EPSILON) {
      return a.re - b.re;
    }
    return a.im - b.im;
  });
}

/**
 * A helper function to assert that two arrays of complex roots are equal
 * within a given tolerance. It sorts both arrays before comparing them
 * element by element.
 *
 * @param {Complex[]} actualRoots - The roots calculated by the solver.
 * @param {Complex[]} expectedRoots - The known correct roots.
 * @param {string} message - A message to display on failure.
 */
function assertRootsEqual(actualRoots, expectedRoots, message) {
  const sortedActual = sortRoots(actualRoots);
  const sortedExpected = sortRoots(expectedRoots);

  expect(sortedActual.length).to.equal(sortedExpected.length, `${message}: Incorrect number of roots`);

  for (let i = 0; i < sortedActual.length; i++) {
    const actual = sortedActual[i];
    const expected = sortedExpected[i];
    const areEqual = actual.equals(expected, EPSILON);

    // Provide a detailed error message if the assertion fails.
    expect(areEqual).to.be.true(
      `${message}: Root mismatch at index ${i}. Expected ${expected.toString()} but got ${actual.toString()}`
    );
  }
}

describe('Root-Finding Solvers (Integration Tests)', () => {

  describe('findRoots Dispatcher', () => {
    it('should return an empty array for a constant non-zero polynomial', () => {
      // P(x) = 5
      const roots = findRoots([5]);
      expect(roots).to.be.an('array').that.is.empty;
    });

    it('should return an empty array for the zero polynomial', () => {
      // P(x) = 0
      const roots = findRoots([0, 0, 0]);
      expect(roots).to.be.an('array').that.is.empty;
    });

    it('should throw an error for invalid coefficients', () => {
      expect(() => findRoots([])).to.throw('Polynomial coefficients must be a non-empty array.');
      expect(() => findRoots([1, NaN])).to.throw('Polynomial coefficients must be finite numbers.');
    });
  });

  describe('Linear Solver (Degree 1)', () => {
    it('should solve a simple linear equation: 2x - 4 = 0', () => {
      const coeffs = [2, -4]; // Root is 2
      const expected = [new Complex(2, 0)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test 2x - 4 = 0');
    });

    it('should solve a linear equation with negative root: 3x + 9 = 0', () => {
      const coeffs = [3, 9]; // Root is -3
      const expected = [new Complex(-3, 0)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test 3x + 9 = 0');
    });

    it('should solve a linear equation with fractional root: 5x - 1 = 0', () => {
      const coeffs = [5, -1]; // Root is 1/5 = 0.2
      const expected = [new Complex(0.2, 0)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test 5x - 1 = 0');
    });
  });

  describe('Quadratic Solver (Degree 2)', () => {
    it('should solve for two distinct real roots: x^2 - 3x + 2 = 0', () => {
      const coeffs = [1, -3, 2]; // Roots are 1, 2
      const expected = [new Complex(1, 0), new Complex(2, 0)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test x^2 - 3x + 2 = 0');
    });

    it('should solve for one repeated real root: x^2 - 6x + 9 = 0', () => {
      const coeffs = [1, -6, 9]; // Roots are 3, 3
      const expected = [new Complex(3, 0), new Complex(3, 0)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test x^2 - 6x + 9 = 0');
    });

    it('should solve for a complex conjugate pair: x^2 + 4 = 0', () => {
      const coeffs = [1, 0, 4]; // Roots are 2i, -2i
      const expected = [new Complex(0, 2), new Complex(0, -2)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test x^2 + 4 = 0');
    });

    it('should solve for a complex conjugate pair: x^2 - 2x + 5 = 0', () => {
      // Roots are (2 ± sqrt(4 - 20)) / 2 = (2 ± sqrt(-16)) / 2 = (2 ± 4i) / 2 = 1 ± 2i
      const coeffs = [1, -2, 5];
      const expected = [new Complex(1, 2), new Complex(1, -2)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test x^2 - 2x + 5 = 0');
    });
  });

  describe('Durand-Kerner Solver (Degree >= 3)', () => {
    it('should solve a simple cubic equation: x^3 - 1 = 0', () => {
      // Roots are the cube roots of unity: 1, -0.5 + 0.866i, -0.5 - 0.866i
      const coeffs = [1, 0, 0, -1];
      const expected = [
        new Complex(1, 0),
        new Complex(-0.5, Math.sqrt(3) / 2),
        new Complex(-0.5, -Math.sqrt(3) / 2),
      ];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test x^3 - 1 = 0');
    });

    it('should solve a cubic with three distinct real roots: (x-1)(x-2)(x-3) = x^3 - 6x^2 + 11x - 6', () => {
      const coeffs = [1, -6, 11, -6]; // Roots are 1, 2, 3
      const expected = [new Complex(1, 0), new Complex(2, 0), new Complex(3, 0)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test x^3 - 6x^2 + 11x - 6 = 0');
    });

    it('should solve a cubic with a repeated real root: (x-2)^2 * (x+1) = x^3 - 3x^2 + 4', () => {
      const coeffs = [1, -3, 0, 4]; // Roots are 2, 2, -1
      const expected = [new Complex(-1, 0), new Complex(2, 0), new Complex(2, 0)];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test x^3 - 3x^2 + 4 = 0');
    });

    it('should solve a quartic with complex roots: x^4 - 1 = 0', () => {
      // Roots are 1, -1, i, -i
      const coeffs = [1, 0, 0, 0, -1];
      const expected = [
        new Complex(1, 0),
        new Complex(-1, 0),
        new Complex(0, 1),
        new Complex(0, -1),
      ];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test x^4 - 1 = 0');
    });

    it('should solve a quintic (Wilkinson\'s polynomial variant): (x-1)(x-2)(x-3)(x-4)(x-5)', () => {
      // P(x) = x^5 - 15x^4 + 85x^3 - 225x^2 + 274x - 120
      const coeffs = [1, -15, 85, -225, 274, -120];
      const expected = [
        new Complex(1, 0),
        new Complex(2, 0),
        new Complex(3, 0),
        new Complex(4, 0),
        new Complex(5, 0),
      ];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test (x-1)...(x-5)');
    });

    it('should solve a polynomial with non-unit leading coefficient', () => {
      // 2x^3 - 2 = 0 is equivalent to x^3 - 1 = 0
      const coeffs = [2, 0, 0, -2];
      const expected = [
        new Complex(1, 0),
        new Complex(-0.5, Math.sqrt(3) / 2),
        new Complex(-0.5, -Math.sqrt(3) / 2),
      ];
      const actual = findRoots(coeffs);
      assertRootsEqual(actual, expected, 'Test 2x^3 - 2 = 0');
    });

    it('should throw an error if it fails to converge', () => {
      // A contrived case with very low maxIterations to force failure.
      // P(x) = x^3 - 1
      const coeffs = [1, 0, 0, -1];
      const options = { maxIterations: 1, tolerance: 1e-15 };
      expect(() => findRoots(coeffs, options)).to.throw(
        /Durand-Kerner method failed to converge/
      );
    });
  });
});