/**
 * @file tests/log-parser.test.js
 * @description Unit tests for the log parsing and enrichment logic.
 *
 * This test suite verifies the functionality of the `parseAndEnrich` function
 * from `src/utils/log-parser.js`. It covers various scenarios, including
 * parsing simple strings, structured JSON strings, and handling edge cases
 * like empty input and non-object JSON.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { parseAndEnrich } from '../src/utils/log-parser.js';

// A simple regex to validate UUID v4 format.
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A simple regex to validate ISO 8601 format (e.g., 2023-10-27T10:00:00.000Z).
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Log Parser - parseAndEnrich()', () => {

  it('should parse a simple string line and enrich it with metadata', () => {
    const line = 'This is a simple log message.';
    const source = '/var/log/app.log';

    const result = parseAndEnrich(line, source);

    assert.strictEqual(typeof result, 'object', 'Result should be an object');
    assert.ok(result.id && UUID_V4_REGEX.test(result.id), 'Result should have a valid UUID v4 id');
    assert.ok(result.timestamp && ISO_8601_REGEX.test(result.timestamp), 'Result should have a valid ISO 8601 timestamp');
    assert.strictEqual(result.source, source, 'Result should have the correct source');
    assert.strictEqual(result.raw, line, 'Result should contain the original raw line');
    assert.strictEqual(result.message, line, 'Result should have the line content as the message');
  });

  it('should parse a valid JSON string and merge it with enrichment data', () => {
    const originalLog = {
      level: 'info',
      details: 'User logged in successfully',
      userId: 123,
    };
    const line = JSON.stringify(originalLog);
    const source = 'tcp:3000';

    const result = parseAndEnrich(line, source);

    assert.strictEqual(typeof result, 'object', 'Result should be an object');
    assert.ok(result.id && UUID_V4_REGEX.test(result.id), 'Result should have a valid UUID v4 id');
    assert.ok(result.timestamp && ISO_8601_REGEX.test(result.timestamp), 'Result should have a valid ISO 8601 timestamp');
    assert.strictEqual(result.source, source, 'Result should have the correct source');
    assert.strictEqual(result.raw, line, 'Result should contain the original raw line');
    assert.strictEqual(result.level, originalLog.level, 'Original JSON property "level" should be preserved');
    assert.strictEqual(result.details, originalLog.details, 'Original JSON property "details" should be preserved');
    assert.strictEqual(result.userId, originalLog.userId, 'Original JSON property "userId" should be preserved');
    assert.strictEqual(result.message, undefined, 'Result should not have a "message" property when parsing JSON without it');
  });

  it('should handle JSON strings that already contain enrichment-like keys', () => {
    const conflictingLog = {
      id: 'original-id',
      timestamp: 'original-timestamp',
      source: 'original-source',
      message: 'This is a conflicting message',
    };
    const line = JSON.stringify(conflictingLog);
    const source = 'stdin';

    const result = parseAndEnrich(line, source);

    // Our enrichment should always take precedence over the original log's keys.
    assert.ok(result.id && result.id !== 'original-id' && UUID_V4_REGEX.test(result.id), 'Enrichment "id" should overwrite original');
    assert.ok(result.timestamp && result.timestamp !== 'original-timestamp' && ISO_8601_REGEX.test(result.timestamp), 'Enrichment "timestamp" should overwrite original');
    assert.strictEqual(result.source, source, 'Enrichment "source" should overwrite original');

    // The original `message` property should be preserved.
    assert.strictEqual(result.message, 'This is a conflicting message', 'Original "message" property should be kept');
    assert.strictEqual(result.raw, line, 'Result should contain the original raw line');
  });

  it('should treat an invalid JSON string as a simple message', () => {
    const line = '{"level": "info", "message": "This is broken JSON';
    const source = '/var/log/malformed.log';

    const result = parseAndEnrich(line, source);

    assert.strictEqual(typeof result, 'object', 'Result should be an object');
    assert.ok(result.id && UUID_V4_REGEX.test(result.id), 'Result should have a valid UUID v4 id');
    assert.strictEqual(result.source, source, 'Result should have the correct source');
    assert.strictEqual(result.raw, line, 'Result should contain the original raw line');
    assert.strictEqual(result.message, line, 'Result should treat the entire invalid JSON string as the message');
    assert.strictEqual(result.level, undefined, 'Should not have properties from the attempted parse');
  });

  it('should handle JSON that is not an object (e.g., a string, number, null)', () => {
    const source = 'test-source';

    // Test with a JSON string literal
    const stringLine = '"just a string"';
    const stringResult = parseAndEnrich(stringLine, source);
    assert.strictEqual(stringResult.message, stringLine, 'JSON string literal should be treated as a raw message');
    assert.strictEqual(stringResult.raw, stringLine);

    // Test with a JSON number literal
    const numberLine = '12345';
    const numberResult = parseAndEnrich(numberLine, source);
    assert.strictEqual(numberResult.message, numberLine, 'JSON number literal should be treated as a raw message');
    assert.strictEqual(numberResult.raw, numberLine);

    // Test with JSON null literal
    const nullLine = 'null';
    const nullResult = parseAndEnrich(nullLine, source);
    assert.strictEqual(nullResult.message, nullLine, 'JSON null literal should be treated as a raw message');
    assert.strictEqual(nullResult.raw, nullLine);
  });

  it('should handle an empty string line', () => {
    const line = '';
    const source = 'empty-source';

    const result = parseAndEnrich(line, source);

    assert.ok(result.id, 'Result should still get an id');
    assert.ok(result.timestamp, 'Result should still get a timestamp');
    assert.strictEqual(result.source, source, 'Result should have the correct source');
    assert.strictEqual(result.raw, '', 'Raw property should be an empty string');
    assert.strictEqual(result.message, '', 'Message property should be an empty string');
  });

  it('should use a different timestamp and ID for each invocation', (context, done) => {
    const line = 'test line';
    const source = 'test-source';

    const result1 = parseAndEnrich(line, source);

    // Wait a moment to ensure the timestamp can change
    setTimeout(() => {
      const result2 = parseAndEnrich(line, source);

      assert.notStrictEqual(result1.id, result2.id, 'Each log entry should have a unique ID');
      assert.notStrictEqual(result1.timestamp, result2.timestamp, 'Each log entry should have a unique timestamp');
      done();
    }, 10);
  });

  it('should correctly handle a source identifier with special characters', () => {
    const line = 'Log from a weird source.';
    const source = 'C:\\Users\\Test User\\logs\\app.log';

    const result = parseAndEnrich(line, source);

    assert.strictEqual(result.source, source, 'Should correctly store a source with backslashes and spaces');
  });

  it('should mock UUID and Date to test for predictable output', () => {
    const fixedDate = new Date('2023-01-01T00:00:00.000Z');
    const fixedUUID = '123e4567-e89b-42d3-a456-426614174000';
    const line = 'A predictable log';
    const source = 'predictable-source';

    mock.patch(global, 'Date', function() { return fixedDate; });
    const uuidModule = { v4: () => fixedUUID };
    mock.module('uuid', { get: () => uuidModule });

    // We need to re-import the module under test after mocking its dependencies.
    // Node's test runner doesn't have a built-in `reimport` yet, so this is a conceptual placeholder.
    // In a real-world scenario with Jest/Vitest, you'd use `jest.resetModules()` or similar.
    // For node:test, we can test the structure without re-importing if we accept the original imports are cached.
    // The core logic is what we are testing. Let's re-test with a fresh call.
    const { parseAndEnrich: reloadedParseAndEnrich } = require('../src/utils/log-parser.js'); // Using require for re-evaluation

    const result = reloadedParseAndEnrich(line, source);

    assert.deepStrictEqual(result, {
      id: fixedUUID,
      timestamp: fixedDate.toISOString(),
      source: source,
      raw: line,
      message: line,
    });

    // It's crucial to restore mocks after the test.
    mock.reset();
  });
});