/**
 * @file test/jsonpath-rule-engine.test.js
 * @description Unit tests for the JSONPathRuleEngine class.
 * These tests verify that the engine correctly evaluates data chunks against
 * various JSONPath expressions and handles different data formats and edge cases.
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { JSONPathRuleEngine } from '../lib/rules/jsonpath-rule-engine.js';
import { StreamProcessingError } from '../lib/utils/errors.js';

describe('JSONPathRuleEngine', () => {
  const engine = new JSONPathRuleEngine();

  describe('Instantiation', () => {
    it('should be an instance of JSONPathRuleEngine', () => {
      assert.ok(engine instanceof JSONPathRuleEngine, 'Should be an instance of JSONPathRuleEngine');
    });
  });

  describe('Successful Matches', () => {
    const testCases = [
      {
        description: 'should match a simple path on a plain object',
        chunk: { level: 'error', message: 'Something failed' },
        expression: '$.level',
        expected: true
      },
      {
        description: 'should match a value comparison on a plain object',
        chunk: { level: 'error', code: 500 },
        expression: '$.level[?(@ === "error")]',
        expected: true
      },
      {
        description: 'should match a numeric comparison in a nested object',
        chunk: { data: { value: 101 }, source: 'sensor-A' },
        expression: '$.data[?(@.value > 100)]',
        expected: true
      },
      {
        description: 'should match an item in an array',
        chunk: { tags: ['critical', 'api', 'downtime'] },
        expression: '$.tags[?(@ === "downtime")]',
        expected: true
      },
      {
        description: 'should match when chunk is a valid JSON string',
        chunk: '{"user": {"id": 123, "active": true}}',
        expression: '$.user[?(@.active === true)]',
        expected: true
      },
      {
        description: 'should match when chunk is a Buffer containing a valid JSON string',
        chunk: Buffer.from('{"sensorId": "xyz-001", "reading": 99.9}'),
        expression: '$.sensorId',
        expected: true
      },
      {
        description: 'should match a complex path with multiple filters',
        chunk: {
          products: [
            { id: 1, category: 'books', price: 10 },
            { id: 2, category: 'electronics', price: 150 },
            { id: 3, category: 'books', price: 25 }
          ]
        },
        expression: '$.products[?(@.category === "books" && @.price > 20)]',
        expected: true
      },
      {
        description: 'should match a path that returns a falsy value (0)',
        chunk: { value: 0 },
        expression: '$.value',
        expected: true
      },
      {
        description: 'should match a path that returns a falsy value (false)',
        chunk: { active: false },
        expression: '$.active',
        expected: true
      }
    ];

    for (const { description, chunk, expression, expected } of testCases) {
      it(description, () => {
        const result = engine.evaluate(chunk, expression);
        assert.strictEqual(result, expected, `Expression "${expression}" should evaluate to ${expected}`);
      });
    }
  });

  describe('Non-Matches', () => {
    const testCases = [
      {
        description: 'should not match a non-existent path',
        chunk: { level: 'info' },
        expression: '$.error.code',
        expected: false
      },
      {
        description: 'should not match when value comparison fails',
        chunk: { level: 'info', code: 200 },
        expression: '$.level[?(@ === "error")]',
        expected: false
      },
      {
        description: 'should not match when numeric comparison fails',
        chunk: { data: { value: 99 } },
        expression: '$.data[?(@.value > 100)]',
        expected: false
      },
      {
        description: 'should not match a non-existent item in an array',
        chunk: { tags: ['info', 'api'] },
        expression: '$.tags[?(@ === "downtime")]',
        expected: false
      },
      {
        description: 'should not match when chunk is a JSON string with non-matching content',
        chunk: '{"user": {"id": 123, "active": false}}',
        expression: '$.user[?(@.active === true)]',
        expected: false
      },
      {
        description: 'should not match when chunk is a Buffer with non-matching content',
        chunk: Buffer.from('{"sensorId": "xyz-001"}'),
        expression: '$.reading',
        expected: false
      },
      {
        description: 'should not match for an empty object when path requires properties',
        chunk: {},
        expression: '$.level',
        expected: false
      },
      {
        description: 'should not match for an empty array when path requires items',
        chunk: [],
        expression: '$[0]',
        expected: false
      },
      {
        description: 'should not match for primitive types like string (when not JSON)',
        chunk: 'just a plain string',
        expression: '$.level',
        expected: false // Because it fails to parse as JSON and throws, which is caught and handled.
      },
      {
        description: 'should not match for primitive types like number',
        chunk: 12345,
        expression: '$',
        expected: false
      },
      {
        description: 'should not match for null or undefined chunks',
        chunk: null,
        expression: '$.level',
        expected: false
      }
    ];

    for (const { description, chunk, expression, expected } of testCases) {
      it(description, () => {
        // Non-JSON strings will throw a StreamProcessingError, which is expected behavior
        // for invalid data, but the `evaluate` method itself won't be reachable.
        // We test the error case separately. Here, we just check the boolean return.
        if (typeof chunk === 'string' && !chunk.startsWith('{')) {
          assert.throws(() => engine.evaluate(chunk, expression), StreamProcessingError);
        } else {
          const result = engine.evaluate(chunk, expression);
          assert.strictEqual(result, expected, `Expression "${expression}" should evaluate to ${expected}`);
        }
      });
    }
  });

  describe('Error Handling', () => {
    it('should throw StreamProcessingError for invalid JSON string', () => {
      const chunk = '{"key": "value"'; // Malformed JSON
      const expression = '$.key';

      const err = assert.throws(
        () => engine.evaluate(chunk, expression),
        StreamProcessingError,
        'Should throw StreamProcessingError for invalid JSON'
      );

      assert.strictEqual(err.name, 'StreamProcessingError');
      assert.match(err.message, /Failed to parse chunk as JSON/);
      assert.strictEqual(err.chunk, chunk);
      assert.ok(err.cause instanceof SyntaxError, 'The cause should be a SyntaxError');
    });

    it('should throw StreamProcessingError for invalid JSON in a Buffer', () => {
      const chunk = Buffer.from('not json');
      const expression = '$.key';

      const err = assert.throws(
        () => engine.evaluate(chunk, expression),
        StreamProcessingError,
        'Should throw StreamProcessingError for invalid JSON in Buffer'
      );

      assert.match(err.message, /Failed to parse chunk as JSON/);
      assert.deepStrictEqual(err.chunk, chunk);
    });

    it('should throw StreamProcessingError for an invalid JSONPath expression', () => {
      const chunk = { key: 'value' };
      const invalidExpression = '$.[?(@)]'; // Invalid syntax

      const err = assert.throws(
        () => engine.evaluate(chunk, invalidExpression),
        StreamProcessingError,
        'Should throw StreamProcessingError for invalid expression'
      );

      assert.match(err.message, /JSONPath evaluation failed/);
      assert.deepStrictEqual(err.chunk, chunk);
      assert.ok(err.cause, 'Error should have a cause from the jsonpath library');
    });
  });
});