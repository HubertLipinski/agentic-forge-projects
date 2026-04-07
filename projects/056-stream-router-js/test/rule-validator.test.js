/**
 * @file test/rule-validator.test.js
 * @description Unit tests for the RuleValidator class.
 * These tests verify that the rule configuration validator correctly identifies
 * valid and invalid rule structures.
 */

import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { Writable } from 'node:stream';
import { RuleValidator } from '../lib/rule-validator.js';
import { RuleValidationError } from '../lib/utils/errors.js';

// A mock writable stream for testing purposes.
const createMockWritable = () => new Writable({
  write(chunk, encoding, callback) {
    callback();
  }
});

describe('RuleValidator', () => {
  it('should instantiate without errors', () => {
    assert.doesNotThrow(() => new RuleValidator(), 'RuleValidator constructor should not throw');
  });

  describe('Successful Validation', () => {
    it('should validate a single, correct jsonpath rule', () => {
      const validator = new RuleValidator();
      const validRules = [{
        name: 'test-rule',
        type: 'jsonpath',
        expression: '$.level',
        destination: createMockWritable()
      }];

      assert.doesNotThrow(() => {
        validator.validate(validRules);
      }, 'Should not throw for a valid jsonpath rule');
    });

    it('should validate a single, correct regex rule', () => {
      const validator = new RuleValidator();
      const validRules = [{
        name: 'regex-rule',
        type: 'regex',
        expression: 'ERROR|WARN',
        destination: createMockWritable()
      }];

      assert.doesNotThrow(() => {
        validator.validate(validRules);
      }, 'Should not throw for a valid regex rule');
    });

    it('should validate an array with multiple valid rules', () => {
      const validator = new RuleValidator();
      const validRules = [
        {
          name: 'json-rule',
          type: 'jsonpath',
          expression: '$.data.value',
          destination: createMockWritable()
        },
        {
          name: 'text-rule',
          type: 'regex',
          expression: '^INFO',
          destination: createMockWritable()
        }
      ];

      assert.doesNotThrow(() => {
        validator.validate(validRules);
      }, 'Should not throw for an array of multiple valid rules');
    });

    it('should accept a destination that is not a stream but has a write method (duck-typing)', () => {
      const validator = new RuleValidator();
      const validRules = [{
        name: 'duck-typed-dest',
        type: 'regex',
        expression: '.*',
        destination: { write: () => {} }
      }];

      assert.doesNotThrow(() => {
        validator.validate(validRules);
      }, 'Should accept a destination object with a `write` function');
    });
  });

  describe('Failed Validation', () => {
    it('should throw RuleValidationError if rules is not an array', () => {
      const validator = new RuleValidator();
      const invalidRules = { name: 'not-an-array' };

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw RuleValidationError for non-array input');

      assert.strictEqual(err.name, 'RuleValidationError');
      assert.match(err.message, /must be an array/);
    });

    it('should throw RuleValidationError for an empty array', () => {
      const validator = new RuleValidator();
      const invalidRules = [];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw for an empty rules array');

      assert.match(err.message, /must contain at least one rule/);
    });

    it('should throw RuleValidationError if a rule is not an object', () => {
      const validator = new RuleValidator();
      const invalidRules = ['not-an-object'];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw if an item in the array is not an object');

      assert.match(err.message, /Rule at index 0 must be a valid object/);
    });

    it('should throw RuleValidationError for a missing "name" property', () => {
      const validator = new RuleValidator();
      const invalidRules = [{
        type: 'regex',
        expression: '.*',
        destination: createMockWritable()
      }];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw for a missing "name"');

      assert.match(err.message, /Rule at index 0 is missing required property 'name'/);
      assert.strictEqual(err.validationErrors[0].params.missingProperty, 'name');
    });

    it('should throw RuleValidationError for an invalid "type" property', () => {
      const validator = new RuleValidator();
      const invalidRules = [{
        name: 'bad-type',
        type: 'invalid-type',
        expression: '.*',
        destination: createMockWritable()
      }];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw for an invalid "type"');

      assert.match(err.message, /property 'type' must be one of \[jsonpath, regex\]/);
    });

    it('should throw RuleValidationError for a missing "expression" property', () => {
      const validator = new RuleValidator();
      const invalidRules = [{
        name: 'no-expr',
        type: 'jsonpath',
        destination: createMockWritable()
      }];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw for a missing "expression"');

      assert.match(err.message, /is missing required property 'expression'/);
    });

    it('should throw RuleValidationError for a missing "destination" property', () => {
      const validator = new RuleValidator();
      const invalidRules = [{
        name: 'no-dest',
        type: 'regex',
        expression: '.*'
      }];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw for a missing "destination"');

      assert.match(err.message, /is missing required property 'destination'/);
    });

    it('should throw RuleValidationError if "destination" is not a writable-like object', () => {
      const validator = new RuleValidator();
      const invalidRules = [{
        name: 'bad-dest',
        type: 'regex',
        expression: '.*',
        destination: { not_a_write_function: true }
      }];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw if destination lacks a `write` method');

      assert.match(err.message, /property "destination" must be a valid Writable stream/);
    });

    it('should throw RuleValidationError for an additional unknown property', () => {
      const validator = new RuleValidator();
      const invalidRules = [{
        name: 'extra-prop',
        type: 'regex',
        expression: '.*',
        destination: createMockWritable(),
        extra: 'this should not be here'
      }];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError, 'Should throw for an additional property');

      assert.match(err.message, /has an unexpected property 'extra'/);
      assert.strictEqual(err.validationErrors[0].params.additionalProperty, 'extra');
    });

    it('should collect and report multiple errors in a single rule', () => {
      const validator = new RuleValidator();
      const invalidRules = [{
        // Missing 'name' and 'destination', has additional property 'foo'
        type: 'regex',
        expression: '.*',
        foo: 'bar'
      }];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError);

      assert.strictEqual(err.validationErrors.length, 3, 'Should report 3 validation errors');
      const messages = err.validationErrors.map(e => e.message);
      assert.ok(messages.some(m => m.includes('must have required property \'name\'')), 'Should report missing name');
      assert.ok(messages.some(m => m.includes('must have required property \'destination\'')), 'Should report missing destination');
      assert.ok(messages.some(m => m.includes('must NOT have additional properties')), 'Should report additional property');
    });

    it('should report an error in the second rule of a multi-rule array', () => {
      const validator = new RuleValidator();
      const invalidRules = [
        {
          name: 'valid-rule',
          type: 'jsonpath',
          expression: '$.ok',
          destination: createMockWritable()
        },
        {
          name: 'invalid-rule',
          type: 'invalid-type', // The error is here
          expression: '.*',
          destination: createMockWritable()
        }
      ];

      const err = assert.throws(() => {
        validator.validate(invalidRules);
      }, RuleValidationError);

      assert.match(err.message, /Rule at index 1/, 'Error message should reference index 1');
      assert.match(err.message, /property 'type' must be one of \[jsonpath, regex\]/);
    });
  });
});