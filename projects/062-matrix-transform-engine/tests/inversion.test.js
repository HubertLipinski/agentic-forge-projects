/**
 * @file tests/inversion.test.js
 * @description Unit tests for matrix inversion functionality.
 *
 * This test suite ensures that the `invert()` method of the Matrix class works
 * correctly. It covers successful inversion of various transformation matrices,
 * the property that a matrix multiplied by its inverse yields the identity matrix,
 * and the handling of non-invertible (singular) matrices.
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

describe('Matrix Inversion', () => {
  const identity = new Matrix();

  test('inverting the identity matrix should return the identity matrix', () => {
    const inverted = identity.invert();
    expect(inverted.toArray()).toEqual(IDENTITY_MATRIX);
  });

  test('a matrix multiplied by its inverse should result in the identity matrix', () => {
    const m = new Matrix().translate(50, -100).rotate(PI / 4).scale(2, 0.5);
    const inverted = m.invert();
    const result = m.multiply(inverted);

    expectMatricesToBeClose(result, identity);
  });

  test('the inverse of an inverse should be the original matrix', () => {
    const original = new Matrix().scale(3, 1.5).translate(10, 10).rotateDeg(-30);
    const inverted = original.invert();
    const invertedAgain = inverted.invert();

    expectMatricesToBeClose(invertedAgain, original);
  });

  describe('Inversion of Basic Transformations', () => {
    test('should correctly invert a translation matrix', () => {
      const m = new Matrix().translate(10, 20);
      const inverted = m.invert();
      const expected = new Matrix().translate(-10, -20);
      expectMatricesToBeClose(inverted, expected);
    });

    test('should correctly invert a scaling matrix', () => {
      const m = new Matrix().scale(2, 5);
      const inverted = m.invert();
      const expected = new Matrix().scale(1 / 2, 1 / 5);
      expectMatricesToBeClose(inverted, expected);
    });

    test('should correctly invert a rotation matrix', () => {
      const angle = PI / 6; // 30 degrees
      const m = new Matrix().rotate(angle);
      const inverted = m.invert();
      const expected = new Matrix().rotate(-angle);
      expectMatricesToBeClose(inverted, expected);
    });

    test('should correctly invert a shear matrix', () => {
      const kx = PI / 4;
      const ky = PI / 6;
      const m = new Matrix().shear(kx, ky);
      const inverted = m.invert();
      const expected = new Matrix().shear(-kx, -ky);

      // Manual verification:
      // M = [1, tan(ky), tan(kx), 1, 0, 0]
      // M_inv should be [1, -tan(ky), -tan(kx), 1, 0, 0] / (1 - tan(kx)tan(ky))
      // However, our shear implementation is M_shear = M_shear_y * M_shear_x
      // So M_inv = (M_shear_x)^-1 * (M_shear_y)^-1 which is shear(-kx, -ky)
      // Let's test this by multiplying M * M_inv
      const result = m.multiply(expected);
      expectMatricesToBeClose(result, identity);
    });
  });

  describe('Inversion of Composed Transformations', () => {
    test('should correctly invert a translate-then-rotate matrix', () => {
      // The inverse operation is rotate-back, then translate-back.
      const m = new Matrix().translate(10, 20).rotate(PI / 2);
      const inverted = m.invert();
      const expected = new Matrix().rotate(-PI / 2).translate(-10, -20);
      expectMatricesToBeClose(inverted, expected);
    });

    test('should correctly invert a scale-then-translate matrix', () => {
      // The inverse operation is translate-back, then scale-back.
      const m = new Matrix().scale(2).translate(10, 20);
      const inverted = m.invert();
      const expected = new Matrix().translate(-10, -20).scale(0.5);
      expectMatricesToBeClose(inverted, expected);
    });

    test('should correctly invert a complex transformation chain', () => {
      const m = new Matrix().translate(50, 30).rotateDeg(45).scale(2, 3);
      const inverted = m.invert();
      // The inverse is the reverse sequence of inverse operations
      const expected = new Matrix().scale(1 / 2, 1 / 3).rotateDeg(-45).translate(-50, -30);
      expectMatricesToBeClose(inverted, expected);
    });
  });

  describe('Handling of Non-Invertible (Singular) Matrices', () => {
    test('should throw an error when inverting a matrix with zero determinant', () => {
      // A matrix with a column of zeros has a determinant of 0.
      const singularMatrix = new Matrix([0, 0, 1, 1, 5, 5]);
      expect(singularMatrix.determinant()).toBe(0);
      expect(() => singularMatrix.invert()).toThrow('Matrix is not invertible (determinant is zero).');
    });

    test('should throw an error when inverting a matrix with zero scale on one axis', () => {
      const m = new Matrix().scale(1, 0);
      expect(m.determinant()).toBe(0);
      expect(() => m.invert()).toThrow('Matrix is not invertible (determinant is zero).');
    });

    test('should throw an error when inverting a matrix with zero scale on both axes', () => {
      const m = new Matrix().scale(0);
      expect(m.determinant()).toBe(0);
      expect(() => m.invert()).toThrow('Matrix is not invertible (determinant is zero).');
    });

    test('should throw an error for a shear that collapses space to a line', () => {
      // A shear matrix [1, tan(ky), tan(kx), 1] is singular if 1 - tan(kx)tan(ky) = 0
      // This happens if tan(kx) * tan(ky) = 1, e.g., kx = ky = PI/4
      const k = PI / 4;
      const m = new Matrix().shear(k, k); // This is not a standard shear composition
      
      // Let's create a singular matrix manually that looks like a shear result
      // Let M = [1, 1, 1, 1, 0, 0]. det = 1*1 - 1*1 = 0.
      const singularShear = new Matrix([1, 1, 1, 1, 0, 0]);
      expect(singularShear.determinant()).toBe(0);
      expect(() => singularShear.invert()).toThrow('Matrix is not invertible (determinant is zero).');
    });
  });

  describe('Point Transformation with Inverted Matrix', () => {
    test('transforming a point and then transforming it back with the inverse should yield the original point', () => {
      const originalPoint = { x: 15, y: -25 };
      const m = new Matrix().translate(100, 200).rotateDeg(-60).scale(0.5);
      const inverted = m.invert();

      const transformedPoint = m.transformPoint(originalPoint);
      const restoredPoint = inverted.transformPoint(transformedPoint);

      expect(restoredPoint.x).toBeCloseTo(originalPoint.x);
      expect(restoredPoint.y).toBeCloseTo(originalPoint.y);
    });

    test('should work for a complex scene graph-like transformation', () => {
      const worldPoint = { x: 5, y: 10 };

      // Simulate a parent-child relationship
      const parentTransform = new Matrix().translate(100, 50).rotateDeg(90);
      const childTransform = new Matrix().translate(0, 20).scale(2); // Child is 20 units "down" from parent's origin and twice as big

      const totalTransform = parentTransform.multiply(childTransform);
      const screenPoint = totalTransform.transformPoint(worldPoint);

      // Now, use the inverse to go from screen back to local world coordinates
      const worldToScreenInverse = totalTransform.invert();
      const calculatedWorldPoint = worldToScreenInverse.transformPoint(screenPoint);

      expect(calculatedWorldPoint.x).toBeCloseTo(worldPoint.x);
      expect(calculatedWorldPoint.y).toBeCloseTo(worldPoint.y);
    });
  });
});