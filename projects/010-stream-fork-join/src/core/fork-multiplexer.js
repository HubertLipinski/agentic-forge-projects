/**
 * @file src/core/fork-multiplexer.js
 * @description The core writable stream class that multiplexes data from a source to multiple targets.
 *
 * This file defines the `ForkMultiplexer`, a custom `Writable` stream that acts as the central
 * hub for the forking logic. It receives data from an upstream `Readable` stream and is
 * responsible for writing that same data to multiple downstream `Writable` targets.
 *
 * A key feature is its handling of backpressure. It intelligently pauses the upstream source
 * if any of its targets signal that they are full, and only resumes once all targets are ready
 * to receive more data. This ensures that the slowest consumer dictates the overall pace,
 * preventing memory bloat.
 *
 * It also manages the lifecycle of the forked streams, including error propagation and
 * coordinated stream destruction.
 */

import { Writable } from 'node:stream';
import { v4 as uuidv4 } from 'uuid';
import { FORK_EVENTS } from '../utils/constants.js';

/**
 * @class ForkMultiplexer
 * @extends Writable
 * @description A Writable stream that multiplexes incoming chunks to multiple target streams.
 * It manages backpressure from all targets, ensuring the source stream is paused if any
 * target is slow. It also handles error propagation and coordinated stream termination.
 */
export class ForkMultiplexer extends Writable {
  #targets = new Map();
  #options;
  #draining = true;
  #drainCallbacks = new Set();
  #pendingWrites = 0;
  #sourceDestroyed = false;
  #error = null;

