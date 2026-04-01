/**
 * @file test/validator.integration.test.js
 * @description Integration tests for the main Validator class.
 * These tests mock an LLM API to test the full retry and repair cycle.
 */

import { test, describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { Validator } from '../lib/validator.js';
import {
  MaxRetriesExceededError,
  LLMHandlerError,
  ConfigurationError,
} from '../lib/errors.js';
import { STRATEGIES } from '../lib/strategies/index.js';

// --- Test Setup ---

// Mock the delay function to speed up tests
mock.module('../lib/retry.js', () => ({
  ...require('../lib/retry.js'), // Import original module
  calculateBackoffDelay: mock.fn(() => 0), // Override calculateBackoffDelay to return 0ms
}));

// --- Mock LLM Handler ---

/**
 * A flexible mock LLM handler for testing.
 * It can be configured to return a sequence of responses to simulate a repair loop.
 *
 * @param {Array<string | Error>} responses - An array of responses or Errors to return on each call.
 * @param {object} [options={}] - Options for the mock handler.
 * @param {boolean} [options.stream=false] - If true, returns responses as ReadableStreams.
 * @returns {Function} A mock LLM handler function.
 */
const createMockLlmHandler = (responses, { stream = false } = {}) => {
  let callCount = 0;
  return mock.fn(async (prompt, llmOptions) => {
    const response = responses[callCount] ?? responses[responses.length - 1];
    callCount++;

    if (response instanceof Error) {
      throw response;
    }

    if (stream) {
      return Readable.from([response]);
    }
    return response;
  });
};

// --- Test Suites ---

describe('Validator Integration Tests', () => {
  describe('JSON Validation', () => {
    const jsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    };

    it('should succeed on the first attempt with valid JSON', async () => {
      const validJson = '{ "name": "Alice", "age": 30 }';
      const mockLlmHandler = createMockLlmHandler([validJson]);

      const validator = new Validator({
        type: STRATEGIES.JSON,
        strategyOptions: { schema: jsonSchema },
        llmHandler: mockLlmHandler,
        maxRetries: 2,
      });

      const result = await validator.validate('generate user json');

      assert.strictEqual(result.success, true, 'Validation should succeed');
      assert.deepStrictEqual(result.data, { name: 'Alice', age: 30 });
      assert.strictEqual(result.attempts, 1, 'Should take 1 attempt');
      assert.strictEqual(result.metadata.wasRepaired, false);
      assert.strictEqual(mockLlmHandler.mock.callCount(), 1);
    });

    it('should succeed after one repair attempt', async () => {
      const invalidJson = '{ "name": "Bob", "age": "forty" }'; // age is a string
      const validJson = '{ "name": "Bob", "age": 40 }';
      const mockLlmHandler = createMockLlmHandler([invalidJson, validJson]);

      const validator = new Validator({
        type: STRATEGIES.JSON,
        strategyOptions: { schema: jsonSchema },
        llmHandler: mockLlmHandler,
        maxRetries: 2,
      });

      const result = await validator.validate('generate user json');

      assert.strictEqual(result.success, true, 'Validation should succeed after repair');
      assert.deepStrictEqual(result.data, { name: 'Bob', age: 40 });
      assert.strictEqual(result.attempts, 2, 'Should take 2 attempts');
      assert.strictEqual(result.metadata.wasRepaired, true);
      assert.strictEqual(mockLlmHandler.mock.callCount(), 2);

      // Check if the repair prompt was constructed correctly
      const secondCallArgs = mockLlmHandler.mock.calls[1].arguments;
      const repairPrompt = secondCallArgs[0];
      assert.ok(repairPrompt.includes('Original Prompt:'));
      assert.ok(repairPrompt.includes('generate user json'));
      assert.ok(repairPrompt.includes('Your Invalid Response:'));
      assert.ok(repairPrompt.includes(invalidJson));
      assert.ok(repairPrompt.includes('The validation error was:'));
      assert.ok(repairPrompt.includes('response.age should be number'));
    });

    it('should fail after exhausting all retries', async () => {
      const invalidJson1 = '{ "name": "Charlie" }'; // missing age
      const invalidJson2 = '{ "name": "Charlie", "age": "invalid" }';
      const invalidJson3 = 'this is not json';
      const mockLlmHandler = createMockLlmHandler([
        invalidJson1,
        invalidJson2,
        invalidJson3,
      ]);

      const validator = new Validator({
        type: STRATEGIES.JSON,
        strategyOptions: { schema: jsonSchema },
        llmHandler: mockLlmHandler,
        maxRetries: 2, // 1 initial + 2 retries = 3 total attempts
      });

      const result = await validator.validate('generate user json');

      assert.strictEqual(result.success, false, 'Validation should fail');
      assert.ok(
        result.error instanceof MaxRetriesExceededError,
        'Error should be MaxRetriesExceededError',
      );
      assert.strictEqual(result.attempts, 3, 'Should take 3 attempts');
      assert.strictEqual(
        result.error.details.attemptsMade,
        3,
        'Error details should report 3 attempts',
      );
      assert.strictEqual(
        result.metadata.lastInvalidResponse,
        invalidJson3,
      );
      assert.strictEqual(mockLlmHandler.mock.callCount(), 3);
    });

    it('should handle streaming responses and succeed after repair', async () => {
      const invalidJson = '{ "name": "Diana", "age": "thirty-five" }';
      const validJson = '{ "name": "Diana", "age": 35 }';
      const mockLlmHandler = createMockLlmHandler([invalidJson, validJson], {
        stream: true,
      });

      const validator = new Validator({
        type: STRATEGIES.JSON,
        strategyOptions: { schema: jsonSchema },
        llmHandler: mockLlmHandler,
        maxRetries: 1,
      });

      const result = await validator.validate('generate user json');

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.data, { name: 'Diana', age: 35 });
      assert.strictEqual(result.attempts, 2);
      assert.strictEqual(result.metadata.wasRepaired, true);
      assert.strictEqual(mockLlmHandler.mock.callCount(), 2);
    });
  });

  describe('XML Validation', () => {
    it('should succeed with well-formed XML', async () => {
      const validXml = '<user><name>Eve</name></user>';
      const mockLlmHandler = createMockLlmHandler([validXml]);

      const validator = new Validator({
        type: STRATEGIES.XML,
        llmHandler: mockLlmHandler,
        maxRetries: 1,
      });

      const result = await validator.validate('generate user xml');

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.data, { user: { name: 'Eve' } });
      assert.strictEqual(result.attempts, 1);
    });

    it('should repair malformed XML', async () => {
      const invalidXml = '<user><name>Frank</name>'; // missing closing tag
      const validXml = '<user><name>Frank</name></user>';
      const mockLlmHandler = createMockLlmHandler([invalidXml, validXml]);

      const validator = new Validator({
        type: STRATEGIES.XML,
        llmHandler: mockLlmHandler,
        maxRetries: 1,
      });

      const result = await validator.validate('generate user xml');

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.data, { user: { name: 'Frank' } });
      assert.strictEqual(result.attempts, 2);
      assert.strictEqual(result.metadata.wasRepaired, true);
      assert.strictEqual(mockLlmHandler.mock.callCount(), 2);

      const repairPrompt = mockLlmHandler.mock.calls[1].arguments[0];
      assert.ok(repairPrompt.includes('Unclosed tag'));
    });
  });

  describe('Regex Validation', () => {
    it('should succeed with a matching string', async () => {
      const validResponse = 'User ID: 123-ABC';
      const mockLlmHandler = createMockLlmHandler([validResponse]);

      const validator = new Validator({
        type: STRATEGIES.REGEX,
        strategyOptions: { pattern: /User ID: (\d{3}-[A-Z]{3})/ },
        llmHandler: mockLlmHandler,
      });

      const result = await validator.validate('extract user id');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data[0], 'User ID: 123-ABC');
      assert.strictEqual(result.data[1], '123-ABC'); // a captured group
      assert.strictEqual(result.attempts, 1);
    });

    it('should repair a non-matching string', async () => {
      const invalidResponse = 'The user is 123ABC';
      const validResponse = 'User ID: 123-ABC';
      const mockLlmHandler = createMockLlmHandler([
        invalidResponse,
        validResponse,
      ]);

      const validator = new Validator({
        type: STRATEGIES.REGEX,
        strategyOptions: { pattern: /^User ID: \d{3}-[A-Z]{3}$/ },
        llmHandler: mockLlmHandler,
        maxRetries: 1,
      });

      const result = await validator.validate('extract user id');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data[0], 'User ID: 123-ABC');
      assert.strictEqual(result.attempts, 2);
      assert.strictEqual(result.metadata.wasRepaired, true);

      const repairPrompt = mockLlmHandler.mock.calls[1].arguments[0];
      assert.ok(repairPrompt.includes('did not match the pattern'));
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should throw ConfigurationError for invalid config', () => {
      assert.throws(
        () => new Validator({ type: 'json' }), // Missing llmHandler
        ConfigurationError,
        'The `llmHandler` must be an asynchronous function.',
      );

      const mockLlmHandler = createMockLlmHandler([]);
      assert.throws(
        () => new Validator({ llmHandler: mockLlmHandler }), // Missing type
        ConfigurationError,
        'A strategy name (string) must be provided.',
      );

      assert.throws(
        () => new Validator({ type: 'nonexistent', llmHandler: mockLlmHandler }),
        ConfigurationError,
        'Unknown validation strategy: "nonexistent"',
      );
    });

    it('should return an LLMHandlerError if the handler throws', async () => {
      const apiError = new Error('API key invalid');
      const mockLlmHandler = createMockLlmHandler([apiError]);

      const validator = new Validator({
        type: STRATEGIES.JSON,
        strategyOptions: { schema: {} },
        llmHandler: mockLlmHandler,
        maxRetries: 3,
      });

      const result = await validator.validate('some prompt');

      assert.strictEqual(result.success, false);
      assert.ok(result.error instanceof LLMHandlerError);
      assert.strictEqual(result.error.cause, apiError);
      assert.strictEqual(result.attempts, 1, 'Should not retry on handler error');
      assert.strictEqual(mockLlmHandler.mock.callCount(), 1);
    });

    it('should handle zero maxRetries correctly (one attempt only)', async () => {
      const invalidJson = '{"key":}';
      const mockLlmHandler = createMockLlmHandler([invalidJson]);

      const validator = new Validator({
        type: STRATEGIES.JSON,
        strategyOptions: { schema: {} },
        llmHandler: mockLlmHandler,
        maxRetries: 0,
      });

      const result = await validator.validate('a prompt');

      assert.strictEqual(result.success, false);
      assert.ok(result.error instanceof MaxRetriesExceededError);
      assert.strictEqual(result.attempts, 1);
      assert.strictEqual(mockLlmHandler.mock.callCount(), 1);
    });

    it('should use a custom repair prompt template if provided', async () => {
        const invalidResponse = 'invalid';
        const validResponse = '{"name":"Grace","age":42}';
        const mockLlmHandler = createMockLlmHandler([invalidResponse, validResponse]);
        const customTemplate = 'FIX THIS: {{invalidResponse}} | ERROR: {{validationError}}';

        const validator = new Validator({
            type: STRATEGIES.JSON,
            strategyOptions: { schema: { type: 'object' } },
            llmHandler: mockLlmHandler,
            maxRetries: 1,
            customRepairTemplate: customTemplate,
        });

        const result = await validator.validate('a prompt');

        assert.strictEqual(result.success, true);
        assert.strictEqual(mockLlmHandler.mock.callCount(), 2);

        const repairPrompt = mockLlmHandler.mock.calls[1].arguments[0];
        assert.ok(repairPrompt.startsWith('FIX THIS: invalid | ERROR:'));
        assert.ok(repairPrompt.includes('Invalid JSON'));
        assert.ok(!repairPrompt.includes('Original Prompt:'), 'Default template content should not be present');
    });
  });
});