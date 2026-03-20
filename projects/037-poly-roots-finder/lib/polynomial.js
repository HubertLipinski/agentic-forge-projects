'use strict';

import { Complex } from './complex.js';

/**
 * @fileoverview Defines the Polynomial class, a representation of a polynomial
 * with methods for evaluation, differentiation, and other algebraic manipulations.
 *
 * A polynomial is defined by its coefficients, ordered from the highest degree
 * term to the constant term. For example, the polynomial 3x^2 - 2x + 1 would be
 * represented by the coefficients [3, -2, 1].
 */

/**
 * Represents a polynomial and provides methods for its manipulation.
 * Instances of this class are immutable. Any method that would change the
 * polynomial (like differentiation) returns a new Polynomial instance.
 */
export class Polynomial {
  /**
   * The coefficients of the polynomial, from the highest degree to the constant term.
   * e.g., for P(x) = a_n*x^n + ... + a_1*x + a_0, coeffs = [a_n, ..., a_1, a_0].
   * @type {ReadonlyArray<number>}
   * @readonly
   */
  coeffs;

  /**
   * Creates an instance of a Polynomial.
   * The constructor normalizes the coefficients by removing leading zeros,
   * ensuring a canonical representation.
   *
   * @param {number[]} coeffs - An array of coefficients, from highest degree to constant term.
   * @throws {Error} if the coefficients array is empty or contains non-finite numbers.
   */
  constructor(coeffs) {
    if (!Array.isArray(coeffs) || coeffs.length === 0) {
      throw new Error('Polynomial coefficients must be a non-empty array.');
    }

    if (coeffs.some(c => !Number.isFinite(c))) {
      throw new Error('Polynomial coefficients must be finite numbers.');
    }

    // Normalize coefficients by removing leading zeros.
    // e.g., [0, 0, 1, 2, 3] becomes [1, 2, 3].
    let firstNonZero = coeffs.findIndex(c => c !== 0);

    // If all coefficients are zero (e.g., [0, 0, 0]), it's the zero polynomial.
    // We represent it as [0].
    if (firstNonZero === -1) {
      this.coeffs = Object.freeze([0]);
    } else {
      this.coeffs = Object.freeze(coeffs.slice(firstNonZero));
    }
  }

  /**
   * Returns the degree of the polynomial.
   * The degree is n for a polynomial of the form a_n*x^n + ... + a_0.
   * A constant polynomial (e.g., P(x) = 5) has degree 0.
   * The zero polynomial (P(x) = 0) is conventionally assigned a degree of -1,
   * but for practical purposes in this library, we return 0.
   *
   * @returns {number} The degree of the polynomial.
   */
  degree() {
    // For coeffs [a, b, c], length is 3, degree is 2. So, degree = length - 1.
    // If coeffs is [0], length is 1, degree is 0.
    return this.coeffs.length - 1;
  }

  /**
   * Evaluates the polynomial at a given point `x`, which can be a real number
   * or a complex number.
   *
   * This method uses Horner's method for efficient and numerically stable evaluation.
   * P(x) = a_n*x^n + ... + a_0 = ((...((a_n*x + a_{n-1})*x + a_{n-2})*x + ...) + a_0
   *
   * @param {number | Complex} x - The point at which to evaluate the polynomial.
   * @returns {Complex} The result of the evaluation as a Complex number.
   */
  evaluate(x) {
    const point = x instanceof Complex ? x : new Complex(x, 0);

    // Horner's method
    let result = new Complex(0, 0);
    for (const coeff of this.coeffs) {
      result = result.mul(point).add(new Complex(coeff, 0));
    }

    return result;
  }

  /**
   * Computes the derivative of the polynomial.
   * If P(x) = a_n*x^n + ... + a_1*x + a_0,
   * then P'(x) = (n*a_n)*x^(n-1) + ... + a_1.
   *
   * @returns {Polynomial} A new Polynomial instance representing the derivative.
   */
  derivative() {
    const degree = this.degree();
    if (degree <= 0) {
      // The derivative of a constant is the zero polynomial.
      return new Polynomial([0]);
    }

    const derivativeCoeffs = this.coeffs
      .slice(0, -1) // The constant term disappears
      .map((coeff, index) => {
        const power = degree - index;
        return coeff * power;
      });

    return new Polynomial(derivativeCoeffs);
  }

  /**
   * Checks if the polynomial is monic (i.e., its leading coefficient is 1).
   * @returns {boolean} True if the polynomial is monic, false otherwise.
   */
  isMonic() {
    return this.coeffs[0] === 1;
  }

  /**
   * Returns a new monic polynomial by dividing all coefficients by the leading
   * coefficient. This operation does not change the roots of the polynomial.
   *
   * @returns {Polynomial} A new monic Polynomial instance. Returns a zero
   * polynomial if the original is a zero polynomial.
   */
  toMonic() {
    if (this.isMonic()) {
      return this;
    }

    const leadingCoeff = this.coeffs[0];
    // For the zero polynomial, leadingCoeff is 0. Avoid division by zero.
    if (leadingCoeff === 0) {
      return new Polynomial([0]);
    }

    const monicCoeffs = this.coeffs.map(c => c / leadingCoeff);
    return new Polynomial(monicCoeffs);
  }

  /**
   * Returns a string representation of the polynomial in a readable format.
   * e.g., "3x^2 - 2x + 1"
   *
   * @returns {string} The formatted string representation of the polynomial.
   */
  toString() {
    const degree = this.degree();

    if (degree === 0) {
      return `${this.coeffs[0]}`;
    }

    let terms = [];
    for (let i = 0; i <= degree; i++) {
      const power = degree - i;
      const coeff = this.coeffs[i];

      if (coeff === 0) {
        continue;
      }

      let term = '';

      // Coefficient part
      const absCoeff = Math.abs(coeff);
      if (i > 0) {
        term += coeff < 0 ? ' - ' : ' + ';
      } else if (coeff < 0) {
        term += '-';
      }

      if (absCoeff !== 1 || power === 0) {
        term += `${absCoeff}`;
      }

      // Variable part
      if (power > 0) {
        term += (absCoeff !== 1 && power > 0) ? '*' : ''; // e.g., 3*x
        term += 'x';
        if (power > 1) {
          term += `^${power}`;
        }
      }

      terms.push(term);
    }

    return terms.join('').trim();
  }
}