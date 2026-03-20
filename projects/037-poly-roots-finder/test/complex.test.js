'use strict';

import { expect } from 'chai';
import { Complex } from '../lib/complex.js';

/**
 * A small tolerance for comparing floating-point numbers in tests.
 */
const EPSILON = 1e-12;

describe('Complex Number Arithmetic (lib/complex.js)', () => {

  describe('Constructor', () => {
    it('should create a complex number with specified real and imaginary parts', () => {
      const z = new Complex(3, -4);
      expect(z.re).to.equal(3);
      expect(z.im).to.equal(-4);
    });

    it('should default the imaginary part to 0 if not provided', () => {
      const z = new Complex(5);
      expect(z.re).to.equal(5);
      expect(z.im).to.equal(0);
    });

    it('should default both real and imaginary parts to 0 if no arguments are provided', () => {
      const z = new Complex();
      expect(z.re).to.equal(0);
      expect(z.im).to.equal(0);
    });

    it('should create an immutable object', () => {
      const z = new Complex(1, 1);
      expect(() => { z.re = 5; }).to.throw(TypeError);
      expect(() => { z.im = 5; }).to.throw(TypeError);
    });
  });

  describe('Addition', () => {
    it('should correctly add two complex numbers', () => {
      const z1 = new Complex(3, 2);
      const z2 = new Complex(1, 7);
      const result = z1.add(z2);
      expect(result.re).to.equal(4);
      expect(result.im).to.equal(9);
    });

    it('should correctly add a complex number and a real number', () => {
      const z1 = new Complex(3, 2);
      const z2 = new Complex(5, 0); // Represents a real number
      const result = z1.add(z2);
      expect(result.re).to.equal(8);
      expect(result.im).to.equal(2);
    });

    it('should return a new Complex instance', () => {
      const z1 = new Complex(1, 1);
      const z2 = new Complex(2, 2);
      const result = z1.add(z2);
      expect(result).to.be.an.instanceOf(Complex);
      expect(result).to.not.equal(z1);
    });
  });

  describe('Subtraction', () => {
    it('should correctly subtract two complex numbers', () => {
      const z1 = new Complex(5, 5);
      const z2 = new Complex(1, 2);
      const result = z1.sub(z2);
      expect(result.re).to.equal(4);
      expect(result.im).to.equal(3);
    });

    it('should correctly subtract a real number from a complex number', () => {
      const z1 = new Complex(5, 5);
      const z2 = new Complex(2, 0);
      const result = z1.sub(z2);
      expect(result.re).to.equal(3);
      expect(result.im).to.equal(5);
    });

    it('should return a new Complex instance', () => {
      const z1 = new Complex(3, 3);
      const z2 = new Complex(1, 1);
      const result = z1.sub(z2);
      expect(result).to.be.an.instanceOf(Complex);
      expect(result).to.not.equal(z1);
    });
  });

  describe('Multiplication', () => {
    it('should correctly multiply two complex numbers', () => {
      const z1 = new Complex(3, 2);
      const z2 = new Complex(1, 7);
      const result = z1.mul(z2); // (3*1 - 2*7) + (3*7 + 2*1)i = -11 + 23i
      expect(result.re).to.equal(-11);
      expect(result.im).to.equal(23);
    });

    it('should correctly multiply by a real number (scalar multiplication)', () => {
      const z1 = new Complex(3, 2);
      const z2 = new Complex(4, 0);
      const result = z1.mul(z2);
      expect(result.re).to.equal(12);
      expect(result.im).to.equal(8);
    });

    it('should correctly multiply by i (0 + 1i)', () => {
      const z1 = new Complex(3, 2);
      const i = new Complex(0, 1);
      const result = z1.mul(i); // (3 + 2i) * i = 3i + 2i^2 = -2 + 3i
      expect(result.re).to.equal(-2);
      expect(result.im).to.equal(3);
    });

    it('should return a new Complex instance', () => {
      const z1 = new Complex(1, 1);
      const z2 = new Complex(2, 2);
      const result = z1.mul(z2);
      expect(result).to.be.an.instanceOf(Complex);
      expect(result).to.not.equal(z1);
    });
  });

  describe('Division', () => {
    it('should correctly divide two complex numbers', () => {
      const z1 = new Complex(-2, 1);
      const z2 = new Complex(1, 2);
      const result = z1.div(z2); // (-2+i)/(1+2i) = ((-2*1+1*2) + (1*1 - (-2)*2)i) / (1^2+2^2) = (0 + 5i)/5 = i
      expect(result.re).to.be.closeTo(0, EPSILON);
      expect(result.im).to.be.closeTo(1, EPSILON);
    });

    it('should correctly divide by a real number', () => {
      const z1 = new Complex(10, -20);
      const z2 = new Complex(5, 0);
      const result = z1.div(z2);
      expect(result.re).to.equal(2);
      expect(result.im).to.equal(-4);
    });

    it('should throw an error when dividing by zero (0 + 0i)', () => {
      const z1 = new Complex(5, 5);
      const zero = new Complex(0, 0);
      expect(() => z1.div(zero)).to.throw('Division by zero (0 + 0i) in complex arithmetic.');
    });

    it('should return a new Complex instance', () => {
      const z1 = new Complex(2, 2);
      const z2 = new Complex(1, 1);
      const result = z1.div(z2);
      expect(result).to.be.an.instanceOf(Complex);
      expect(result).to.not.equal(z1);
    });
  });

  describe('Absolute Value (Magnitude)', () => {
    it('should correctly calculate the absolute value', () => {
      const z = new Complex(3, 4); // |3 + 4i| = sqrt(3^2 + 4^2) = sqrt(9 + 16) = 5
      expect(z.abs()).to.equal(5);
    });

    it('should return 0 for the complex number 0 + 0i', () => {
      const z = new Complex(0, 0);
      expect(z.abs()).to.equal(0);
    });

    it('should return the absolute value of the real part for a real number', () => {
      const z = new Complex(-7, 0);
      expect(z.abs()).to.equal(7);
    });
  });

  describe('Conjugate', () => {
    it('should correctly calculate the conjugate of a complex number', () => {
      const z = new Complex(3, 4);
      const conj = z.conjugate();
      expect(conj.re).to.equal(3);
      expect(conj.im).to.equal(-4);
    });

    it('should return the same number if it is purely real', () => {
      const z = new Complex(5, 0);
      const conj = z.conjugate();
      expect(conj.re).to.equal(5);
      expect(conj.im).to.equal(0);
    });

    it('should return a new Complex instance', () => {
      const z = new Complex(1, 1);
      const conj = z.conjugate();
      expect(conj).to.be.an.instanceOf(Complex);
      expect(conj).to.not.equal(z);
    });
  });

  describe('Power', () => {
    const z = new Complex(2, 3);

    it('should throw an error for non-integer exponents', () => {
      expect(() => z.pow(1.5)).to.throw('Exponent must be an integer for Complex.pow().');
    });

    it('should correctly calculate z^0 to be 1 + 0i', () => {
      const result = z.pow(0);
      expect(result.re).to.equal(1);
      expect(result.im).to.equal(0);
    });

    it('should correctly calculate z^1 to be z', () => {
      const result = z.pow(1);
      expect(result.re).to.equal(2);
      expect(result.im).to.equal(3);
      expect(result).to.equal(z); // Special case returns `this`
    });

    it('should correctly calculate a positive integer power', () => {
      // (2 + 3i)^3 = 2^3 + 3*(2^2)*(3i) + 3*2*(3i)^2 + (3i)^3
      // = 8 + 36i + 6*(-9) + (-27i) = 8 + 36i - 54 - 27i = -46 + 9i
      const result = z.pow(3);
      expect(result.re).to.be.closeTo(-46, EPSILON);
      expect(result.im).to.be.closeTo(9, EPSILON);
    });

    it('should correctly calculate z^-1 to be 1/z', () => {
      const one = new Complex(1, 0);
      const expected = one.div(z);
      const result = z.pow(-1);
      expect(result.re).to.be.closeTo(expected.re, EPSILON);
      expect(result.im).to.be.closeTo(expected.im, EPSILON);
    });

    it('should correctly calculate a negative integer power', () => {
      // (2+3i)^-2 = 1 / (2+3i)^2 = 1 / (4 + 12i - 9) = 1 / (-5 + 12i)
      // = (-5 - 12i) / (25 + 144) = (-5 - 12i) / 169
      const result = z.pow(-2);
      expect(result.re).to.be.closeTo(-5 / 169, EPSILON);
      expect(result.im).to.be.closeTo(-12 / 169, EPSILON);
    });
  });

  describe('Equality', () => {
    const z = new Complex(1, 2);

    it('should return true for identical complex numbers', () => {
      const z2 = new Complex(1, 2);
      expect(z.equals(z2)).to.be.true;
    });

    it('should return false for different real parts', () => {
      const z2 = new Complex(1.1, 2);
      expect(z.equals(z2)).to.be.false;
    });

    it('should return false for different imaginary parts', () => {
      const z2 = new Complex(1, 2.1);
      expect(z.equals(z2)).to.be.false;
    });

    it('should return true for numbers within the default tolerance', () => {
      const z2 = new Complex(1 + 1e-13, 2 - 1e-13);
      expect(z.equals(z2)).to.be.true;
    });

    it('should return false for numbers outside the default tolerance', () => {
      const z2 = new Complex(1 + 1e-11, 2);
      expect(z.equals(z2)).to.be.false;
    });

    it('should respect a custom tolerance', () => {
      const z2 = new Complex(1.01, 2);
      expect(z.equals(z2, 0.001)).to.be.false;
      expect(z.equals(z2, 0.1)).to.be.true;
    });
  });

  describe('String Representation', () => {
    it('should format a standard complex number correctly', () => {
      expect(new Complex(3, 5).toString()).to.equal('3 + 5i');
      expect(new Complex(3, -5).toString()).to.equal('3 - 5i');
    });

    it('should format a purely real number', () => {
      expect(new Complex(7, 0).toString()).to.equal('7');
      expect(new Complex(-7, 0).toString()).to.equal('-7');
    });

    it('should format a purely imaginary number', () => {
      expect(new Complex(0, 4).toString()).to.equal('4i');
      expect(new Complex(0, -4).toString()).to.equal('-4i');
    });

    it('should format imaginary parts of 1 and -1 correctly', () => {
      expect(new Complex(0, 1).toString()).to.equal('i');
      expect(new Complex(0, -1).toString()).to.equal('-i');
      expect(new Complex(2, 1).toString()).to.equal('2 + i');
      expect(new Complex(2, -1).toString()).to.equal('2 - i');
    });

    it('should format the zero complex number', () => {
      expect(new Complex(0, 0).toString()).to.equal('0');
    });
  });
});