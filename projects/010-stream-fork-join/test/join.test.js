/**
 * @file test/join.test.js
 * @description Tests for the join functionality, ensuring it waits for all forks and aggregates results correctly.
 *
 * This test suite covers the `join()` factory function and the underlying `JoinAggregator`
 * class. It validates that the join stream correctly waits for all forked streams to
 * complete, aggregates their results, and handles various scenarios including object mode,
 * error propagation, and stream destruction.
 */

import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { Readable, Writable, Transform, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { join } from '../src/index.js';
import { JoinAggregator } from '../src/core/join-aggregator.js';
import { ForkMultiplexer } from '../src/core/fork-multiplexer.js';
import { FORK_EVENTS } from '../src/utils/constants.js';
import { pEvent } from 'p-event';
import { setTimeout as sleep } from 'node:timers/promises';

const pipelineAsync = promisify(pipeline);

// --- Helper Functions and Streams ---

/**
 * A simple Transform stream that appends a suffix to each chunk.
 * @extends Transform
 */
class SuffixTransform extends Transform {
  #suffix;

  constructor(suffix, options = {}) {
    super(options);
    this.#suffix = suffix;
  }

  _transform(chunk, encoding, callback) {
    if (this.writableObjectMode) {
      chunk.transformedBy = this.#suffix;
      this.push(chunk);
    } else {
      this.push(`${chunk.toString()}${this.#suffix}`);
    }
    callback();
  }
}

/**
 * A Transform stream that introduces a delay before passing data through.
 * @extends Transform
 */
class DelayTransform extends Transform {
  #delay;

  constructor(delay, options = {}) {
    super(options);
    this.#delay = delay;
  }

  _transform(chunk, encoding, callback) {
    setTimeout(() => {
      this.push(chunk);
      callback();
    }, this.#delay);
  }
}

/**
 * A simple PassThrough stream that emits a value on 'finish'.
 * This is used to test the data aggregation feature of the JoinAggregator.
 * @extends Transform
 */
class FinishingTransform extends Transform {
  #finishData;
  #multiplexer;
  #forkId;

  constructor(finishData, multiplexer, forkId, options = {}) {
    super(options);
    this.#finishData = finishData;
    this.#multiplexer = multiplexer;
    this.#forkId = forkId;

    this.on('finish', () => {
      // Manually emit the FORK_FINISHED event with data, simulating a real fork's behavior.
      // This is necessary because the event is emitted by the ForkMultiplexer,
      // but we need to control the data payload for this test.
      this.#multiplexer.emit(FORK_EVENTS.FORK_FINISHED, this.#forkId, this.#finishData);
    });
  }

  _transform(chunk, encoding, callback) {
    // We don't need to push any data for this test, just consume it.
    callback();
  }
}

/**
 * Consumes a readable stream and returns all its chunks as an array.
 * @param {Readable} readableStream - The stream to consume.
 * @returns {Promise<Array<any>>} A promise that resolves with an array of chunks.
 */
async function consumeStream(readableStream) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(chunk);
  }
  return chunks;
}

// --- Test Suite ---

