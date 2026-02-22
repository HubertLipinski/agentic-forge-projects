/**
 * @file test/fork.test.js
 * @description Unit and integration tests for the forking functionality.
 *
 * This test suite covers the `fork()` factory function and the underlying `ForkMultiplexer`
 * class. It validates core functionality including data integrity, backpressure handling,
 * error propagation, and behavior in both standard and object modes.
 */

import { test, describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { Readable, Writable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { fork } from '../src/index.js';
import { ForkMultiplexer } from '../src/core/fork-multiplexer.js';
import { pEvent } from 'p-event';
import { setTimeout as sleep } from 'node:timers/promises';

const pipelineAsync = promisify(pipeline);

// --- Helper Streams for Testing ---

/**
 * A simple Writable stream that collects all written chunks into an array.
 * @extends Writable
 */
class MemoryWriter extends Writable {
  chunks = [];

  constructor(options = {}) {
    super(options);
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    callback();
  }

  /**
   * Returns the collected data as a single string (for buffer streams).
   * @returns {string}
   */
  getDataAsString() {
    return Buffer.concat(this.chunks).toString();
  }
}

/**
 * A Writable stream that simulates backpressure.
 * @extends Writable
 */
class SlowWriter extends Writable {
  chunks = [];
  #delay;

  constructor(delay = 50, options = {}) {
    // Set a low highWaterMark to trigger backpressure quickly
    super({ highWaterMark: options.objectMode ? 1 : 16, ...options });
    this.#delay = delay;
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    setTimeout(callback, this.#delay);
  }
}

// --- Test Suite ---

describe('fork() and ForkMultiplexer', () => {
  describe('Input Validation', () => {
    it('should throw TypeError if targets is not an array', () => {
      assert.throws(() => fork('not-an-array'), {
        name: 'TypeError',
        message: 'The "targets" argument must be a non-empty array of Writable streams.',
      });
    });

    it('should throw TypeError if targets array is empty', () => {
      assert.throws(() => fork([]), {
        name: 'TypeError',
        message: 'The "targets" argument must be a non-empty array of Writable streams.',
      });
    });

    it('should throw TypeError if any target is not a valid stream', () => {
      const validStream = new Writable({ write(c, e, cb) { cb(); } });
      assert.throws(() => fork([validStream, { not: 'a stream' }]), {
        name: 'TypeError',
        message: 'All items in the "targets" array must be valid streams.',
      });
    });

    it('should throw TypeError if ForkMultiplexer is constructed with invalid targets', () => {
      assert.throws(() => new ForkMultiplexer(['not-a-stream']), {
        name: 'TypeError',
        message: 'All targets must be valid Writable streams.',
      });
    });
  });

  describe('Core Functionality (Buffer Mode)', () => {
    it('should fork a readable stream to multiple writable targets', async () => {
      const sourceData = ['chunk1', 'chunk2', 'chunk3'];
      const source = Readable.from(sourceData);

      const targetA = new MemoryWriter();
      const targetB = new MemoryWriter();
      const multiplexer = fork([targetA, targetB]);

      await pipelineAsync(source, multiplexer);

      const expected = sourceData.join('');
      assert.strictEqual(targetA.getDataAsString(), expected, 'Target A should receive all data');
      assert.strictEqual(targetB.getDataAsString(), expected, 'Target B should receive all data');
    });

    it('should handle an empty source stream gracefully', async () => {
      const source = Readable.from([]);
      const targetA = new MemoryWriter();
      const targetB = new MemoryWriter();
      const multiplexer = fork([targetA, targetB]);

      await pipelineAsync(source, multiplexer);

      assert.strictEqual(targetA.chunks.length, 0, 'Target A should be empty');
      assert.strictEqual(targetB.chunks.length, 0, 'Target B should be empty');
    });
  });

  describe('Core Functionality (Object Mode)', () => {
    it('should fork an object stream and clone objects for each target', async () => {
      const sourceData = [{ a: 1 }, { b: 2 }];
      const source = Readable.from(sourceData, { objectMode: true });

      const targetA = new MemoryWriter({ objectMode: true });
      const targetB = new MemoryWriter({ objectMode: true });
      const multiplexer = fork([targetA, targetB], { objectMode: true });

      await pipelineAsync(source, multiplexer);

      assert.deepStrictEqual(targetA.chunks, sourceData, 'Target A should receive all objects');
      assert.deepStrictEqual(targetB.chunks, sourceData, 'Target B should receive all objects');

      // Verify that objects are cloned (not the same reference)
      assert.notStrictEqual(targetA.chunks[0], targetB.chunks[0], 'Objects in targets should be clones');
      assert.notStrictEqual(targetA.chunks[0], sourceData[0], 'Object in target A should be a clone of source');
    });
  });

  describe('Backpressure Handling', () => {
    it('should propagate backpressure from the slowest fork', async () => {
      const sourceData = Array.from({ length: 10 }, (_, i) => `item-${i}`);
      const source = Readable.from(sourceData);

      const fastTarget = new MemoryWriter();
      const slowTarget = new SlowWriter(20); // 20ms delay per write
      const multiplexer = fork([fastTarget, slowTarget]);

      const writeSpy = mock.method(multiplexer, '_write');

      const pipelinePromise = pipelineAsync(source, multiplexer);

      // Give the stream time to start and hit backpressure
      await sleep(50);

      // The multiplexer's _write should be called, but the callback should be held
      // due to the slow stream not draining.
      const calls = writeSpy.mock.calls;
      assert.ok(calls.length > 0, '_write should have been called');

      // Check if the drain callback was queued, indicating backpressure
      const lastCall = calls[calls.length - 1];
      const callback = lastCall.arguments[2];
      const cbSpy = mock.fn(callback);
      cbSpy();
      assert.strictEqual(cbSpy.mock.callCount(), 1, 'Callback should be held by backpressure logic');

      await pipelinePromise;

      assert.strictEqual(fastTarget.getDataAsString(), sourceData.join(''), 'Fast target should get all data');
      assert.strictEqual(slowTarget.chunks.join(''), sourceData.join(''), 'Slow target should get all data');
    });

    it('should emit "drain" only when all targets have drained', async () => {
      const source = new Readable({
        read() { /* controlled by push */ }
      });

      const targetA = new SlowWriter(10, { highWaterMark: 1 });
      const targetB = new SlowWriter(30, { highWaterMark: 1 });
      const multiplexer = fork([targetA, targetB]);

      // Pipe but don't end
      source.pipe(multiplexer);

      // Push data to trigger backpressure
      const write1 = source.push('a');
      const write2 = source.push('b');

      assert.strictEqual(write1, true, 'First write should be accepted');
      assert.strictEqual(write2, false, 'Second write should apply backpressure');

      // Wait for the multiplexer to drain
      await pEvent(multiplexer, 'drain');

      // At this point, both slow writers must have processed their chunk
      assert.strictEqual(targetA.chunks.length, 2, 'Target A should have processed chunks by drain time');
      assert.strictEqual(targetB.chunks.length, 2, 'Target B should have processed chunks by drain time');

      // Push more data
      const write3 = source.push('c');
      assert.strictEqual(write3, true, 'Write after drain should be accepted');

      source.push(null); // End the stream
      await pEvent(multiplexer, 'finish');
    });
  });

  describe('Error Handling', () => {
    const testError = new Error('Simulated write error');

    it('should destroy all forks on error by default (abortOnError: true)', async () => {
      const source = Readable.from(['ok', 'ok', 'fail', 'more']);
      const healthyTarget = new MemoryWriter();
      const faultyTarget = new Writable({
        write(chunk, enc, cb) {
          chunk.toString() === 'fail' ? cb(testError) : cb();
        },
      });

      const multiplexer = fork([healthyTarget, faultyTarget]); // abortOnError is true by default

      const healthyDestroySpy = mock.method(healthyTarget, 'destroy');

      await assert.rejects(
        pipelineAsync(source, multiplexer),
        testError,
        'Pipeline should reject with the target error'
      );

      assert.strictEqual(healthyDestroySpy.mock.callCount(), 1, 'Healthy target should be destroyed');
      const destroyCall = healthyDestroySpy.mock.calls[0];
      assert.deepStrictEqual(destroyCall.arguments[0], testError, 'Healthy target should be destroyed with the original error');
    });

    it('should not destroy other forks on error if abortOnError is false', async () => {
      const sourceData = ['ok1', 'ok2', 'fail', 'ok3', 'ok4'];
      const source = Readable.from(sourceData);

      const healthyTarget = new MemoryWriter();
      const faultyTarget = new Writable({
        write(chunk, enc, cb) {
          if (chunk.toString() === 'fail') {
            process.nextTick(() => cb(testError));
          } else {
            cb();
          }
        },
      });

      const multiplexer = fork([healthyTarget, faultyTarget], { abortOnError: false });
      const healthyDestroySpy = mock.method(healthyTarget, 'destroy');

      // With abortOnError: false, the pipeline itself doesn't fail,
      // but the multiplexer will emit the error. The faulty stream is destroyed.
      const errorPromise = pEvent(multiplexer, 'error');

      await pipelineAsync(source, multiplexer);

      await assert.rejects(errorPromise, testError, 'Multiplexer should emit the error');

      assert.strictEqual(healthyDestroySpy.mock.callCount(), 0, 'Healthy target should not be destroyed');

      // Because the pipeline continues, the healthy target should receive all data.
      assert.strictEqual(healthyTarget.getDataAsString(), sourceData.join(''), 'Healthy target should receive all data');
    });

    it('should destroy all targets if the multiplexer is destroyed externally', async () => {
      const source = new Readable({ read() {} }); // A stream that never ends
      const targetA = new MemoryWriter();
      const targetB = new MemoryWriter();
      const multiplexer = fork([targetA, targetB]);

      const destroySpyA = mock.method(targetA, 'destroy');
      const destroySpyB = mock.method(targetB, 'destroy');

      source.pipe(multiplexer);

      const destructionError = new Error('External destruction');
      multiplexer.destroy(destructionError);

      await Promise.all([
        pEvent(targetA, 'close'),
        pEvent(targetB, 'close'),
      ]);

      assert.strictEqual(destroySpyA.mock.callCount(), 1, 'Target A should be destroyed');
      assert.strictEqual(destroySpyB.mock.callCount(), 1, 'Target B should be destroyed');
      assert.deepStrictEqual(destroySpyA.mock.calls[0].arguments[0], destructionError, 'Target A destroyed with correct error');
      assert.deepStrictEqual(destroySpyB.mock.calls[0].arguments[0], destructionError, 'Target B destroyed with correct error');
    });
  });

  describe('Stream Lifecycle', () => {
    it('should finish when the source stream finishes', async () => {
      const source = Readable.from(['a', 'b']);
      const target = new MemoryWriter();
      const multiplexer = fork([target]);

      const finishPromise = pEvent(multiplexer, 'finish');
      await pipelineAsync(source, multiplexer);

      // The finishPromise should resolve, if not the test will time out.
      await finishPromise;
      assert.ok(true, 'Multiplexer emitted "finish"');
    });

    it('should end all target streams when the source ends', async () => {
      const source = Readable.from(['a', 'b']);
      const targetA = new MemoryWriter();
      const targetB = new MemoryWriter();
      const multiplexer = fork([targetA, targetB]);

      const finishA = pEvent(targetA, 'finish');
      const finishB = pEvent(targetB, 'finish');

      await pipelineAsync(source, multiplexer);

      await Promise.all([finishA, finishB]);
      assert.ok(true, 'Both target streams emitted "finish"');
    });

    it('should handle one of the forks being destroyed prematurely', async () => {
      const sourceData = ['a', 'b', 'c', 'd'];
      const source = Readable.from(sourceData);
      const targetA = new MemoryWriter();
      const targetB = new MemoryWriter();

      // Destroy targetB after the first write
      const originalWrite = targetB._write.bind(targetB);
      mock.method(targetB, '_write', (chunk, enc, cb) => {
        originalWrite(chunk, enc, () => {}); // Don't call cb to simulate being stuck
        targetB.destroy();
        cb();
      }, { times: 1 });

      const multiplexer = fork([targetA, targetB], { abortOnError: false });

      await pipelineAsync(source, multiplexer);

      assert.strictEqual(targetA.getDataAsString(), sourceData.join(''), 'Healthy target should receive all data');
      assert.strictEqual(targetB.getDataAsString(), 'a', 'Destroyed target should only receive data before destruction');
    });
  });
});