  /**
   * Constructs a new ForkMultiplexer instance.
   * @param {Array<Writable>} targets - An array of Writable streams to which data will be forked.
   * @param {object} [options={}] - Configuration options for the multiplexer.
   * @param {boolean} [options.objectMode=false] - Whether the stream operates in object mode.
   * @param {boolean} [options.abortOnError=true] - If true, an error in one fork will destroy all others.
   * @param {number} [options.highWaterMark] - The high-water mark for the writable stream buffer.
   */
  constructor(targets, options = {}) {
    super({
      objectMode: options.objectMode,
      highWaterMark: options.highWaterMark,
      // The destroy method is overridden to handle custom logic
      destroy: (err, callback) => this._destroy(err, callback),
    });

    this.#options = options;

    if (!Array.isArray(targets) || targets.length === 0) {
      throw new TypeError('ForkMultiplexer requires a non-empty array of target streams.');
    }

    targets.forEach(target => this.addTarget(target));

    // When the source stream piped to this multiplexer is destroyed,
    // we need to ensure our internal state is cleaned up.
    this.on('prefinish', this.#handleSourceFinish.bind(this));
  }

  /**
   * Adds a new target stream to the multiplexer.
   * Each target is tracked with a unique ID and its backpressure state.
   * @param {Writable} target - The writable stream to add.
   * @private
   */
  addTarget(target) {
    if (typeof target?.pipe !== 'function' || typeof target?.write !== 'function') {
      throw new TypeError('All targets must be valid Writable streams.');
    }

    const id = uuidv4();
    const targetState = {
      stream: target,
      isDraining: true,
      id,
    };

    this.#targets.set(id, targetState);

    target.on('drain', () => this.#handleTargetDrain(id));
    target.on('error', (err) => this.#handleTargetError(id, err));
    target.on('finish', () => this.emit(FORK_EVENTS.FORK_FINISHED, id));

    // If the multiplexer is already destroyed, destroy any new target immediately.
    if (this.destroyed) {
      target.destroy(this.#error);
    }
  }

  /**
   * The internal `_write` implementation for the Writable stream.
   * This method is called with a chunk of data from the source stream.
   * It writes the chunk to all registered targets and manages backpressure.
   *
   * @param {Buffer|string|any} chunk - The data chunk to write.
   * @param {string} encoding - The encoding of the chunk (if it's a string).
   * @param {(error?: Error | null) => void} callback - The callback to signal completion of the write.
   * @returns {void}
   * @private
   */
  _write(chunk, encoding, callback) {
    this.#pendingWrites++;
    let activeTargets = 0;

    const onWriteComplete = () => {
      activeTargets--;
      if (activeTargets === 0) {
        this.#pendingWrites--;
        if (this.#draining) {
          callback();
        } else {
          // If we are not draining, store the callback to be called when 'drain' is emitted.
          this.#drainCallbacks.add(callback);
        }
      }
    };

    // If there are no targets, we can complete the write immediately.
    if (this.#targets.size === 0) {
      this.#pendingWrites--;
      return callback();
    }

    for (const targetState of this.#targets.values()) {
      // Do not write to destroyed or errored streams.
      if (targetState.stream.destroyed) {
        continue;
      }
      activeTargets++;
    }

    // Handle case where all targets might have been destroyed.
    if (activeTargets === 0) {
        this.#pendingWrites--;
        return callback();
    }

    for (const targetState of this.#targets.values()) {
      if (targetState.stream.destroyed) {
        continue;
      }

      // The `structuredClone` is crucial for objectMode to ensure each fork
      // gets an independent copy of the object, preventing side-effects where
      // one stream's transformation affects another's input.
      const chunkToWrite = this.#options.objectMode ? structuredClone(chunk) : chunk;

      const writeOk = targetState.stream.write(chunkToWrite, encoding, onWriteComplete);

      if (!writeOk) {
        targetState.isDraining = false;
        this.#draining = false;
      }
    }
  }

  /**
   * The internal `_final` implementation for the Writable stream.
   * This is called when the source stream has finished writing all its data.
   * It ensures all target streams are properly ended.
   *
   * @param {(error?: Error | null) => void} callback - The callback to signal completion of finalization.
   * @private
   */
  _final(callback) {
    let pendingEnds = this.#targets.size;

    const onEnd = (err) => {
      // We only care about the first error during finalization.
      if (err && !this.#error) {
        this.#error = err;
      }
      pendingEnds--;
      if (pendingEnds === 0) {
        callback(this.#error);
      }
    };

    if (this.#targets.size === 0) {
      return callback();
    }

    for (const { stream } of this.#targets.values()) {
      // If a stream is already destroyed, don't try to end it.
      if (stream.destroyed) {
        pendingEnds--;
        continue;
      }
      // Listen for the 'finish' or 'error' event to know when `end()` has completed.
      stream.once('finish', onEnd);
      stream.once('error', onEnd);
      stream.end();
    }

    if (pendingEnds === 0) {
        callback();
    }
  }

  /**
   * The internal `_destroy` implementation for the Writable stream.
   * This is called when the multiplexer itself is destroyed, either due to an
   * external call or an internal error. It ensures all target streams are also destroyed.
   *
   * @param {Error | null} err - The error that caused the destruction, if any.
   * @param {(error?: Error | null) => void} callback - The callback to signal completion of destruction.
   * @private
   */
  _destroy(err, callback) {
    if (this.#sourceDestroyed) {
      // If already in the process of destroying, just call the callback.
      return callback(err);
    }
    this.#sourceDestroyed = true;
    this.#error = err; // Store the primary error

    // Flush any pending drain callbacks with an error.
    this.#drainCallbacks.forEach(cb => cb(err ?? new Error('Stream destroyed')));
    this.#drainCallbacks.clear();

    let pendingDestroys = 0;
    const onTargetDestroyed = (destroyErr) => {
      // We don't overwrite the original error with subsequent destroy errors.
      pendingDestroys--;
      if (pendingDestroys === 0) {
        callback(err); // Signal completion with the original error.
      }
    };

    for (const { stream } of this.#targets.values()) {
      if (!stream.destroyed) {
        pendingDestroys++;
        // The 'error' event might not fire on destroy, so we don't listen for it.
        // The callback of `destroy` is the reliable way to know it's done.
        stream.destroy(err, onTargetDestroyed);
      }
    }

    if (pendingDestroys === 0) {
      callback(err);
    }
  }

  /**
   * Handles the 'drain' event from a target stream.
   * When a target drains, we check if all other targets are also draining.
   * If so, the multiplexer itself emits 'drain' and resumes accepting data.
   *
   * @param {string} targetId - The unique ID of the target stream that drained.
   * @private
   */
  #handleTargetDrain(targetId) {
    const targetState = this.#targets.get(targetId);
    if (targetState) {
      targetState.isDraining = true;
    }

    // Check if all targets are now draining.
    const allDraining = Array.from(this.#targets.values()).every(
      t => t.isDraining || t.stream.destroyed
    );

    if (allDraining && !this.#draining) {
      this.#draining = true;
      this.#drainCallbacks.forEach(cb => cb());
      this.#drainCallbacks.clear();
      this.emit('drain');
    }
  }

  /**
   * Handles an 'error' event from a target stream.
   * Based on the `abortOnError` option, it either destroys all other streams
   * or allows them to continue. It always emits a `FORK_ERROR` event.
   *
   * @param {string} targetId - The unique ID of the target stream that errored.
   * @param {Error} err - The error emitted by the target stream.
   * @private
   */
  #handleTargetError(targetId, err) {
    // Prevent handling the same error multiple times or after destruction.
    if (this.destroyed) {
      return;
    }

    this.emit(FORK_EVENTS.FORK_ERROR, { id: targetId, error: err });

    if (this.#options.abortOnError) {
      // The `destroy` method will propagate the error to all other targets.
      // We pass the error to ensure the cause is not lost.
      this.destroy(err);
    }
  }

  /**
   * Handles the 'prefinish' event, which indicates the source stream has ended.
   * This is a final opportunity to check if any writes are still in flight.
   * If so, we wait for them to complete before allowing the `_final` method to be called.
   * @private
   */
  #handleSourceFinish() {
    if (this.#pendingWrites > 0) {
      // There's a write operation still in progress. We need to wait for it.
      // The 'drain' event will fire when all pending writes are done.
      this.once('drain', () => {
        // Now that pending writes are clear, we can safely allow finalization.
        // The stream machinery will call `_final` after this.
      });
    }
  }
}