/**
 * @file src/core/join-aggregator.js
 * @description The core readable stream class for the 'join' feature.
 *
 * This file defines the `JoinAggregator`, a custom `Readable` stream. Its primary role
 * is to wait for multiple forked streams to complete their work and then aggregate
 * their results.
 *
 * It listens for a `FORK_EVENTS.FORK_FINISHED` event from a `ForkMultiplexer` for each
 * expected fork. Once all forks have signaled completion, it takes the collected data
 * (if any) and pushes it downstream to the consumer of the join stream.
 *
 * This class is central to the "join" part of the fork-join pattern, enabling synchronization
 * after parallel processing.
 */

import { Readable } from 'node:stream';
import { FORK_EVENTS, JOIN_EVENTS } from '../utils/constants.js';

/**
 * @class JoinAggregator
 * @extends Readable
 * @description A Readable stream that aggregates results from multiple finished forks
 * and pushes them downstream after all forks have completed.
 */
export class JoinAggregator extends Readable {
  #multiplexer;
  #forkCount;
  #finishedForks = new Map();
  #isFinished = false;
  #error = null;

  /**
   * Constructs a new JoinAggregator instance.
   * @param {ForkMultiplexer} multiplexer - The ForkMultiplexer instance whose forks are to be joined.
   * @param {number} forkCount - The total number of forks that must finish before this stream can end.
   * @param {object} [options={}] - Configuration options for the readable stream.
   * @param {boolean} [options.objectMode=false] - Whether the stream should operate in object mode.
   * @param {number} [options.highWaterMark] - The high-water mark for the readable stream buffer.
   */
  constructor(multiplexer, forkCount, options = {}) {
    super({
      objectMode: options.objectMode,
      highWaterMark: options.highWaterMark,
      // The destroy method is overridden to handle custom cleanup logic
      destroy: (err, callback) => this._destroy(err, callback),
    });

    if (!multiplexer || typeof multiplexer.on !== 'function') {
      throw new TypeError('JoinAggregator requires a valid ForkMultiplexer instance.');
    }
    if (typeof forkCount !== 'number' || forkCount < 0) {
      throw new TypeError('JoinAggregator requires a non-negative number for forkCount.');
    }

    this.#multiplexer = multiplexer;
    this.#forkCount = forkCount;

    // Bind event handlers to the current instance
    this.#handleForkFinished = this.#handleForkFinished.bind(this);
    this.#handleForkError = this.#handleForkError.bind(this);

    // Attach listeners to the multiplexer to receive signals from forks
    this.#multiplexer.on(FORK_EVENTS.FORK_FINISHED, this.#handleForkFinished);
    this.#multiplexer.on(FORK_EVENTS.FORK_ERROR, this.#handleForkError);
  }

  /**
   * The internal `_read` implementation for the Readable stream.
   * This method is a no-op because the JoinAggregator pushes data proactively
   * when all forks have finished, rather than in response to a downstream `read()` call.
   * The stream's internal buffer handles backpressure.
   *
   * @param {number} size - The amount of data to read (ignored).
   * @private
   */
  _read(size) {
    // Data is pushed asynchronously when forks finish, not on-demand.
  }

  /**
   * The internal `_destroy` implementation for the Readable stream.
   * This method is called when the join stream is destroyed. It ensures that
   * event listeners on the multiplexer are removed to prevent memory leaks.
   *
   * @param {Error | null} err - The error that caused the destruction, if any.
   * @param {(error?: Error | null) => void} callback - The callback to signal completion of destruction.
   * @private
   */
  _destroy(err, callback) {
    this.#error = err;
    this.#cleanupListeners();
    callback(err);
  }

  /**
   * Handles the `FORK_FINISHED` event from the multiplexer.
   * It records the completion of a fork and its associated data. If all expected
   * forks have finished, it triggers the final data push.
   *
   * @param {string} forkId - The unique ID of the fork that finished.
   * @param {any} [data] - Optional data passed from the finished fork.
   * @private
   */
  #handleForkFinished(forkId, data) {
    if (this.destroyed || this.#isFinished) {
      return;
    }

    // Avoid counting the same fork twice
    if (!this.#finishedForks.has(forkId)) {
      this.#finishedForks.set(forkId, data);
    }

    if (this.#finishedForks.size >= this.#forkCount) {
      this.#finishAndPushData();
    }
  }

  /**
   * Handles the `FORK_ERROR` event from the multiplexer.
   * When an error occurs in any of the forks, this aggregator is immediately
   * destroyed with the same error, propagating it down the stream pipeline.
   *
   * @param {object} errorPayload - The payload containing the error and fork ID.
   * @param {Error} errorPayload.error - The error from the fork.
   * @param {string} errorPayload.id - The ID of the fork that errored.
   * @private
   */
  #handleForkError({ error }) {
    // Propagate the error to the consumer of this join stream.
    // The destroy method will handle cleanup.
    this.destroy(error);
  }

  /**
   * Finalizes the stream by pushing all aggregated data and then signaling the end.
   * This method is called only after all expected forks have reported completion.
   *
   * @private
   */
  #finishAndPushData() {
    if (this.#isFinished || this.destroyed) {
      return;
    }
    this.#isFinished = true;
    this.#cleanupListeners();

    try {
      const results = Array.from(this.#finishedForks.values()).filter(
        data => data !== undefined
      );

      for (const result of results) {
        // Push each result individually. The internal buffer will handle backpressure.
        // If push returns false, we don't need to wait for 'drain' because we are
        // pushing all data at once and then ending the stream.
        this.push(result);
      }

      // Signal that there is no more data to be pushed.
      this.push(null);

      // Emit a final event for consumers who may want to know when the join is complete.
      this.emit(JOIN_EVENTS.ALL_FORKS_JOINED, results);
    } catch (err) {
      // This could happen if `this.push()` throws an error after the stream is destroyed.
      this.destroy(err);
    }
  }

  /**
   * Removes event listeners from the multiplexer to prevent memory leaks.
   * This is crucial for proper cleanup when the stream is destroyed or finished.
   *
   * @private
   */
  #cleanupListeners() {
    if (this.#multiplexer) {
      this.#multiplexer.removeListener(FORK_EVENTS.FORK_FINISHED, this.#handleForkFinished);
      this.#multiplexer.removeListener(FORK_EVENTS.FORK_ERROR, this.#handleForkError);
      this.#multiplexer = null; // Allow garbage collection
    }
  }
}