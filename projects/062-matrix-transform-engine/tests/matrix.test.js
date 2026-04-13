/**
 * @file tests/matrix.test.js
 * @description Unit tests for the Matrix class.
 *
 * This test suite focuses on verifying the correctness of individual transformation
 * methods (translate, rotate, scale, shear) and other core functionalities of the
 * Matrix class, such as construction, serialization, and property access.
 *
 * Composition of transformations is tested separately in `composition.test.js`.
 */

import { Matrix } from '../src/matrix.js';
import { IDENTITY_MATRIX, PI } from '../src/utils/constants.js';

// A helper function to compare two matrices for approximate equality.
// This is necessary because floating-point arithmetic can introduce small precision errors.
const expectMatricesToBeClose = (m1, m2) => {
  expect(m1).toBeInstanceOf(Matrix);
  expect(m2).toBeInstanceOf(Matrix);
  const arr1 = m1.toArray();
  const arr2 = m2.toArray();
  expect(arr1.length).toBe(6);
  expect(arr2.length).toBe(6);
  for (let i = 0; i < 6; i++) {
    expect(arr1[i]).toBeCloseTo(arr2[i]);
  }
};

describe('Matrix', () => {
  describe('Constructor and Factory Methods', () => {
    test('should create an identity matrix when called with no arguments', () => {
      const m = new Matrix();
      expect(m.toArray()).toEqual(IDENTITY_MATRIX);
    });

    test('should create a matrix from a 6-element array', () => {
      const values = [2, 0, 0, 3, 10, 20];
      const m = new Matrix(values);
      expect(m.toArray()).toEqual(values);
    });

    test('should create a copy when constructed with another Matrix instance', () => {
      const original = new Matrix([1, 2, 3, 4, 5, 6]);
      const copy = new Matrix(original);
      expect(copy.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
      expect(copy).not.toBe(original); // Should be a new instance
      expectMatricesToBeClose(copy, original);
    });

    test('should throw TypeError for invalid constructor arguments', () => {
      expect(() => new Matrix([1, 2, 3])).toThrow(TypeError);
      expect(() => new Matrix('invalid')).toThrow(TypeError);
      expect(() => new Matrix({ a: 1 })).toThrow(TypeError);
      expect(() => new Matrix([1, 2, 3, 4, 5, '6'])).toThrow(TypeError);
    });

    test('Matrix.fromObject should create a matrix from a valid object', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
      const m = Matrix.fromObject(obj);
      expect(m.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('Matrix.fromObject should throw TypeError for invalid objects', () => {
      expect(() => Matrix.fromObject(null)).toThrow(TypeError);
      expect(() => Matrix.fromObject({ a: 1, b: 2, c: 3, d: 4, e: 5 })).toThrow(TypeError);
      expect(() => Matrix.fromObject({ a: 1, b: 2, c: 3, d: 4, e: 5, f: '6' })).toThrow(TypeError);
    });

    test('Matrix.fromString should create a matrix from a valid CSS string', () => {
      const str = 'matrix(1, 2, 3, 4, 5, 6)';
      const m = Matrix.fromString(str);
      expect(m.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('Matrix.fromString should handle whitespace correctly', () => {
        const str = '  matrix( 1,  2,3,  4,5, 6 )  ';
        const m = Matrix.fromString(str);
        expect(m.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('Matrix.fromString should throw TypeError for invalid strings', () => {
      expect(() => Matrix.fromString('matrix(1, 2, 3, 4, 5)')).toThrow(TypeError);
      expect(() => Matrix.fromString('translate(10, 20)')).toThrow(TypeError);
      expect(() => Matrix.fromString('matrix(1, 2, 3, 4, 5, six)')).toThrow(TypeError);
      expect(() => Matrix.fromString(123)).toThrow(TypeError);
    });
  });

  describe('Immutability', () => {
    test('transformation methods should return a new Matrix instance', () => {
      const m1 = new Matrix();
      const m2 = m1.translate(10, 20);
      expect(m1).not.toBe(m2);
      expect(m1.toArray()).toEqual(IDENTITY_MATRIX); // Original should be unchanged
    });

    test('internal matrix array should be immutable', () => {
      const m = new Matrix();
      const arr = m.toArray();
      arr[0] = 99; // Modify the returned array
      expect(m.toArray()[0]).toBe(1); // The internal state should not be affected
    });
  });

  describe('Transformations', () => {
    let identity;
    beforeEach(() => {
      identity = new Matrix();
    });

    test('translate(tx, ty) should apply a translation', () => {
      const m = identity.translate(50, 100);
      const expected = [1, 0, 0, 1, 50, 100];
      expect(m.toArray()).toEqual(expected);
    });

    test('translate should throw TypeError for non-numeric arguments', () => {
      expect(() => identity.translate('50', 100)).toThrow(TypeError);
      expect(() => identity.translate(50, undefined)).toThrow(TypeError);
    });

    test('scale(sx, sy) should apply uniform scaling', () => {
      const m = identity.scale(2);
      const expected = [2, 0, 0, 2, 0, 0];
      expect(m.toArray()).toEqual(expected);
    });

    test('scale(sx, sy) should apply non-uniform scaling', () => {
      const m = identity.scale(2, 3);
      const expected = [2, 0, 0, 3, 0, 0];
      expect(m.toArray()).toEqual(expected);
    });

    test('scale should throw TypeError for non-numeric arguments', () => {
      expect(() => identity.scale('2', 3)).toThrow(TypeError);
      expect(() => identity.scale(2, null)).toThrow(TypeError);
    });

    test('rotate(radians) should apply rotation', () => {
      const m = identity.rotate(PI / 2); // 90 degrees
      const expected = [0, 1, -1, 0, 0, 0];
      expectMatricesToBeClose(m, new Matrix(expected));
    });

    test('rotate(radians) should handle full rotation', () => {
        const m = identity.rotate(2 * PI); // 360 degrees
        const expected = [1, 0, 0, 1, 0, 0]; // Should be close to identity
        expectMatricesToBeClose(m, new Matrix(expected));
    });

    test('rotate should throw TypeError for non-numeric arguments', () => {
      expect(() => identity.rotate('PI')).toThrow(TypeError);
    });

    test('rotateDeg(degrees) should apply rotation in degrees', () => {
      const m = identity.rotateDeg(90);
      const expected = [0, 1, -1, 0, 0, 0];
      expectMatricesToBeClose(m, new Matrix(expected));
    });

    test('rotateDeg should throw TypeError for non-numeric arguments', () => {
      expect(() => identity.rotateDeg(null)).toThrow(TypeError);
    });

    test('shear(kx, ky) should apply shear', () => {
      const kx = PI / 4; // 45 degrees
      const ky = 0;
      const m = identity.shear(kx, ky);
      const expected = [1, 0, Math.tan(kx), 1, 0, 0];
      expectMatricesToBeClose(m, new Matrix(expected));
    });

    test('shear should throw TypeError for non-numeric arguments', () => {
      expect(() => identity.shear('PI/4', 0)).toThrow(TypeError);
    });
  });

  describe('Operations', () => {
    test('determinant() should return the correct determinant', () => {
      const m = new Matrix([2, 1, 3, 4, 5, 6]);
      // det = a*d - b*c = 2*4 - 1*3 = 8 - 3 = 5
      expect(m.determinant()).toBe(5);
    });

    test('determinant() of identity matrix should be 1', () => {
      const m = new Matrix();
      expect(m.determinant()).toBe(1);
    });

    test('transformPoint(point) should correctly transform a point', () => {
      const m = new Matrix().translate(10, 20).scale(2);
      // Matrix is [2, 0, 0, 2, 10, 20]
      const point = { x: 5, y: 5 };
      // x' = 2*5 + 0*5 + 10 = 20
      // y' = 0*5 + 2*5 + 20 = 30
      const transformed = m.transformPoint(point);
      expect(transformed).toEqual({ x: 20, y: 30 });
    });

    test('transformPoint should throw for invalid point object', () => {
        const m = new Matrix();
        expect(() => m.transformPoint({ x: 1 })).toThrow(TypeError);
        expect(() => m.transformPoint({ y: 1 })).toThrow(TypeError);
        expect(() => m.transformPoint({ x: '1', y: 1 })).toThrow(TypeError);
        expect(() => m.transformPoint(null)).toThrow(TypeError);
    });
  });

  describe('Serialization and Comparison', () => {
    const values = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6];
    const m = new Matrix(values);

    test('toArray() should return a copy of the matrix components', () => {
      const arr = m.toArray();
      expect(arr).toEqual(values);
      arr[0] = 99;
      expect(m.toArray()).toEqual(values); // Ensure original is not modified
    });

    test('toObject() should return a plain object representation', () => {
      const obj = m.toObject();
      expect(obj).toEqual({ a: 1.1, b: 2.2, c: 3.3, d: 4.4, e: 5.5, f: 6.6 });
    });

    test('toString() should return a CSS matrix string', () => {
      const str = m.toString();
      expect(str).toBe('matrix(1.1, 2.2, 3.3, 4.4, 5.5, 6.6)');
    });

    test('equals() should return true for identical matrices', () => {
      const m1 = new Matrix([1, 2, 3, 4, 5, 6]);
      const m2 = new Matrix([1, 2, 3, 4, 5, 6]);
      expect(m1.equals(m2)).toBe(true);
    });

    test('equals() should return true for approximately equal matrices', () => {
      const m1 = new Matrix([1, 2, 3, 4, 5, 6]);
      const m2 = new Matrix([1.00000001, 2, 3, 4, 5, 6]);
      expect(m1.equals(m2)).toBe(true);
    });

    test('equals() should return false for different matrices', () => {
      const m1 = new Matrix([1, 2, 3, 4, 5, 6]);
      const m2 = new Matrix([9, 2, 3, 4, 5, 6]);
      expect(m1.equals(m2)).toBe(false);
    });

    test('equals() should return false when comparing with non-Matrix objects', () => {
      const m1 = new Matrix();
      expect(m1.equals(null)).toBe(false);
      expect(m1.equals([1, 0, 0, 1, 0, 0])).toBe(false);
      expect(m1.equals({})).toBe(false);
    });
  });
});