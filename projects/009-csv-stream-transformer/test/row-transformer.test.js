/**
 * @file test/row-transformer.test.js
 * @description Unit tests for the RowTransformer stream.
 * This test suite verifies the core logic of the RowTransformer, including
 * row filtering, column mapping, renaming, and value transformations.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { RowTransformer } from '../src/core/row-transformer.js';

/**
 * A helper function to run a RowTransformer and collect its output.
 * @param {import('stream').Readable} sourceStream - The stream of input row objects.
 * @param {object} transformerOptions - The options to pass to the RowTransformer constructor.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of the transformed row objects.
 */
async function collectStreamOutput(sourceStream, transformerOptions) {
  const results = [];
  const transformer = new RowTransformer(transformerOptions);

  const pipeline = sourceStream.pipe(transformer);

  for await (const chunk of pipeline) {
    results.push(chunk);
  }

  return results;
}

describe('RowTransformer', () => {
  describe('Constructor', () => {
    it('should throw an error if mappingRules are not provided', () => {
      assert.throws(
        () => new RowTransformer(),
        {
          name: 'RowTransformerError',
          message: '`mappingRules` must be a non-empty array.',
        }
      );
    });

    it('should throw an error if mappingRules is not an array', () => {
      assert.throws(
        () => new RowTransformer({ mappingRules: {} }),
        {
          name: 'RowTransformerError',
          message: '`mappingRules` must be a non-empty array.',
        }
      );
    });

    it('should successfully instantiate with valid mappingRules', () => {
      assert.doesNotThrow(() => {
        new RowTransformer({ mappingRules: [{ from: 'a' }] });
      });
    });
  });

  describe('Filtering Logic (`shouldKeepRow`)', () => {
    it('should keep all rows if no filter rules are provided', async () => {
      const sourceData = [
        { id: '1', status: 'active' },
        { id: '2', status: 'inactive' },
      ];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        filterRules: [],
        mappingRules: [{ from: 'id' }],
      });

      assert.strictEqual(results.length, 2);
    });

    it('should keep rows matching a single "equals" filter', async () => {
      const sourceData = [
        { id: '1', status: 'active' },
        { id: '2', status: 'inactive' },
        { id: '3', status: 'active' },
      ];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        filterRules: [{ column: 'status', equals: 'active' }],
        mappingRules: [{ from: 'id' }],
      });

      assert.strictEqual(results.length, 2);
      assert.deepStrictEqual(results.map(r => r.id), ['1', '3']);
    });

    it('should keep rows matching a single "not" filter', async () => {
      const sourceData = [
        { id: '1', status: 'active' },
        { id: '2', status: 'inactive' },
        { id: '3', status: 'pending' },
      ];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        filterRules: [{ column: 'status', not: 'inactive' }],
        mappingRules: [{ from: 'id' }],
      });

      assert.strictEqual(results.length, 2);
      assert.deepStrictEqual(results.map(r => r.id), ['1', '3']);
    });

    it('should keep rows matching multiple ANDed filter rules', async () => {
      const sourceData = [
        { id: '1', status: 'active', region: 'us-east-1' },
        { id: '2', status: 'inactive', region: 'us-east-1' },
        { id: '3', status: 'active', region: 'eu-west-1' },
        { id: '4', status: 'active', region: 'us-east-1' },
      ];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        filterRules: [
          { column: 'status', equals: 'active' },
          { column: 'region', equals: 'us-east-1' },
        ],
        mappingRules: [{ from: 'id' }],
      });

      assert.strictEqual(results.length, 2);
      assert.deepStrictEqual(results.map(r => r.id), ['1', '4']);
    });

    it('should correctly filter based on numeric values', async () => {
      const sourceData = [
        { id: 1, value: 100 },
        { id: 2, value: 200 },
        { id: 3, value: 100 },
      ];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        filterRules: [{ column: 'value', equals: 100 }],
        mappingRules: [{ from: 'id' }],
      });

      assert.strictEqual(results.length, 2);
      assert.deepStrictEqual(results.map(r => r.id), [1, 3]);
    });

    it('should correctly filter based on boolean values', async () => {
      const sourceData = [
        { id: 1, deleted: false },
        { id: 2, deleted: true },
        { id: 3, deleted: false },
      ];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        filterRules: [{ column: 'deleted', not: true }],
        mappingRules: [{ from: 'id' }],
      });

      assert.strictEqual(results.length, 2);
      assert.deepStrictEqual(results.map(r => r.id), [1, 3]);
    });

    it('should correctly filter based on null values', async () => {
      const sourceData = [
        { id: 1, notes: 'some note' },
        { id: 2, notes: null },
        { id: 3, notes: '' },
      ];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        filterRules: [{ column: 'notes', equals: null }],
        mappingRules: [{ from: 'id' }],
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0].id, 2);
    });
  });

  describe('Mapping and Transformation Logic (`applyMapping`)', () => {
    it('should perform simple column mapping without renaming', async () => {
      const sourceData = [{ first_name: 'John', last_name: 'Doe', age: 30 }];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          { from: 'first_name' },
          { from: 'last_name' },
        ],
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], {
        first_name: 'John',
        last_name: 'Doe',
      });
    });

    it('should rename columns using the "to" property', async () => {
      const sourceData = [{ first_name: 'Jane', last_name: 'Doe' }];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          { from: 'first_name', to: 'firstName' },
          { from: 'last_name', to: 'lastName' },
        ],
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], {
        firstName: 'Jane',
        lastName: 'Doe',
      });
    });

    it('should apply a single built-in value transformer', async () => {
      const sourceData = [{ name: '  test  ' }];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          { from: 'name', transform: [{ name: 'trim' }] },
        ],
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], { name: 'test' });
    });

    it('should apply a chain of built-in value transformers in order', async () => {
      const sourceData = [{ name: '  test me  ' }];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          {
            from: 'name',
            transform: [
              { name: 'trim' },
              { name: 'toUpperCase' },
              { name: 'prefix', params: ['PREFIX-'] },
            ],
          },
        ],
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], { name: 'PREFIX-TEST ME' });
    });

    it('should apply transformers with parameters', async () => {
      const sourceData = [{ value: '123.456' }];
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          {
            from: 'value',
            to: 'fixedValue',
            transform: [{ name: 'toFixed', params: [2] }],
          },
        ],
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], { fixedValue: '123.46' });
    });

    it('should use a custom transformer function if provided', async () => {
      const sourceData = [{ value: 10 }];
      const sourceStream = Readable.from(sourceData);
      const double = (val) => val * 2;

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          { from: 'value', transform: [{ name: 'doubleIt' }] },
        ],
        customTransformers: { doubleIt: double },
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], { value: 20 });
    });

    it('should prioritize custom transformers over built-in ones with the same name', async () => {
      const sourceData = [{ value: '  test  ' }];
      const sourceStream = Readable.from(sourceData);
      const customTrim = (val) => `CUSTOM_${val.trim()}`;

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          { from: 'value', transform: [{ name: 'trim' }] },
        ],
        customTransformers: { trim: customTrim },
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], { value: 'CUSTOM_test' });
    });

    it('should throw an error if a specified transformer is not found', async () => {
      const sourceData = [{ value: 'test' }];
      const sourceStream = Readable.from(sourceData);

      await assert.rejects(
        collectStreamOutput(sourceStream, {
          mappingRules: [
            { from: 'value', transform: [{ name: 'nonExistentTransformer' }] },
          ],
        }),
        {
          name: 'RowTransformerError',
          message: 'Error processing row number 1: Transformer function "nonExistentTransformer" not found.',
        }
      );
    });

    it('should handle rows with missing source columns gracefully', async () => {
      const sourceData = [{ col_a: 'value_a' }]; // col_b is missing
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          { from: 'col_a' },
          { from: 'col_b', to: 'new_col_b' },
        ],
      });

      assert.strictEqual(results.length, 1);
      // When a source column is missing, its value is `undefined`.
      assert.deepStrictEqual(results[0], {
        col_a: 'value_a',
        new_col_b: undefined,
      });
    });

    it('should apply a default value transformer for undefined input', async () => {
      const sourceData = [{ col_a: 'value_a' }]; // col_b is missing
      const sourceStream = Readable.from(sourceData);

      const results = await collectStreamOutput(sourceStream, {
        mappingRules: [
          { from: 'col_a' },
          {
            from: 'col_b',
            transform: [{ name: 'default', params: ['DEFAULT'] }],
          },
        ],
      });

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], {
        col_a: 'value_a',
        col_b: 'DEFAULT',
      });
    });
  });

  describe('Error Handling', () => {
    it('should emit an error if a transformer function throws', async () => {
      const sourceData = [{ value: 'a' }];
      const sourceStream = Readable.from(sourceData);
      const failingTransformer = () => { throw new Error('Something went wrong'); };

      await assert.rejects(
        collectStreamOutput(sourceStream, {
          mappingRules: [
            { from: 'value', transform: [{ name: 'fail' }] },
          ],
          customTransformers: { fail: failingTransformer },
        }),
        {
          name: 'RowTransformerError',
          message: 'Error processing row number 1: Something went wrong',
          details: { row: { value: 'a' } },
        }
      );
    });

    it('should correctly report the row number in error messages', async () => {
      const sourceData = [
        { value: 'ok' },
        { value: 'ok' },
        { value: 'fail' },
      ];
      const sourceStream = Readable.from(sourceData);
      const conditionalFail = (val) => {
        if (val === 'fail') {
          throw new Error('I was told to fail');
        }
        return val;
      };

      await assert.rejects(
        collectStreamOutput(sourceStream, {
          mappingRules: [
            { from: 'value', transform: [{ name: 'maybeFail' }] },
          ],
          customTransformers: { maybeFail: conditionalFail },
        }),
        {
          name: 'RowTransformerError',
          message: 'Error processing row number 3: I was told to fail',
          details: { row: { value: 'fail' } },
        }
      );
    });

    it('should stop processing after the first error', async () => {
      const sourceData = [
        { value: 'ok' },
        { value: 'fail' },
        { value: 'never reaches here' },
      ];
      const sourceStream = Readable.from(sourceData);
      const transformer = new RowTransformer({
        mappingRules: [{ from: 'value', transform: [{ name: 'maybeFail' }] }],
        customTransformers: {
          maybeFail: (val) => {
            if (val === 'fail') throw new Error('Fail');
            return val;
          },
        },
      });

      const onData = mock.fn();
      transformer.on('data', onData);

      const pipelinePromise = Readable.from(sourceData).pipe(transformer).toArray();

      await assert.rejects(pipelinePromise);

      // Should only have processed the first 'ok' chunk before failing on the second.
      assert.strictEqual(onData.mock.callCount(), 1);
    });
  });
});