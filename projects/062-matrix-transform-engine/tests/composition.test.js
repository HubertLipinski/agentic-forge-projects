/**
 * @file tests/composition.test.js
 * @description Integration-style tests for chained matrix transformations.
 *
 * This test suite verifies that composing multiple transformations (e.g., translate,
 * then rotate, then scale) via the chainable API produces the correct final matrix.
 * It ensures that the order of operations is respected and that the underlying
 * matrix multiplication is working as expected in a real-world scenario.
 */

import { Matrix } from '../src/matrix.js';
import { PI } from '../src/utils/constants.js';

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

describe('Matrix Composition (Chaining)', () => {
  let identity;

  beforeEach(() => {
    identity = new Matrix();
  });

  test('should correctly compose translate then scale', () => {
    // Operation: Translate by (10, 20), then scale by 2.
    // A point (px, py) first becomes (px+10, py+20).
    // Then it's scaled, resulting in (2*(px+10), 2*(py+20)) = (2*px + 20, 2*py + 40).
    // The matrix for this is: scale(2) * translate(10, 20)
    // | 2 0 0 |   | 1 0 10 |   | 2 0 20 |
    // | 0 2 0 | * | 0 1 20 | = | 0 2 40 |
    // | 0 0 1 |   | 0 0 1  |   | 0 0 1  |
    // Resulting matrix: [2, 0, 0, 2, 20, 40]
    const m = identity.translate(10, 20).scale(2);
    const expected = new Matrix([2, 0, 0, 2, 20, 40]);
    expectMatricesToBeClose(m, expected);
  });

  test('should correctly compose scale then translate', () => {
    // Operation: Scale by 2, then translate by (10, 20).
    // A point (px, py) first becomes (2*px, 2*py).
    // Then it's translated, resulting in (2*px + 10, 2*py + 20).
    // The matrix for this is: translate(10, 20) * scale(2)
    // | 1 0 10 |   | 2 0 0 |   | 2 0 10 |
    // | 0 1 20 | * | 0 2 0 | = | 0 2 20 |
    // | 0 0 1  |   | 0 0 1 |   | 0 0 1  |
    // Resulting matrix: [2, 0, 0, 2, 10, 20]
    const m = identity.scale(2).translate(10, 20);
    const expected = new Matrix([2, 0, 0, 2, 10, 20]);
    expectMatricesToBeClose(m, expected);
  });

  test('should correctly compose translate then rotate', () => {
    // Operation: Translate by (10, 0), then rotate by 90 degrees (PI/2 radians).
    // A point (px, py) becomes (px+10, py).
    // Then it's rotated: (x', y') = (-y, x) => (-(py), px+10).
    // The matrix for this is: rotate(90) * translate(10, 0)
    // | 0 -1 0 |   | 1 0 10 |   | 0 -1 0  |
    // | 1  0 0 | * | 0 1 0  | = | 1  0 10 |
    // | 0  0 1 |   | 0 0 1  |   | 0  0 1  |
    // Resulting matrix: [0, 1, -1, 0, 0, 10]
    const m = identity.translate(10, 0).rotate(PI / 2);
    const expected = new Matrix([0, 1, -1, 0, 0, 10]);
    expectMatricesToBeClose(m, expected);
  });

  test('should correctly compose rotate then translate', () => {
    // Operation: Rotate by 90 degrees, then translate by (10, 0).
    // A point (px, py) becomes (-py, px).
    // Then it's translated: (-py+10, px).
    // The matrix for this is: translate(10, 0) * rotate(90)
    // | 1 0 10 |   | 0 -1 0 |   | 0 -1 10 |
    // | 0 1 0  | * | 1  0 0 | = | 1  0 0  |
    // | 0 0 1  |   | 0  0 1 |   | 0  0 1  |
    // Resulting matrix: [0, 1, -1, 0, 10, 0]
    const m = identity.rotate(PI / 2).translate(10, 0);
    const expected = new Matrix([0, 1, -1, 0, 10, 0]);
    expectMatricesToBeClose(m, expected);
  });

  test('should correctly compose a complex chain: scale, rotate, translate', () => {
    // Operation: Scale by 2, rotate by 90 degrees, then translate by (10, 20).
    // This is a common transformation order for game objects (scale -> rotate -> translate).
    // M = Translate(10, 20) * Rotate(90) * Scale(2)
    const m = identity.scale(2).rotate(PI / 2).translate(10, 20);

    // Let's calculate the expected matrix manually:
    // M_s = [2, 0, 0, 2, 0, 0]
    // M_r = [0, 1, -1, 0, 0, 0]
    // M_t = [1, 0, 0, 1, 10, 20]
    //
    // Step 1: M_rs = M_r * M_s
    // | 0 -1 0 |   | 2 0 0 |   | 0 -2 0 |
    // | 1  0 0 | * | 0 2 0 | = | 2  0 0 |
    // | 0  0 1 |   | 0 0 1 |   | 0  0 1 |
    // M_rs = [0, 1, -2, 0, 0, 0]
    //
    // Step 2: M_trs = M_t * M_rs
    // | 1 0 10 |   | 0 -2 0 |   | 0 -2 10 |
    // | 0 1 20 | * | 2  0 0 | = | 2  0 20 |
    // | 0 0 1  |   | 0  0 1 |   | 0  0 1  |
    // Final matrix: [0, 2, -2, 0, 10, 20]
    const expected = new Matrix([0, 2, -2, 0, 10, 20]);
    expectMatricesToBeClose(m, expected);
  });

  test('should correctly compose a complex chain: translate, rotate, scale', () => {
    // Operation: Translate by (10, 20), rotate by 90 degrees, then scale by 2.
    // This is like transforming a coordinate system.
    // M = Scale(2) * Rotate(90) * Translate(10, 20)
    const m = identity.translate(10, 20).rotate(PI / 2).scale(2);

    // Let's calculate the expected matrix manually:
    // M_t = [1, 0, 0, 1, 10, 20]
    // M_r = [0, 1, -1, 0, 0, 0]
    // M_s = [2, 0, 0, 2, 0, 0]
    //
    // Step 1: M_rt = M_r * M_t
    // | 0 -1 0 |   | 1 0 10 |   | 0 -1 -20 |
    // | 1  0 0 | * | 0 1 20 | = | 1  0  10 |
    // | 0  0 1 |   | 0 0 1  |   | 0  0  1  |
    // M_rt = [0, 1, -1, 0, -20, 10]
    //
    // Step 2: M_srt = M_s * M_rt
    // | 2 0 0 |   | 0 -1 -20 |   | 0 -2 -40 |
    // | 0 2 0 | * | 1  0  10 | = | 2  0  20 |
    // | 0 0 1 |   | 0  0  1  |   | 0  0  1  |
    // Final matrix: [0, 2, -2, 0, -40, 20]
    const expected = new Matrix([0, 2, -2, 0, -40, 20]);
    expectMatricesToBeClose(m, expected);
  });

  test('should produce correct results when using multiply method explicitly', () => {
    const m1 = new Matrix().translate(10, 20);
    const m2 = new Matrix().scale(2);

    // m1.multiply(m2) is equivalent to m1 then m2, so translate then scale
    const composed = m1.multiply(m2);
    const chained = new Matrix().translate(10, 20).scale(2);

    expectMatricesToBeClose(composed, chained);
    expectMatricesToBeClose(composed, new Matrix([2, 0, 0, 2, 20, 40]));
  });

  test('should handle a long chain of transformations correctly', () => {
    const m = identity
      .translate(10, 0)   // M1
      .scale(2, 1)        // M2
      .rotateDeg(90)      // M3
      .translate(0, -5);  // M4

    // M_final = M4 * M3 * M2 * M1
    const m1 = new Matrix([1, 0, 0, 1, 10, 0]);
    const m2 = new Matrix([2, 0, 0, 1, 0, 0]);
    const m3 = new Matrix([0, 1, -1, 0, 0, 0]);
    const m4 = new Matrix([1, 0, 0, 1, 0, -5]);

    const m21 = m2.multiply(m1); // M2 * M1
    const m321 = m3.multiply(m21); // M3 * M2 * M1
    const m4321 = m4.multiply(m321); // M4 * M3 * M2 * M1

    expectMatricesToBeClose(m, m4321);

    // Let's verify with point transformation
    const p = { x: 5, y: 10 };
    // 1. Translate(10, 0): (15, 10)
    // 2. Scale(2, 1): (30, 10)
    // 3. Rotate(90): (-10, 30)
    // 4. Translate(0, -5): (-10, 25)
    const finalPoint = m.transformPoint(p);
    expect(finalPoint.x).toBeCloseTo(-10);
    expect(finalPoint.y).toBeCloseTo(25);
  });
});