describe('join() and JoinAggregator', () => {
  describe('Input Validation', () => {
    it('should throw TypeError if source is not a valid Readable stream', () => {
      assert.throws(() => join('not-a-stream', [new Transform()]), {
        name: 'TypeError',
        message: 'The "source" argument must be a valid Readable stream.',
      });
      assert.throws(() => join(new Writable(), [new Transform()]), {
        name: 'TypeError',
        message: 'The "source" argument must be a valid Readable stream.',
      });
    });

    it('should throw TypeError if forks is not a non-empty array', () => {
      assert.throws(() => join(Readable.from([]), 'not-an-array'), {
        name: 'TypeError',
        message: 'The "forks" argument must be a non-empty array of Duplex/Transform streams.',
      });
      assert.throws(() => join(Readable.from([]), []), {
        name: 'TypeError',
        message: 'The "forks" argument must be a non-empty array of Duplex/Transform streams.',
      });
    });

    it('should throw TypeError if any fork is not a valid stream', () => {
      assert.throws(() => join(Readable.from([]), [new Transform(), { not: 'a stream' }]), {
        name: 'TypeError',
        message: 'All items in the "forks" array must be valid streams.',
      });
    });

    it('should throw TypeError if JoinAggregator is constructed without a multiplexer', () => {
      assert.throws(() => new JoinAggregator(null, 2), {
        name: 'TypeError',
        message: 'JoinAggregator requires a valid ForkMultiplexer instance.',
      });
    });

    it('should throw TypeError if JoinAggregator is constructed with invalid forkCount', () => {
      const multiplexer = new ForkMultiplexer([new Writable({ write: (c, e, cb) => cb() })]);
      assert.throws(() => new JoinAggregator(multiplexer, -1), {
        name: 'TypeError',
        message: 'JoinAggregator requires a non-negative number for forkCount.',
      });
      assert.throws(() => new JoinAggregator(multiplexer, 'two'), {
        name: 'TypeError',
        message: 'JoinAggregator requires a non-negative number for forkCount.',
      });
    });
  });

  describe('Core Functionality (Buffer Mode)', () => {
    it('should join results from multiple transform forks', async () => {
      const source = Readable.from(['a', 'b', 'c']);
      const forkA = new SuffixTransform('-A');
      const forkB = new SuffixTransform('-B');

      const joinedStream = join(source, [forkA, forkB]);
      const results = await consumeStream(joinedStream);

      // The order is non-deterministic, so we sort for comparison.
      results.sort();

      const expected = ['a-A', 'a-B', 'b-A', 'b-B', 'c-A', 'c-B'];
      expected.sort();

      assert.deepStrictEqual(results, expected, 'Joined stream should contain results from all forks');
    });

    it('should wait for slower forks to complete before ending', async () => {
      const source = Readable.from(['data']);
      const fastFork = new SuffixTransform('-fast');
      const slowFork = new Transform({
        transform(chunk, enc, cb) {
          setTimeout(() => {
            cb(null, `${chunk.toString()}-slow`);
          }, 50);
        },
      });

      const joinedStream = join(source, [fastFork, slowFork]);
      const startTime = Date.now();
      const results = await consumeStream(joinedStream);
      const duration = Date.now() - startTime;

      assert.ok(duration >= 50, 'Pipeline should take at least as long as the slowest fork');
      assert.strictEqual(results.length, 2, 'Should receive results from both forks');
      assert.ok(results.includes('data-fast'), 'Should include result from fast fork');
      assert.ok(results.includes('data-slow'), 'Should include result from slow fork');
    });

    it('should handle an empty source stream gracefully', async () => {
      const source = Readable.from([]);
      const forkA = new SuffixTransform('-A');
      const forkB = new SuffixTransform('-B');

      const joinedStream = join(source, [forkA, forkB]);
      const results = await consumeStream(joinedStream);

      assert.strictEqual(results.length, 0, 'Joined stream should be empty for an empty source');
    });
  });

  describe('Core Functionality (Object Mode)', () => {
    it('should join results from multiple object mode transforms', async () => {
      const sourceData = [{ val: 1 }, { val: 2 }];
      const source = Readable.from(sourceData, { objectMode: true });

      const forkA = new SuffixTransform('A', { objectMode: true });
      const forkB = new SuffixTransform('B', { objectMode: true });

      const joinedStream = join(source, [forkA, forkB], { objectMode: true });
      const results = await consumeStream(joinedStream);

      assert.strictEqual(results.length, 4, 'Should receive 2 results from each of the 2 forks');
      const resultsFromA = results.filter(r => r.transformedBy === 'A');
      const resultsFromB = results.filter(r => r.transformedBy === 'B');

      assert.strictEqual(resultsFromA.length, 2, 'Should have two results from fork A');
      assert.strictEqual(resultsFromB.length, 2, 'Should have two results from fork B');
      assert.deepStrictEqual(resultsFromA.map(r => r.val), [1, 2]);
    });

    it('should infer objectMode from the source stream', async () => {
      const source = Readable.from([{ val: 1 }], { objectMode: true });
      const forkA = new Transform({ objectMode: true, transform: (c, e, cb) => cb(null, c) });

      // No options passed to join(), it should detect from `source.readableObjectMode`
      const joinedStream = join(source, [forkA]);
      assert.strictEqual(joinedStream.readableObjectMode, true, 'Joined stream should be in object mode');

      const results = await consumeStream(joinedStream);
      assert.deepStrictEqual(results, [{ val: 1 }]);
    });
  });

  describe('Error Handling', () => {
    const testError = new Error('Simulated transform error');

    it('should destroy the join stream if a fork emits an error (abortOnError: true)', async () => {
      const source = Readable.from(['ok', 'fail', 'more']);
      const healthyFork = new SuffixTransform('-A');
      const faultyFork = new Transform({
        transform(chunk, enc, cb) {
          chunk.toString() === 'fail' ? cb(testError) : cb(null, chunk);
        },
      });

      const joinedStream = join(source, [healthyFork, faultyFork]);

      await assert.rejects(
        consumeStream(joinedStream),
        testError,
        'Consuming the joined stream should reject with the fork error'
      );
    });

    it('should destroy the join stream if the source stream errors', async () => {
      const sourceError = new Error('Source stream failed');
      const source = new Readable({
        read() {
          this.destroy(sourceError);
        },
      });
      const forkA = new SuffixTransform('-A');

      const joinedStream = join(source, [forkA]);

      await assert.rejects(
        consumeStream(joinedStream),
        sourceError,
        'Joined stream should fail if the source fails'
      );
    });

    it('should not destroy other forks if abortOnError is false, but join stream still errors', async () => {
      const source = Readable.from(['ok', 'fail', 'more']);
      const healthyFork = new SuffixTransform('-A');
      const faultyFork = new Transform({
        transform(chunk, enc, cb) {
          chunk.toString() === 'fail' ? cb(testError) : cb(null, chunk);
        },
      });

      const joinedStream = join(source, [healthyFork, faultyFork], { abortOnError: false });

      // The error from the faulty fork will still destroy the aggregator,
      // propagating the error to the consumer. The `abortOnError: false` option
      // primarily affects whether sibling forks are destroyed, not whether the
      // overall pipeline reports the error.
      await assert.rejects(
        consumeStream(joinedStream),
        testError,
        'Joined stream should still reject even with abortOnError: false'
      );
    });
  });

  describe('JoinAggregator Data Collection', () => {
    it('should collect and push data provided on FORK_FINISHED event', async () => {
      const source = Readable.from(['data']);
      const multiplexer = new ForkMultiplexer([new Writable(), new Writable()]);
      const forkIds = Array.from(multiplexer._ForkMultiplexer__targets.keys());

      // We use special transforms that emit data on 'finish' via the multiplexer
      const forkA = new FinishingTransform({ result: 'A' }, multiplexer, forkIds[0]);
      const forkB = new FinishingTransform({ result: 'B' }, multiplexer, forkIds[1]);

      // Manually replace the multiplexer's targets to use our special transforms
      multiplexer._ForkMultiplexer__targets.clear();
      multiplexer.addTarget(forkA);
      multiplexer.addTarget(forkB);
      const newForkIds = Array.from(multiplexer._ForkMultiplexer__targets.keys());
      forkA._FinishingTransform__forkId = newForkIds[0];
      forkB._FinishingTransform__forkId = newForkIds[1];

      const aggregator = new JoinAggregator(multiplexer, 2, { objectMode: true });

      // Manually run the pipeline
      await pipelineAsync(source, multiplexer);
      const results = await consumeStream(aggregator);

      assert.strictEqual(results.length, 2, 'Should have collected results from both forks');
      const receivedResults = results.map(r => r.result).sort();
      assert.deepStrictEqual(receivedResults, ['A', 'B']);
    });

    it('should filter out `undefined` results from finished forks', async () => {
      const source = Readable.from(['data']);
      const multiplexer = new ForkMultiplexer([new Writable(), new Writable()]);
      const forkIds = Array.from(multiplexer._ForkMultiplexer__targets.keys());

      const forkA = new FinishingTransform({ result: 'A' }, multiplexer, forkIds[0]);
      const forkB = new FinishingTransform(undefined, multiplexer, forkIds[1]); // This one returns undefined

      multiplexer._ForkMultiplexer__targets.clear();
      multiplexer.addTarget(forkA);
      multiplexer.addTarget(forkB);
      const newForkIds = Array.from(multiplexer._ForkMultiplexer__targets.keys());
      forkA._FinishingTransform__forkId = newForkIds[0];
      forkB._FinishingTransform__forkId = newForkIds[1];

      const aggregator = new JoinAggregator(multiplexer, 2, { objectMode: true });

      await pipelineAsync(source, multiplexer);
      const results = await consumeStream(aggregator);

      assert.strictEqual(results.length, 1, 'Should only contain the non-undefined result');
      assert.deepStrictEqual(results[0], { result: 'A' });
    });
  });

  describe('Lifecycle and Cleanup', () => {
    it('should clean up multiplexer listeners when the aggregator is destroyed', async () => {
      const source = Readable.from(['data']);
      const forkA = new Transform({ transform: (c, e, cb) => cb(null, c) });
      const joinedStream = join(source, [forkA]);

      const multiplexer = joinedStream._JoinAggregator__multiplexer;
      const spy = mock.method(multiplexer, 'removeListener');

      joinedStream.destroy();
      await pEvent(joinedStream, 'close');

      const finishCall = spy.mock.calls.find(c => c.arguments[0] === FORK_EVENTS.FORK_FINISHED);
      const errorCall = spy.mock.calls.find(c => c.arguments[0] === FORK_EVENTS.FORK_ERROR);

      assert.ok(finishCall, 'Should have removed FORK_FINISHED listener');
      assert.ok(errorCall, 'Should have removed FORK_ERROR listener');
      assert.strictEqual(joinedStream._JoinAggregator__multiplexer, null, 'Multiplexer reference should be cleared');
    });

    it('should clean up listeners when the stream finishes successfully', async () => {
      const source = Readable.from(['data']);
      const forkA = new Transform({ transform: (c, e, cb) => cb(null, c) });
      const joinedStream = join(source, [forkA]);

      const multiplexer = joinedStream._JoinAggregator__multiplexer;
      const spy = mock.method(multiplexer, 'removeListener');

      await consumeStream(joinedStream); // This will finish the stream

      const finishCall = spy.mock.calls.find(c => c.arguments[0] === FORK_EVENTS.FORK_FINISHED);
      const errorCall = spy.mock.calls.find(c => c.arguments[0] === FORK_EVENTS.FORK_ERROR);

      assert.ok(finishCall, 'Should have removed FORK_FINISHED listener on completion');
      assert.ok(errorCall, 'Should have removed FORK_ERROR listener on completion');
      assert.strictEqual(joinedStream._JoinAggregator__multiplexer, null, 'Multiplexer reference should be cleared on completion');
    });
  });
});