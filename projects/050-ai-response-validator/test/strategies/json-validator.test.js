/**
 * @file test/strategies/json-validator.test.js
 * @description Unit tests for the JSON validation strategy.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { JsonValidator } from '../../lib/strategies/json-validator.js';
import { ValidationError } from '../../lib/errors.js';
import { VALIDATION_STRATEGIES } from '../../lib/constants.js';

describe('JsonValidator', () => {
  const validSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      isStudent: { type: 'boolean' },
    },
    required: ['name', 'age'],
  };

  const invalidSchema = {
    type: 'object',
    properties: {
      name: { type: 'invalid-type' }, // Invalid type for schema
    },
  };

  describe('constructor', () => {
    it('should create an instance without options', () => {
      const validator = new JsonValidator();
      assert(validator instanceof JsonValidator, 'Should create an instance');
    });

    it('should create an instance with a valid schema', () => {
      const validator = new JsonValidator({ schema: validSchema });
      assert(validator instanceof JsonValidator, 'Should create an instance with schema');
    });

    it('should have the correct static name property', () => {
      assert.strictEqual(JsonValidator.name, VALIDATION_STRATEGIES.JSON, 'Static name should match constant');
    });
  });

  describe('validate() - Well-formedness only (no schema)', () => {
    let validator;
    before(() => {
      validator = new JsonValidator();
    });

    it('should return valid for a well-formed JSON string', async () => {
      const jsonString = '{"key": "value", "number": 123}';
      const result = await validator.validate(jsonString);

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.deepStrictEqual(result.data, { key: 'value', number: 123 }, 'Data should be the parsed object');
      assert.strictEqual(result.error, null, 'Error should be null');
    });

    it('should return invalid for a malformed JSON string', async () => {
      const malformedJson = '{ "key": "value", }'; // Trailing comma
      const result = await validator.validate(malformedJson);

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.strictEqual(result.data, null, 'Data should be null');
      assert(result.error.startsWith('Invalid JSON:'), 'Error message should indicate invalid JSON');
    });

    it('should return invalid for a non-JSON string', async () => {
      const nonJson = 'just a plain string';
      const result = await validator.validate(nonJson);

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.strictEqual(result.data, null, 'Data should be null');
      assert(result.error.startsWith('Invalid JSON:'), 'Error message should indicate invalid JSON');
    });

    it('should return invalid for an empty string', async () => {
      const result = await validator.validate('');

      assert.strictEqual(result.isValid, false, 'Should be invalid for empty string');
      assert.strictEqual(result.data, null, 'Data should be null');
      assert(result.error.includes('Unexpected end of JSON input'), 'Error message should be specific');
    });
  });

  describe('validate() - With a valid schema', () => {
    let validator;
    before(() => {
      validator = new JsonValidator({ schema: validSchema });
    });

    it('should return valid for a JSON string that conforms to the schema', async () => {
      const validJson = '{"name": "Alice", "age": 30, "isStudent": false}';
      const result = await validator.validate(validJson);

      assert.strictEqual(result.isValid, true, 'Should be valid');
      assert.deepStrictEqual(result.data, { name: 'Alice', age: 30, isStudent: false }, 'Data should be the parsed object');
      assert.strictEqual(result.error, null, 'Error should be null');
    });

    it('should return valid for a JSON with optional properties omitted', async () => {
      const validJson = '{"name": "Bob", "age": 25}';
      const result = await validator.validate(validJson);

      assert.strictEqual(result.isValid, true, 'Should be valid without optional properties');
      assert.deepStrictEqual(result.data, { name: 'Bob', age: 25 }, 'Data should be the parsed object');
      assert.strictEqual(result.error, null, 'Error should be null');
    });

    it('should return invalid for a JSON with a missing required property', async () => {
      const invalidJson = '{"name": "Charlie"}';
      const result = await validator.validate(invalidJson);

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.deepStrictEqual(result.data, { name: 'Charlie' }, 'Data should still be parsed');
      assert(result.error.includes("must have required property 'age'"), 'Error message should specify missing property');
    });

    it('should return invalid for a JSON with incorrect data types', async () => {
      const invalidJson = '{"name": "David", "age": "twenty-nine"}';
      const result = await validator.validate(invalidJson);

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.deepStrictEqual(result.data, { name: 'David', age: 'twenty-nine' }, 'Data should still be parsed');
      assert(result.error.includes('response.age must be number'), 'Error message should specify type mismatch');
    });

    it('should return invalid for a JSON with extra properties (by default Ajv allows them)', async () => {
      // Ajv's default behavior is to allow additional properties. This test confirms that behavior.
      const jsonWithExtra = '{"name": "Eve", "age": 42, "extra": "property"}';
      const result = await validator.validate(jsonWithExtra);

      assert.strictEqual(result.isValid, true, 'Should be valid as Ajv allows extra properties by default');
    });

    it('should return invalid for a malformed JSON string before even checking the schema', async () => {
      const malformedJson = '{"name": "Frank", "age": 50,}';
      const result = await validator.validate(malformedJson);

      assert.strictEqual(result.isValid, false, 'Should be invalid');
      assert.strictEqual(result.data, null, 'Data should be null because parsing failed');
      assert(result.error.startsWith('Invalid JSON:'), 'Error should be a parsing error, not a schema error');
    });
  });

  describe('validate() - With an invalid schema', () => {
    it('should throw a ValidationError during validation if the schema is invalid', async () => {
      const validator = new JsonValidator({ schema: invalidSchema });
      const validJson = '{"name": "Grace"}';

      await assert.rejects(
        async () => {
          await validator.validate(validJson);
        },
        (err) => {
          assert(err instanceof ValidationError, 'Error should be a ValidationError');
          assert(err.message.startsWith('Invalid JSON schema provided:'), 'Message should indicate an invalid schema');
          return true;
        },
        'Should reject with a ValidationError for an invalid schema'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle JSON containing unicode characters', async () => {
      const validator = new JsonValidator({ schema: { type: 'object', properties: { greeting: { type: 'string' } } } });
      const jsonString = '{"greeting": "Hello, 世界"}';
      const result = await validator.validate(jsonString);

      assert.strictEqual(result.isValid, true);
      assert.deepStrictEqual(result.data, { greeting: 'Hello, 世界' });
    });

    it('should handle large JSON strings', async () => {
      const validator = new JsonValidator();
      const largeObject = { data: 'a'.repeat(10 * 1024 * 1024) }; // 10MB string
      const jsonString = JSON.stringify(largeObject);
      const result = await validator.validate(jsonString);

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.data.data.length, largeObject.data.length);
    });

    it('should correctly validate a JSON array at the root', async () => {
      const schema = { type: 'array', items: { type: 'number' } };
      const validator = new JsonValidator({ schema });

      const validArray = '[1, 2, 3]';
      const resultValid = await validator.validate(validArray);
      assert.strictEqual(resultValid.isValid, true);
      assert.deepStrictEqual(resultValid.data, [1, 2, 3]);

      const invalidArray = '[1, "two", 3]';
      const resultInvalid = await validator.validate(invalidArray);
      assert.strictEqual(resultInvalid.isValid, false);
      assert(resultInvalid.error.includes('must be number'));
    });
  });
});