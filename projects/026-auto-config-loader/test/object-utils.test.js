/**
 * @file test/object-utils.test.js
 * @description Unit tests for the object utility functions.
 * This file uses the built-in Node.js test runner.
 */

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { deepMerge, get, set } from '../src/utils/object-utils.js';

describe('Object Utilities: src/utils/object-utils.js', () => {

  //--- Tests for deepMerge() ---//
  describe('deepMerge()', () => {
    it('should merge two simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = deepMerge({}, target, source);
      assert.deepStrictEqual(result, { a: 1, b: 3, c: 4 });
    });

    it('should perform a deep merge of nested objects', () => {
      const target = { a: 1, b: { c: 2, d: { e: 5 } } };
      const source = { b: { c: 3, f: 6 }, g: 7 };
      const result = deepMerge({}, target, source);
      assert.deepStrictEqual(result, { a: 1, b: { c: 3, d: { e: 5 }, f: 6 }, g: 7 });
    });

    it('should handle multiple source objects, with later sources taking precedence', () => {
      const target = { a: 1, b: { c: 10 } };
      const source1 = { b: { d: 20 }, c: 30 };
      const source2 = { a: 2, b: { c: 40, e: 50 } };
      const result = deepMerge({}, target, source1, source2);
      assert.deepStrictEqual(result, { a: 2, b: { c: 40, d: 20, e: 50 }, c: 30 });
    });

    it('should not modify the original source objects', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      const targetClone = structuredClone(target);
      const sourceClone = structuredClone(source);
      deepMerge({}, target, source);
      assert.deepStrictEqual(target, targetClone, 'Target object should not be mutated');
      assert.deepStrictEqual(source, sourceClone, 'Source object should not be mutated');
    });

    it('should overwrite arrays, not merge them', () => {
      const target = { a: [1, 2] };
      const source = { a: [3, 4] };
      const result = deepMerge({}, target, source);
      assert.deepStrictEqual(result, { a: [3, 4] });
    });

    it('should handle sources with `null` and `undefined` values', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { a: null, b: undefined };
      const result = deepMerge({}, target, source);
      assert.deepStrictEqual(result, { a: null, b: undefined });
    });

    it('should create nested objects in target if they do not exist', () => {
      const target = { a: 1 };
      const source = { b: { c: 2 } };
      const result = deepMerge({}, target, source);
      assert.deepStrictEqual(result, { a: 1, b: { c: 2 } });
    });

    it('should return the target object if no sources are provided', () => {
      const target = { a: 1 };
      const result = deepMerge(target);
      assert.strictEqual(result, target);
      assert.deepStrictEqual(result, { a: 1 });
    });

    it('should handle non-object sources gracefully', () => {
      const target = { a: 1 };
      const result = deepMerge({}, target, null, { b: 2 }, undefined, 123);
      assert.deepStrictEqual(result, { a: 1, b: 2 });
    });

    it('should handle objects created with Object.create(null)', () => {
        const target = Object.create(null);
        target.a = 1;
        const source = { b: { c: 3 } };
        const result = deepMerge(target, source);
        assert.deepStrictEqual(result, { a: 1, b: { c: 3 } });
        assert.strictEqual(Object.getPrototypeOf(result), null);
    });
  });

  //--- Tests for get() ---//
  describe('get()', () => {
    const testObj = {
      a: 1,
      b: {
        c: 'hello',
        d: {
          e: true,
        },
      },
      c: [10, 20],
      d: null,
    };

    it('should retrieve a top-level property', () => {
      assert.strictEqual(get(testObj, 'a'), 1);
    });

    it('should retrieve a nested property', () => {
      assert.strictEqual(get(testObj, 'b.c'), 'hello');
    });

    it('should retrieve a deeply nested property', () => {
      assert.strictEqual(get(testObj, 'b.d.e'), true);
    });

    it('should return undefined for a non-existent path', () => {
      assert.strictEqual(get(testObj, 'a.x.y'), undefined);
    });

    it('should return the default value for a non-existent path', () => {
      assert.strictEqual(get(testObj, 'a.x.y', 'default'), 'default');
      assert.strictEqual(get(testObj, 'b.z', null), null);
    });

    it('should return undefined for a path that goes through a non-object', () => {
      assert.strictEqual(get(testObj, 'a.b'), undefined);
    });

    it('should return a property with a null value', () => {
      assert.strictEqual(get(testObj, 'd'), null);
    });

    it('should return a default value if the path ends in a null or undefined property', () => {
        const objWithNull = { a: { b: null } };
        assert.strictEqual(get(objWithNull, 'a.b.c', 'default'), 'default');
    });

    it('should return the default value for invalid inputs', () => {
      assert.strictEqual(get(null, 'a.b', 'default'), 'default');
      assert.strictEqual(get(testObj, null, 'default'), 'default');
      assert.strictEqual(get(testObj, undefined, 'default'), 'default');
      assert.strictEqual(get(testObj, '', 'default'), 'default');
    });

    it('should retrieve an array property', () => {
      assert.deepStrictEqual(get(testObj, 'c'), [10, 20]);
    });
  });

  //--- Tests for set() ---//
  describe('set()', () => {
    let obj;

    before(() => {
      obj = {};
    });

    it('should set a top-level property', () => {
      set(obj, 'a', 100);
      assert.deepStrictEqual(obj, { a: 100 });
    });

    it('should create and set a nested property', () => {
      set(obj, 'b.c', 'world');
      assert.deepStrictEqual(obj, { a: 100, b: { c: 'world' } });
    });

    it('should create and set a deeply nested property', () => {
      set(obj, 'b.d.e', true);
      assert.deepStrictEqual(obj, { a: 100, b: { c: 'world', d: { e: true } } });
    });

    it('should overwrite an existing property', () => {
      set(obj, 'a', 200);
      assert.deepStrictEqual(obj, { a: 200, b: { c: 'world', d: { e: true } } });
    });

    it('should overwrite a nested property', () => {
      set(obj, 'b.c', 'new world');
      assert.deepStrictEqual(obj, { a: 200, b: { c: 'new world', d: { e: true } } });
    });

    it('should not overwrite a nested object if a new property is added to it', () => {
      set(obj, 'b.f', [1, 2, 3]);
      assert.deepStrictEqual(obj, { a: 200, b: { c: 'new world', d: { e: true }, f: [1, 2, 3] } });
    });

    it('should overwrite a primitive with an object if path continues', () => {
      const testObj = { a: { b: 1 } };
      set(testObj, 'a.b.c', 2);
      assert.deepStrictEqual(testObj, { a: { b: { c: 2 } } });
    });

    it('should return the modified object', () => {
      const testObj = {};
      const result = set(testObj, 'x.y', 'z');
      assert.strictEqual(result, testObj);
      assert.deepStrictEqual(result, { x: { y: 'z' } });
    });

    it('should handle invalid inputs gracefully by returning the original object', () => {
      const testObj = { a: 1 };
      assert.strictEqual(set(null, 'a.b', 2), null);
      assert.strictEqual(set(testObj, null, 2), testObj);
      assert.strictEqual(set(testObj, '', 2), testObj);
      assert.strictEqual(set(123, 'a.b', 2), 123);
    });

    it('should set a property to null or undefined', () => {
        const testObj = {};
        set(testObj, 'a.b', null);
        assert.deepStrictEqual(testObj, { a: { b: null } });
        set(testObj, 'a.c', undefined);
        assert.deepStrictEqual(testObj, { a: { b: null, c: undefined } });
    });
  });
});