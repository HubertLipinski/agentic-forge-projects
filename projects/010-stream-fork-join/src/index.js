/**
 * @file src/index.js
 * @description Main entry point for the stream-fork-join library.
 *
 * This file exports the primary factory functions `fork()` and `join()`, which serve as the
 * public API for creating and managing stream forking and joining pipelines. These functions
 * abstract away the underlying `ForkMultiplexer` and `JoinAggregator` classes, providing a
 * clean and intuitive interface for the user.
 */

import { stream } from 'node:stream';
import { ForkMultiplexer } from './core/fork-multiplexer.js';
import { JoinAggregator } from './core/join-aggregator.js';
import { DEFAULT_OPTIONS } from './utils/constants.js';

/**
 * Validates that a given value is a valid Node.js stream.
 * A valid stream is an object with a `pipe` method. This is a duck-typing approach
 * that works for Readable, Writable, Duplex, and Transform streams.
 *
 * @param {any} s - The value to validate.
 * @returns {boolean} - True if the value is a valid stream, false otherwise.
 * @private
 */
function isValidStream(s) {
  return s !== null && typeof s === 'object' && typeof s.pipe === 'function';
}

/**
 * Creates a `ForkMultiplexer` instance, which is a Writable stream that forks a single
 * readable stream into multiple writable stream targets. It manages backpressure from
 * the slowest target and propagates it back to the source.
 *
 * @example
 * import { fork } from 'stream-fork-join';
 * import { createReadStream, createWriteStream } from 'node:fs';
 *
 * const source = createReadStream('source.txt');
 * const targetA = createWriteStream('a.log');
 * const targetB = createWriteStream('b.log');
 *
 * const multiplexer = fork([targetA, targetB]);
 * source.pipe(multiplexer);
 *
 * @param {Array<import('node:stream').Writable>} targets - An array of Writable streams to which the source data will be written.
 * @param {object} [options={}] - Configuration options.
 * @param {boolean} [options.objectMode=false] - Set to true if the streams are operating in object mode.
 * @param {boolean} [options.abortOnError=true] - If true, an error in one forked stream will destroy all others.
 * @param {number} [options.highWaterMark] - The buffer size for the multiplexer. Defaults to Node's stream default (16KB).
 * @returns {ForkMultiplexer} A Writable stream instance that acts as the fork point.
 * @throws {TypeError} If `targets` is not a non-empty array of valid streams.
 */
export function fork(targets, options = {}) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new TypeError('The "targets" argument must be a non-empty array of Writable streams.');
  }

  if (!targets.every(isValidStream)) {
    throw new TypeError('All items in the "targets" array must be valid streams.');
  }

  const finalOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  return new ForkMultiplexer(targets, finalOptions);
}

/**
 * Creates a complete fork-join pipeline. It takes a source Readable stream, forks it to
 * multiple processing streams (Duplex/Transform), and then joins the results back into a
 * single Readable stream.
 *
 * This function orchestrates the creation of the `ForkMultiplexer` and `JoinAggregator`
 * and wires them together. The source stream is automatically piped to the multiplexer.
 *
 * @example
 * import { join } from 'stream-fork-join';
 * import { Readable, Transform } from 'node:stream';
 *
 * const source = Readable.from([{ value: 1 }, { value: 2 }]);
 *
 * const transformA = new Transform({
 *   objectMode: true,
 *   transform(chunk, enc, cb) { cb(null, { a: chunk.value * 2 }); }
 * });
 *
 * const transformB = new Transform({
 *   objectMode: true,
 *   transform(chunk, enc, cb) { cb(null, { b: chunk.value + 10 }); }
 * });
 *
 * const joinedStream = join(source, [transformA, transformB], { objectMode: true });
 *
 * for await (const data of joinedStream) {
 *   console.log(data); // -> { a: 2 }, { b: 11 }, { a: 4 }, { b: 12 } (order not guaranteed)
 * }
 *
 * @param {import('node:stream').Readable} source - The source Readable stream to be forked.
 * @param {Array<import('node:stream').Duplex | import('node:stream').Transform>} forks - An array of Duplex or Transform streams that will process the data in parallel.
 * @param {object} [options={}] - Configuration options for the pipeline.
 * @param {boolean} [options.objectMode=false] - Set to true if the streams are in object mode.
 * @param {boolean} [options.abortOnError=true] - If true, an error in one fork destroys the entire pipeline.
 * @param {number} [options.highWaterMark] - Buffer size for internal streams.
 * @returns {JoinAggregator} A Readable stream that will emit the aggregated results from all forks.
 * @throws {TypeError} If `source` is not a valid Readable stream or `forks` is not a non-empty array of valid streams.
 */
export function join(source, forks, options = {}) {
  if (!isValidStream(source) || typeof source.read !== 'function') {
    throw new TypeError('The "source" argument must be a valid Readable stream.');
  }

  if (!Array.isArray(forks) || forks.length === 0) {
    throw new TypeError('The "forks" argument must be a non-empty array of Duplex/Transform streams.');
  }

  if (!forks.every(isValidStream)) {
    throw new TypeError('All items in the "forks" array must be valid streams.');
  }

  const finalOptions = {
    ...DEFAULT_OPTIONS,
    // Infer objectMode from the source stream if not explicitly provided.
    objectMode: source.readableObjectMode,
    ...options,
  };

  const multiplexer = new ForkMultiplexer(forks, finalOptions);
  const aggregator = new JoinAggregator(multiplexer, forks.length, finalOptions);

  // When the source stream ends or errors, it should propagate through the pipeline.
  // Using stream.pipeline ensures proper cleanup and error forwarding.
  stream.pipeline(source, multiplexer, (err) => {
    if (err && !aggregator.destroyed) {
      // If the pipeline fails before the aggregator is set up (e.g., source error),
      // ensure the aggregator is destroyed to signal the error downstream.
      aggregator.destroy(err);
    }
  });

  // The aggregator listens to the multiplexer for fork completion events.
  // The multiplexer writes data to the individual fork streams.
  // The individual fork streams (Duplex/Transform) push their results,
  // which are then read by the aggregator's consumer.

  return aggregator;
}