'use strict';

/**
 * @fileoverview A lightweight, immutable complex number utility.
 *
 * This module provides a `Complex` class to represent complex numbers and perform
 * standard arithmetic operations. Each operation returns a new `Complex` instance,
 * ensuring that the original numbers are never modified (immutability).
 *
 * A complex number `z` is represented in the form `a + bi`, where `a` is the real part
 * and `b` is the imaginary part.
 */

/**
 * Represents a complex number and provides methods for complex arithmetic.
 * Instances of this class are immutable.
 */
export class Complex {
  /**
   * The real part of the complex number.
   * @type {number}
   * @readonly
   */
  re;

  /**
   * The imaginary part of the complex number.
   * @type {number}
   * @readonly
   */
  im;

  /**
   * Creates an instance of a Complex number.
   * @param {number} [re=0] - The real part.
   * @param {number} [im=0] - The imaginary part.
   */
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
    Object.freeze(this); // Make instances immutable
  }

  /**
   * Adds another complex number to this one.
   * (a + bi) + (c + di) = (a + c) + (b + d)i
   * @param {Complex} z - The complex number to add.
   * @returns {Complex} A new Complex instance representing the sum.
   */
  add(z) {
    return new Complex(this.re + z.re, this.im + z.im);
  }

  /**
   * Subtracts another complex number from this one.
   * (a + bi) - (c + di) = (a - c) + (b - d)i
   * @param {Complex} z - The complex number to subtract.
   * @returns {Complex} A new Complex instance representing the difference.
   */
  sub(z) {
    return new Complex(this.re - z.re, this.im - z.im);
  }

  /**
   * Multiplies this complex number by another one.
   * (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
   * @param {Complex} z - The complex number to multiply by.
   * @returns {Complex} A new Complex instance representing the product.
   */
  mul(z) {
    const re = this.re * z.re - this.im * z.im;
    const im = this.re * z.im + this.im * z.re;
    return new Complex(re, im);
  }

  /**
   * Divides this complex number by another one.
   * (a + bi) / (c + di) = [(ac + bd) + (bc - ad)i] / (c^2 + d^2)
   * @param {Complex} z - The complex number to divide by.
   * @returns {Complex} A new Complex instance representing the quotient.
   * @throws {Error} if division by zero (0 + 0i) is attempted.
   */
  div(z) {
    const denominator = z.re * z.re + z.im * z.im;
    if (denominator === 0) {
      throw new Error('Division by zero (0 + 0i) in complex arithmetic.');
    }
    const re = (this.re * z.re + this.im * z.im) / denominator;
    const im = (this.im * z.re - this.re * z.im) / denominator;
    return new Complex(re, im);
  }

  /**
   * Calculates the magnitude (or absolute value) of the complex number.
   * |a + bi| = sqrt(a^2 + b^2)
   * @returns {number} The magnitude of the complex number.
   */
  abs() {
    return Math.sqrt(this.re * this.re + this.im * this.im);
  }

  /**
   * Calculates the complex conjugate.
   * The conjugate of (a + bi) is (a - bi).
   * @returns {Complex} A new Complex instance representing the conjugate.
   */
  conjugate() {
    return new Complex(this.re, -this.im);
  }

  /**
   * Raises this complex number to an integer power.
   * Implements exponentiation by squaring for efficiency.
   * @param {number} n - The integer exponent (can be positive, negative, or zero).
   * @returns {Complex} A new Complex instance representing this^n.
   * @throws {Error} if the exponent is not an integer.
   */
  pow(n) {
    if (!Number.isInteger(n)) {
      throw new Error('Exponent must be an integer for Complex.pow().');
    }

    if (n === 0) {
      return new Complex(1, 0); // z^0 = 1
    }
    if (n === 1) {
      return this; // z^1 = z
    }
    if (n === -1) {
      return new Complex(1, 0).div(this); // z^-1 = 1/z
    }

    let base = this;
    let result = new Complex(1, 0);
    let power = Math.abs(n);

    // Exponentiation by squaring
    while (power > 0) {
      if (power % 2 === 1) {
        result = result.mul(base);
      }
      base = base.mul(base);
      power = Math.floor(power / 2);
    }

    return n > 0 ? result : new Complex(1, 0).div(result);
  }

  /**
   * Checks for equality with another complex number, considering a small tolerance.
   * This is useful for comparing results of floating-point calculations.
   * @param {Complex} z - The complex number to compare against.
   * @param {number} [tolerance=1e-12] - The maximum allowed difference for each part.
   * @returns {boolean} True if the numbers are approximately equal.
   */
  equals(z, tolerance = 1e-12) {
    return (
      Math.abs(this.re - z.re) < tolerance &&
      Math.abs(this.im - z.im) < tolerance
    );
  }

  /**
   * Returns a string representation of the complex number.
   * Formats the output for readability, e.g., "3 + 2i", "5", "-4i".
   * @returns {string} The formatted string.
   */
  toString() {
    if (this.im === 0) {
      return `${this.re}`;
    }
    if (this.re === 0) {
      return this.im === 1 ? 'i' : this.im === -1 ? '-i' : `${this.im}i`;
    }
    const sign = this.im < 0 ? '-' : '+';
    const absIm = Math.abs(this.im);
    const imStr = absIm === 1 ? 'i' : `${absIm}i`;
    return `${this.re} ${sign} ${imStr}`;
  }
}