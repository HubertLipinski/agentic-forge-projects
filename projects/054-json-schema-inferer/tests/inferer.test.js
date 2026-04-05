/**
 * @file tests/inferer.test.js
 * @description Unit tests for the core schema inference logic.
 * This file uses the built-in Node.js test runner.
 */

import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { inferSchema } from '../src/inferer.js';

describe('inferSchema() - Core Inference Logic', () => {

  it('should throw an error if the input is not a plain object', () => {
    assert.throws(() => inferSchema(null), {
      name: 'Error',
      message: 'Input must be a valid JSON object.',
    });
    assert.throws(() => inferSchema([]), {
      name: 'Error',
      message: 'Input must be a valid JSON object.',
    });
    assert.throws(() => inferSchema("a string"), {
      name: 'Error',
      message: 'Input must be a valid JSON object.',
    });
    assert.throws(() => inferSchema(123), {
      name: 'Error',
      message: 'Input must be a valid JSON object.',
    });
    assert.throws(() => inferSchema(undefined), {
      name: 'Error',
      message: 'Input must be a valid JSON object.',
    });
  });

  it('should generate a basic schema for an empty object', () => {
    const input = {};
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should infer basic primitive types correctly', () => {
    const input = {
      a_string: 'hello world',
      an_integer: 42,
      a_number: 3.14,
      a_boolean: true,
      a_null: null,
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        a_string: { type: 'string' },
        an_integer: { type: 'integer' },
        a_number: { type: 'number' },
        a_boolean: { type: 'boolean' },
        a_null: { type: 'null' },
      },
      required: ['a_boolean', 'a_null', 'a_number', 'a_string', 'an_integer'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should handle an empty array correctly', () => {
    const input = {
      empty_list: [],
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        empty_list: {
          type: 'array',
          // `items` is intentionally omitted for empty arrays
        },
      },
      required: ['empty_list'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should infer a schema for an array of a single primitive type', () => {
    const input = {
      numbers: [1, 2, 3],
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'integer' },
        },
      },
      required: ['numbers'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should infer a schema for an array of mixed primitive types', () => {
    const input = {
      mixed_primitives: [1, 'two', true, null, 3.5],
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        mixed_primitives: {
          type: 'array',
          items: {
            type: ['boolean', 'integer', 'null', 'number', 'string'],
          },
        },
      },
      required: ['mixed_primitives'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should upgrade integer to number when both are present in an array', () => {
    const input = {
      numbers: [1, 2.5, 3],
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'number' },
        },
      },
      required: ['numbers'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should infer a schema for a simple nested object', () => {
    const input = {
      user: {
        id: 1,
        name: 'John Doe',
      },
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
          required: ['id', 'name'],
        },
      },
      required: ['user'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should infer a schema for an array of objects with the same structure', () => {
    const input = {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
            required: ['id', 'name'],
          },
        },
      },
      required: ['users'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should infer a schema for an array of objects with different properties (merging)', () => {
    const input = {
      items: [
        { id: 1, name: 'Item A' },
        { id: 2, description: 'Item B has a description' },
      ],
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              description: { type: 'string' },
            },
            // 'id' is required because it's in both. 'name' and 'description' are optional.
            required: ['id'],
          },
        },
      },
      required: ['items'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should handle deeply nested structures', () => {
    const input = {
      data: {
        results: [
          {
            id: 'a1',
            metrics: { score: 98.5, rank: 1 },
            tags: ['active', 'featured'],
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 10,
          nextUrl: '/api/data?page=2',
        },
      },
      status: 'success',
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  metrics: {
                    type: 'object',
                    properties: {
                      score: { type: 'number' },
                      rank: { type: 'integer' },
                    },
                    required: ['rank', 'score'],
                  },
                  tags: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['id', 'metrics', 'tags'],
              },
            },
            pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'integer' },
                totalPages: { type: 'integer' },
                nextUrl: { type: 'string' },
              },
              required: ['currentPage', 'nextUrl', 'totalPages'],
            },
          },
          required: ['pagination', 'results'],
        },
        status: { type: 'string' },
      },
      required: ['data', 'status'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should handle an array containing a mix of objects and primitives', () => {
    const input = {
      mixed_array: [
        { type: 'A', value: 1 },
        'a string',
        { type: 'B', value: 2.5 },
        true,
      ],
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        mixed_array: {
          type: 'array',
          items: {
            type: ['boolean', 'object', 'string'],
            properties: {
              type: { type: 'string' },
              value: { type: 'number' }, // integer + number -> number
            },
            required: ['type', 'value'],
          },
        },
      },
      required: ['mixed_array'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should handle an object with no properties (empty)', () => {
    const input = {
      config: {},
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        config: {
          type: 'object',
        },
      },
      required: ['config'],
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });

  it('should correctly sort required properties and types for consistent output', () => {
    const input = {
      c_prop: true,
      a_prop: 1,
      b_prop: 'text',
      d_array: [null, 1, 'a'],
    };
    const expected = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        c_prop: { type: 'boolean' },
        a_prop: { type: 'integer' },
        b_prop: { type: 'string' },
        d_array: {
          type: 'array',
          items: {
            type: ['integer', 'null', 'string'], // sorted types
          },
        },
      },
      required: ['a_prop', 'b_prop', 'c_prop', 'd_array'], // sorted required
    };
    const actual = inferSchema(input);
    assert.deepStrictEqual(actual, expected);
  });
});