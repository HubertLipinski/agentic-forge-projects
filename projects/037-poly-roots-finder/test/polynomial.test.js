'use strict';

import { expect } from 'chai';
import { Polynomial } from '../lib/polynomial.js';
import { Complex } from '../lib/complex.js';

/**
 * A small tolerance for comparing floating-point numbers in tests.
 */
const EPSILON = 1e-12;

describe('Polynomial Class (lib/polynomial.js)', () => {
  describe('Constructor', () => {
    it('should create a polynomial with the given coefficients', () => {
      const p = new Polynomial([3, -2, 1]); // 3x^2 - 2x + 1
      expect(p.coeffs).to.deep.equal([3, -2, 1]);
    });

    it('should throw an error if coefficients are not a non-empty array', () => {
      expect(() => new Polynomial()).to.throw('Polynomial coefficients must be a non-empty array.');
      expect(() => new Polynomial([])).to.throw('Polynomial coefficients must be a non-empty array.');
      expect(() => new Polynomial('1,2,3')).to.throw('Polynomial coefficients must be a non-empty array.');
    });

    it('should throw an error if coefficients contain non-finite numbers', () => {
      expect(() => new Polynomial([1, 2, Infinity])).to.throw('Polynomial coefficients must be finite numbers.');
      expect(() => new Polynomial([1, NaN, 3])).to.throw('Polynomial coefficients must be finite numbers.');
      expect(() => new Polynomial([null, 2, 3])).to.throw('Polynomial coefficients must be finite numbers.');
    });

    it('should normalize coefficients by removing leading zeros', () => {
      const p = new Polynomial([0, 0, 1, 2, 3]); // Should be x^2 + 2x + 3
      expect(p.coeffs).to.deep.equal([1, 2, 3]);
    });

    it('should handle the zero polynomial [0, 0, 0] by normalizing to [0]', () => {
      const p = new Polynomial([0, 0, 0]);
      expect(p.coeffs).to.deep.equal([0]);
    });

    it('should handle a single zero coefficient [0]', () => {
      const p = new Polynomial([0]);
      expect(p.coeffs).to.deep.equal([0]);
    });

    it('should not remove a single non-zero coefficient', () => {
      const p = new Polynomial([5]);
      expect(p.coeffs).to.deep.equal([5]);
    });

    it('should create an immutable coefficients array', () => {
      const p = new Polynomial([1, 2, 3]);
      expect(() => { p.coeffs[0] = 5; }).to.throw(TypeError);
    });
  });

  describe('degree()', () => {
    it('should return the correct degree for a standard polynomial', () => {
      // 3x^2 - 2x + 1 -> degree 2
      const p = new Polynomial([3, -2, 1]);
      expect(p.degree()).to.equal(2);
    });

    it('should return degree 1 for a linear polynomial', () => {
      const p = new Polynomial([4, 5]); // 4x + 5
      expect(p.degree()).to.equal(1);
    });

    it('should return degree 0 for a non-zero constant polynomial', () => {
      const p = new Polynomial([7]); // P(x) = 7
      expect(p.degree()).to.equal(0);
    });

    it('should return degree 0 for the zero polynomial', () => {
      // The degree is conventionally -1, but 0 is more practical for our library's logic.
      const p = new Polynomial([0, 0, 0]);
      expect(p.degree()).to.equal(0);
    });
  });

  describe('evaluate()', () => {
    const p = new Polynomial([1, -3, 2]); // x^2 - 3x + 2

    it('should evaluate the polynomial at a real number point', () => {
      // P(0) = 2
      expect(p.evaluate(0).re).to.equal(2);
      // P(1) = 1 - 3 + 2 = 0
      expect(p.evaluate(1).re).to.equal(0);
      // P(3) = 9 - 9 + 2 = 2
      expect(p.evaluate(3).re).to.equal(2);
      // P(-2) = 4 - 3(-2) + 2 = 4 + 6 + 2 = 12
      expect(p.evaluate(-2).re).to.equal(12);
    });

    it('should evaluate the polynomial at a complex number point', () => {
      // P(i) = i^2 - 3i + 2 = -1 - 3i + 2 = 1 - 3i
      const result = p.evaluate(new Complex(0, 1));
      expect(result.re).to.be.closeTo(1, EPSILON);
      expect(result.im).to.be.closeTo(-3, EPSILON);
    });

    it('should evaluate a more complex polynomial at a complex point', () => {
      // P(x) = x^3 - 1
      const pCubic = new Polynomial([1, 0, 0, -1]);
      // P(2+i) = (2+i)^3 - 1
      // (2+i)^2 = 3+4i
      // (2+i)^3 = (3+4i)(2+i) = 6 + 3i + 8i - 4 = 2 + 11i
      // P(2+i) = (2+11i) - 1 = 1 + 11i
      const result = pCubic.evaluate(new Complex(2, 1));
      expect(result.re).to.be.closeTo(1, EPSILON);
      expect(result.im).to.be.closeTo(11, EPSILON);
    });

    it('should return a Complex instance', () => {
      expect(p.evaluate(5)).to.be.an.instanceOf(Complex);
      expect(p.evaluate(new Complex(1, 1))).to.be.an.instanceOf(Complex);
    });
  });

  describe('derivative()', () => {
    it('should compute the derivative of a standard polynomial', () => {
      // P(x) = 5x^3 - 2x^2 + 7x - 1
      // P'(x) = 15x^2 - 4x + 7
      const p = new Polynomial([5, -2, 7, -1]);
      const dp = p.derivative();
      expect(dp.coeffs).to.deep.equal([15, -4, 7]);
      expect(dp.degree()).to.equal(2);
    });

    it('should compute the derivative of a quadratic polynomial', () => {
      // P(x) = x^2 - 3x + 2
      // P'(x) = 2x - 3
      const p = new Polynomial([1, -3, 2]);
      const dp = p.derivative();
      expect(dp.coeffs).to.deep.equal([2, -3]);
      expect(dp.degree()).to.equal(1);
    });

    it('should compute the derivative of a linear polynomial', () => {
      // P(x) = 4x + 5
      // P'(x) = 4
      const p = new Polynomial([4, 5]);
      const dp = p.derivative();
      expect(dp.coeffs).to.deep.equal([4]);
      expect(dp.degree()).to.equal(0);
    });

    it('should return the zero polynomial for the derivative of a constant', () => {
      const p = new Polynomial([7]);
      const dp = p.derivative();
      expect(dp.coeffs).to.deep.equal([0]);
      expect(dp.degree()).to.equal(0);
    });

    it('should return the zero polynomial for the derivative of the zero polynomial', () => {
      const p = new Polynomial([0]);
      const dp = p.derivative();
      expect(dp.coeffs).to.deep.equal([0]);
      expect(dp.degree()).to.equal(0);
    });

    it('should return a new Polynomial instance', () => {
      const p = new Polynomial([1, 2, 3]);
      const dp = p.derivative();
      expect(dp).to.be.an.instanceOf(Polynomial);
      expect(dp).to.not.equal(p);
    });
  });

  describe('isMonic()', () => {
    it('should return true for a monic polynomial', () => {
      const p = new Polynomial([1, 5, -3]);
      expect(p.isMonic()).to.be.true;
    });

    it('should return false for a non-monic polynomial', () => {
      const p = new Polynomial([2, 5, -3]);
      expect(p.isMonic()).to.be.false;
    });

    it('should return false for a constant polynomial not equal to 1', () => {
      const p = new Polynomial([5]);
      expect(p.isMonic()).to.be.false;
    });

    it('should return true for the constant polynomial P(x) = 1', () => {
      const p = new Polynomial([1]);
      expect(p.isMonic()).to.be.true;
    });

    it('should return false for the zero polynomial', () => {
      const p = new Polynomial([0]);
      expect(p.isMonic()).to.be.false;
    });
  });

  describe('toMonic()', () => {
    it('should return the same instance if the polynomial is already monic', () => {
      const p = new Polynomial([1, -2, 5]);
      const monicP = p.toMonic();
      expect(monicP).to.equal(p);
    });

    it('should return a new monic polynomial by dividing coefficients', () => {
      // P(x) = 2x^2 - 4x + 8
      // Monic P(x) = x^2 - 2x + 4
      const p = new Polynomial([2, -4, 8]);
      const monicP = p.toMonic();
      expect(monicP.isMonic()).to.be.true;
      expect(monicP.coeffs).to.deep.equal([1, -2, 4]);
      expect(monicP).to.be.an.instanceOf(Polynomial);
      expect(monicP).to.not.equal(p);
    });

    it('should handle floating point coefficients', () => {
      const p = new Polynomial([-2.5, 5.0, -10.0]);
      const monicP = p.toMonic();
      expect(monicP.isMonic()).to.be.true;
      expect(monicP.coeffs[0]).to.be.closeTo(1, EPSILON);
      expect(monicP.coeffs[1]).to.be.closeTo(-2, EPSILON);
      expect(monicP.coeffs[2]).to.be.closeTo(4, EPSILON);
    });

    it('should return the zero polynomial if the original is the zero polynomial', () => {
      const p = new Polynomial([0, 0]);
      const monicP = p.toMonic();
      expect(monicP.coeffs).to.deep.equal([0]);
    });
  });

  describe('toString()', () => {
    it('should format a standard polynomial correctly', () => {
      const p = new Polynomial([3, -2, 1]);
      expect(p.toString()).to.equal('3*x^2 - 2*x + 1');
    });

    it('should handle a leading negative coefficient', () => {
      const p = new Polynomial([-4, 5, -6]);
      expect(p.toString()).to.equal('-4*x^2 + 5*x - 6');
    });

    it('should handle coefficients of 1 and -1 correctly', () => {
      const p = new Polynomial([1, -1, 1]); // x^2 - x + 1
      expect(p.toString()).to.equal('x^2 - x + 1');
    });

    it('should handle zero coefficients by skipping terms', () => {
      const p = new Polynomial([5, 0, -3, 0]); // 5x^3 - 3x
      expect(p.toString()).to.equal('5*x^3 - 3*x');
    });

    it('should format a linear polynomial', () => {
      expect(new Polynomial([2, 5]).toString()).to.equal('2*x + 5');
      expect(new Polynomial([1, -1]).toString()).to.equal('x - 1');
    });

    it('should format a constant polynomial', () => {
      expect(new Polynomial([42]).toString()).to.equal('42');
      expect(new Polynomial([-7]).toString()).to.equal('-7');
    });

    it('should format the zero polynomial', () => {
      expect(new Polynomial([0]).toString()).to.equal('0');
    });

    it('should format a monic polynomial correctly', () => {
      const p = new Polynomial([1, 0, 0, -1]); // x^3 - 1
      expect(p.toString()).to.equal('x^3 - 1');
    });
  });
});