/**
 * @file test/stream-router.integration.test.js
 * @description Integration tests for the main StreamRouter class.
 * These tests simulate real stream piping, data flow, rule evaluation,
 * backpressure handling, and error conditions in an integrated environment.
 */

import { test, describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Readable, Writable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { createStreamRouter } from '../index.js';
import { StreamProcessingError, ConfigurationError } from '../lib/utils/errors.js';

const pipelineAsync = promisify(pipeline);

/**
 * A helper Writable stream that collects all chunks written to it.
 * It also allows simulating slow consumption to test backpressure.
 */
class Collector extends Writable {
  constructor(options = {}) {
    super(options);
    this.chunks = [];
    this.writeDelay = options.writeDelay || 0;
    this.name = options.name || 'collector';
  }

  _write(chunk, encoding, callback) {
    // In objectMode, chunks are objects. In buffer mode, they are Buffers.
    // Convert buffers to string for easier assertion.
    const data = this._writableState.objectMode ? chunk : chunk.toString();
    this.chunks.push(data);

    if (this.writeDelay > 0) {
      setTimeout(callback, this.writeDelay);
    } else {
      callback();
    }
  }

  _final(callback) {
    this.emit('finished');
    callback();
  }

  reset() {
    this.chunks = [];
  }
}

describe('StreamRouter Integration Tests', () => {
  let source;
  let errorDest, warningDest, infoDest, defaultDest;

  beforeEach(() => {
    // Reset all destination streams before each test
    errorDest = new Collector({ name: 'errors' });
    warningDest = new Collector({ name: 'warnings' });
    infoDest = new Collector({ name: 'info' });
    defaultDest = new Collector({ name: 'default' });
  });

  afterEach(() => {
    // Ensure streams are destroyed to prevent memory leaks
    source?.destroy();
    errorDest.destroy();
    warningDest.destroy();
    infoDest.destroy();
    defaultDest.destroy();
  });

  describe('Regex Routing (Text Mode)', () => {
    const rules = [
      { name: 'error-rule', type: 'regex', expression: 'ERROR', destination: errorDest },
      { name: 'warning-rule', type: 'regex', expression: 'WARN', destination: warningDest },
      { name: 'info-rule', type: 'regex', expression: 'INFO', destination: infoDest },
    ];

    const logData = [
      'INFO: Application starting up\n',
      'WARN: Deprecated API used\n',
      'ERROR: Failed to connect to database\n',
      'INFO: User logged in\n',
      'DEBUG: Internal state value\n', // Should go to default or be dropped
      'FATAL: Unrecoverable error (matches ERROR rule)\n',
    ];

    it('should route text chunks to correct destinations based on regex rules', async () => {
      source = Readable.from(logData);
      const router = createStreamRouter({ rules });

      await pipelineAsync(source, router);

      assert.deepStrictEqual(errorDest.chunks, [
        'ERROR: Failed to connect to database\n',
        'FATAL: Unrecoverable error (matches ERROR rule)\n',
      ]);
      assert.deepStrictEqual(warningDest.chunks, ['WARN: Deprecated API used\n']);
      assert.deepStrictEqual(infoDest.chunks, ['INFO: Application starting up\n', 'INFO: User logged in\n']);
      assert.deepStrictEqual(defaultDest.chunks, [], 'Default destination should be empty');

      const metrics = router.getMetrics();
      assert.strictEqual(metrics.totalChunksProcessed, 6);
      assert.strictEqual(metrics.totalChunksDropped, 1, 'The DEBUG log should be dropped');
      assert.strictEqual(metrics.rules['error-rule'].matched, 2);
      assert.strictEqual(metrics.rules['warning-rule'].matched, 1);
      assert.strictEqual(metrics.rules['info-rule'].matched, 2);
    });

    it('should route unmatched chunks to a default destination if provided', async () => {
      source = Readable.from(logData);
      const router = createStreamRouter({ rules, defaultDestination: defaultDest });

      await pipelineAsync(source, router);

      assert.deepStrictEqual(defaultDest.chunks, ['DEBUG: Internal state value\n']);
      assert.strictEqual(router.getMetrics().totalChunksDropped, 0);
      assert.strictEqual(router.getMetrics().default.routed, 1);
    });

    it('should stop routing after first match if stopOnFirstMatch is true', async () => {
      const overlappingRules = [
        { name: 'error-or-warn', type: 'regex', expression: 'ERROR|WARN', destination: errorDest },
        { name: 'warn-only', type: 'regex', expression: 'WARN', destination: warningDest },
      ];
      source = Readable.from(['WARN: A test warning\n']);
      const router = createStreamRouter({ rules: overlappingRules, stopOnFirstMatch: true });

      await pipelineAsync(source, router);

      assert.deepStrictEqual(errorDest.chunks, ['WARN: A test warning\n']);
      assert.deepStrictEqual(warningDest.chunks, [], 'Second rule should not have been processed');
      assert.strictEqual(router.getMetrics().rules['error-or-warn'].matched, 1);
      assert.strictEqual(router.getMetrics().rules['warn-only'].matched, 0);
    });

    it('should route to multiple destinations if stopOnFirstMatch is false (default)', async () => {
        const overlappingRules = [
            { name: 'error-or-warn', type: 'regex', expression: 'ERROR|WARN', destination: errorDest },
            { name: 'warn-only', type: 'regex', expression: 'WARN', destination: warningDest },
        ];
        source = Readable.from(['WARN: A test warning\n']);
        const router = createStreamRouter({ rules: overlappingRules });

        await pipelineAsync(source, router);

        assert.deepStrictEqual(errorDest.chunks, ['WARN: A test warning\n']);
        assert.deepStrictEqual(warningDest.chunks, ['WARN: A test warning\n']);
        assert.strictEqual(router.getMetrics().rules['error-or-warn'].matched, 1);
        assert.strictEqual(router.getMetrics().rules['warn-only'].matched, 1);
    });
  });

  describe('JSONPath Routing (Object Mode)', () => {
    const rules = [
      { name: 'critical-temp', type: 'jsonpath', expression: '$.readings[?(@.type=="temp" && @.value > 90)]', destination: errorDest },
      { name: 'high-pressure', type: 'jsonpath', expression: '$.readings[?(@.type=="pressure" && @.value > 1000)]', destination: warningDest },
      { name: 'sensor-A', type: 'jsonpath', expression: '$[?(@.sensorId=="A")]', destination: infoDest },
    ];

    const telemetryData = [
      { sensorId: 'A', readings: [{ type: 'temp', value: 25 }] }, // info
      { sensorId: 'B', readings: [{ type: 'pressure', value: 950 }] }, // default
      { sensorId: 'C', readings: [{ type: 'temp', value: 95 }] }, // error
      { sensorId: 'A', readings: [{ type: 'pressure', value: 1100 }] }, // info + warning
    ];

    it('should route object chunks to correct destinations based on JSONPath rules', async () => {
      source = Readable.from(telemetryData);
      const router = createStreamRouter({ rules, objectMode: true, defaultDestination: defaultDest });

      await pipelineAsync(source, router);

      assert.deepStrictEqual(errorDest.chunks, [telemetryData[2]]);
      assert.deepStrictEqual(warningDest.chunks, [telemetryData[3]]);
      assert.deepStrictEqual(infoDest.chunks, [telemetryData[0], telemetryData[3]]);
      assert.deepStrictEqual(defaultDest.chunks, [telemetryData[1]]);

      const metrics = router.getMetrics();
      assert.strictEqual(metrics.totalChunksProcessed, 4);
      assert.strictEqual(metrics.totalChunksDropped, 0);
      assert.strictEqual(metrics.rules['critical-temp'].matched, 1);
      assert.strictEqual(metrics.rules['high-pressure'].matched, 1);
      assert.strictEqual(metrics.rules['sensor-A'].matched, 2);
      assert.strictEqual(metrics.default.routed, 1);
    });

    it('should pass through all data when passThrough is true', async () => {
        source = Readable.from([...telemetryData]); // Use a copy
        const passThroughDest = new Collector({ objectMode: true });
        const router = createStreamRouter({ rules, objectMode: true, passThrough: true });

        await pipelineAsync(source, router, passThroughDest);

        // Check routing still works
        assert.deepStrictEqual(errorDest.chunks, [telemetryData[2]]);
        assert.deepStrictEqual(infoDest.chunks, [telemetryData[0], telemetryData[3]]);

        // Check pass-through
        assert.deepStrictEqual(passThroughDest.chunks, telemetryData, 'All original chunks should be passed through');
    });
  });

  describe('Backpressure Handling', () => {
    it('should pause the source stream when a destination applies backpressure', async () => {
      // A slow destination that takes 50ms to process each chunk
      const slowDest = new Collector({ writeDelay: 50, name: 'slow' });
      const fastDest = new Collector({ name: 'fast' });

      const rules = [
        { name: 'all-to-slow', type: 'regex', expression: '.*', destination: slowDest },
        { name: 'all-to-fast', type: 'regex', expression: '.*', destination: fastDest },
      ];

      // A fast source that produces 10 items immediately
      const data = Array.from({ length: 10 }, (_, i) => `item-${i}`);
      source = Readable.from(data);

      const router = createStreamRouter({ rules });

      // We expect the pipeline to take at least 10 * 50ms = 500ms
      const startTime = Date.now();
      await pipelineAsync(source, router);
      const duration = Date.now() - startTime;

      assert.deepStrictEqual(slowDest.chunks.length, 10, 'Slow destination should receive all chunks');
      assert.deepStrictEqual(fastDest.chunks.length, 10, 'Fast destination should receive all chunks');
      assert.ok(duration >= 450, `Pipeline should be slowed by backpressure, took ${duration}ms`);
    });
  });

  describe('Error Handling', () => {
    it('should emit a StreamProcessingError if JSONPath evaluation fails on invalid JSON', async () => {
      const rules = [{ name: 'json-rule', type: 'jsonpath', expression: '$.key', destination: infoDest }];
      const invalidData = ['{"key": "valid"}', 'not-json', '{"key": "valid-again"}'];
      source = Readable.from(invalidData);
      const router = createStreamRouter({ rules, objectMode: true }); // objectMode allows strings

      let caughtError = null;
      try {
        await pipelineAsync(source, router);
      } catch (error) {
        caughtError = error;
      }

      assert.ok(caughtError, 'Pipeline should have thrown an error');
      assert.ok(caughtError instanceof StreamProcessingError, 'Error should be a StreamProcessingError');
      assert.strictEqual(caughtError.chunk, 'not-json', 'Error should reference the problematic chunk');
      assert.match(caughtError.message, /Failed to parse chunk as JSON/);

      // Verify that data before the error was processed correctly
      assert.deepStrictEqual(infoDest.chunks, [{ key: 'valid' }]);
    });

    it('should emit an error if a destination stream errors during write', async () => {
        const erroringDest = new Writable({
            write(chunk, encoding, callback) {
                // Error on the second chunk
                if (this.writableLength > 0) {
                    callback(new Error('Disk full!'));
                } else {
                    callback();
                }
            }
        });

        const rules = [{ name: 'all', type: 'regex', expression: '.*', destination: erroringDest }];
        source = Readable.from(['chunk1', 'chunk2', 'chunk3']);
        const router = createStreamRouter({ rules });

        let caughtError = null;
        try {
            await pipelineAsync(source, router);
        } catch (error) {
            caughtError = error;
        }

        assert.ok(caughtError, 'Pipeline should have thrown an error');
        assert.ok(caughtError instanceof StreamProcessingError, 'Error should be a StreamProcessingError');
        assert.match(caughtError.message, /Error writing to destination stream: Disk full!/);
        assert.strictEqual(caughtError.chunk.toString(), 'chunk2');
    });

    it('should throw ConfigurationError for invalid rules at construction', () => {
        const invalidRules = [{ name: 'bad', type: 'wrong-type', expression: '.*', destination: new Writable() }];
        assert.throws(
            () => createStreamRouter({ rules: invalidRules }),
            ConfigurationError, // RuleValidationError is wrapped by ConfigurationError in constructor
            'Should throw for invalid rule configuration'
        );
    });
  });
});