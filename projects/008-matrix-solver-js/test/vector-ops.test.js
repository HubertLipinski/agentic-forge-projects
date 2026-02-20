/**
 * @file test/vector-ops.test.js
 * @description Unit tests for the vector operations utility.
 *
 * This test suite uses the built-in Node.js test runner to verify the mathematical
 * correctness and edge case handling of all functions in `src/utils/vector-ops.js`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as vec from '../src/utils/vector-ops.js';

const TOLERANCE = 1e-12;

describe('Vector Operations (vector-ops.js)', () => {
  describe('dot(v1, v2)', () => {
    it('should correctly calculate the dot product of two vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];
      const expected = 1 * 4 + 2 * 5 + 3 * 6; // 4 + 10 + 18 = 32
      assert.strictEqual(vec.dot(v1, v2), expected);
    });

    it('should correctly calculate the dot product using Float64Array', () => {
      const v1 = new Float64Array([1.5, -2.5, 3.0]);
      const v2 = new Float64Array([2.0, 4.0, -1.0]);
      const expected = 1.5 * 2.0 + -2.5 * 4.0 + 3.0 * -1.0; // 3 - 10 - 3 = -10
      assert.strictEqual(vec.dot(v1, v2), expected);
    });

    it('should return 0 for the dot product with a zero vector', () => {
      const v1 = [1, 2, 3];
      const v2 = [0, 0, 0];
      assert.strictEqual(vec.dot(v1, v2), 0);
    });

    it('should return 0 for dot product of orthogonal vectors', () => {
      const v1 = [1, 0];
      const v2 = [0, 1];
      assert.strictEqual(vec.dot(v1, v2), 0);
    });

    it('should handle negative numbers correctly', () => {
      const v1 = [-1, -2, -3];
      const v2 = [4, -5, 6];
      const expected = -1 * 4 + -2 * -5 + -3 * 6; // -4 + 10 - 18 = -12
      assert.strictEqual(vec.dot(v1, v2), expected);
    });

    it('should throw an error if vectors have different lengths', () => {
      const v1 = [1, 2];
      const v2 = [1, 2, 3];
      assert.throws(
        () => vec.dot(v1, v2),
        new Error('Cannot perform dot product: vectors have different lengths (2 vs 3).')
      );
    });

    it('should return 0 for empty vectors', () => {
      assert.strictEqual(vec.dot([], []), 0);
    });
  });

  describe('norm(v)', () => {
    it('should correctly calculate the L2 norm of a vector', () => {
      const v = [3, 4];
      const expected = 5; // sqrt(3*3 + 4*4) = sqrt(9 + 16) = sqrt(25)
      assert.strictEqual(vec.norm(v), expected);
    });

    it('should correctly calculate the norm using Float64Array', () => {
      const v = new Float64Array([1, 1, 1, 1]);
      const expected = 2; // sqrt(1+1+1+1)
      assert.strictEqual(vec.norm(v), expected);
    });

    it('should return 0 for a zero vector', () => {
      const v = [0, 0, 0];
      assert.strictEqual(vec.norm(v), 0);
    });

    it('should return 0 for an empty vector', () => {
      assert.strictEqual(vec.norm([]), 0);
    });

    it('should handle negative components', () => {
      const v = [-3, -4];
      const expected = 5;
      assert.strictEqual(vec.norm(v), expected);
    });
  });

  describe('add(v1, v2)', () => {
    it('should correctly add two vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [4, 5, 6];
      const expected = new Float64Array([5, 7, 9]);
      assert.deepStrictEqual(vec.add(v1, v2), expected);
    });

    it('should handle negative numbers', () => {
      const v1 = new Float64Array([1, -2, 3]);
      const v2 = new Float64Array([-4, 5, -6]);
      const expected = new Float64Array([-3, 3, -3]);
      assert.deepStrictEqual(vec.add(v1, v2), expected);
    });

    it('should return a Float64Array', () => {
      const v1 = [1, 2];
      const v2 = [3, 4];
      assert.ok(vec.add(v1, v2) instanceof Float64Array);
    });

    it('should throw an error if vectors have different lengths', () => {
      const v1 = [1, 2];
      const v2 = [1, 2, 3];
      assert.throws(
        () => vec.add(v1, v2),
        new Error('Cannot perform vector addition: vectors have different lengths (2 vs 3).')
      );
    });

    it('should return an empty Float64Array when adding empty vectors', () => {
        const result = vec.add([], []);
        assert.ok(result instanceof Float64Array);
        assert.strictEqual(result.length, 0);
    });
  });

  describe('sub(v1, v2)', () => {
    it('should correctly subtract two vectors', () => {
      const v1 = [4, 5, 6];
      const v2 = [1, 2, 3];
      const expected = new Float64Array([3, 3, 3]);
      assert.deepStrictEqual(vec.sub(v1, v2), expected);
    });

    it('should handle negative numbers', () => {
      const v1 = new Float64Array([1, -2, 3]);
      const v2 = new Float64Array([-4, 5, -6]);
      const expected = new Float64Array([5, -7, 9]);
      assert.deepStrictEqual(vec.sub(v1, v2), expected);
    });

    it('should return a Float64Array', () => {
      const v1 = [1, 2];
      const v2 = [3, 4];
      assert.ok(vec.sub(v1, v2) instanceof Float64Array);
    });

    it('should throw an error if vectors have different lengths', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2];
      assert.throws(
        () => vec.sub(v1, v2),
        new Error('Cannot perform vector subtraction: vectors have different lengths (3 vs 2).')
      );
    });

    it('should return an empty Float64Array when subtracting empty vectors', () => {
        const result = vec.sub([], []);
        assert.ok(result instanceof Float64Array);
        assert.strictEqual(result.length, 0);
    });
  });

  describe('scale(v, scalar)', () => {
    it('should correctly scale a vector by a positive scalar', () => {
      const v = [1, 2, 3];
      const scalar = 3;
      const expected = new Float64Array([3, 6, 9]);
      assert.deepStrictEqual(vec.scale(v, scalar), expected);
    });

    it('should correctly scale a vector by a negative scalar', () => {
      const v = new Float64Array([1, -2, 3]);
      const scalar = -2;
      const expected = new Float64Array([-2, 4, -6]);
      assert.deepStrictEqual(vec.scale(v, scalar), expected);
    });

    it('should correctly scale a vector by 0', () => {
      const v = [1, 2, 3];
      const scalar = 0;
      const expected = new Float64Array([0, 0, 0]);
      assert.deepStrictEqual(vec.scale(v, scalar), expected);
    });

    it('should correctly scale a vector by 1', () => {
      const v = [1, 2, 3];
      const scalar = 1;
      const expected = new Float64Array([1, 2, 3]);
      assert.deepStrictEqual(vec.scale(v, scalar), expected);
    });

    it('should return a Float64Array', () => {
      const v = [1, 2];
      assert.ok(vec.scale(v, 5) instanceof Float64Array);
    });

    it('should return an empty Float64Array when scaling an empty vector', () => {
        const result = vec.scale([], 10);
        assert.ok(result instanceof Float64Array);
        assert.strictEqual(result.length, 0);
    });
  });

  describe('clone(v)', () => {
    it('should create a deep copy of a standard array', () => {
      const v = [1, 2, 3];
      const clonedV = vec.clone(v);
      assert.deepStrictEqual(clonedV, new Float64Array([1, 2, 3]));
      assert.notStrictEqual(clonedV, v);
    });

    it('should create a deep copy of a Float64Array', () => {
      const v = new Float64Array([4, 5, 6]);
      const clonedV = vec.clone(v);
      assert.deepStrictEqual(clonedV, v);
      assert.notStrictEqual(clonedV, v); // Ensure it's a different object in memory
    });

    it('should return a Float64Array', () => {
      const v = [1, 2];
      assert.ok(vec.clone(v) instanceof Float64Array);
    });

    it('modifying the clone should not affect the original', () => {
      const v = [1, 2, 3];
      const clonedV = vec.clone(v);
      clonedV[0] = 99;
      assert.strictEqual(v[0], 1);
      assert.strictEqual(clonedV[0], 99);
    });

    it('should correctly clone an empty array', () => {
        const result = vec.clone([]);
        assert.ok(result instanceof Float64Array);
        assert.strictEqual(result.length, 0);
    });
  });

  describe('fill(size, fillValue)', () => {
    it('should create a vector of a given size filled with zeros by default', () => {
      const size = 5;
      const expected = new Float64Array([0, 0, 0, 0, 0]);
      assert.deepStrictEqual(vec.fill(size), expected);
    });

    it('should create a vector of a given size filled with a specific value', () => {
      const size = 4;
      const fillValue = 7.5;
      const expected = new Float64Array([7.5, 7.5, 7.5, 7.5]);
      assert.deepStrictEqual(vec.fill(size, fillValue), expected);
    });

    it('should create a vector of size 0', () => {
      const result = vec.fill(0);
      assert.ok(result instanceof Float64Array);
      assert.strictEqual(result.length, 0);
    });

    it('should return a Float64Array', () => {
      assert.ok(vec.fill(3) instanceof Float64Array);
    });

    it('should throw an error for negative size', () => {
      assert.throws(
        () => vec.fill(-1),
        new Error('Invalid vector size: -1. Must be a non-negative integer.')
      );
    });

    it('should throw an error for non-integer size', () => {
      assert.throws(
        () => vec.fill(3.5),
        new Error('Invalid vector size: 3.5. Must be a non-negative integer.')
      );
    });
  });
});