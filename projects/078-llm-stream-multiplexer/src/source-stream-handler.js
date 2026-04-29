/**
 * @file src/source-stream-handler.js
 * @description A class representing a single incoming AI stream.
 *
 * This module defines the `SourceStreamHandler` class, which is a core component
 * of the LLM Stream Multiplexer. Each instance of this class wraps a single
 * stream from an AI provider, managing its lifecycle, state, and any errors
 * that occur. It normalizes the incoming stream data, handles timeouts, and
 * provides a structured state object that the main Multiplexer can consume.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'node:events';
import { toAsyncIterator, withTimeout } from './utils/stream-utils.js';

/**
 * @typedef {'pending' | 'streaming' | 'completed' | 'error' | 'timed_out'} StreamStatus
 * The lifecycle status of a source stream.
 * - pending: The stream has been initialized but has not yet started processing.
 * - streaming: The stream is actively receiving and processing data.
 * - completed: The stream has finished successfully.
 * - error: The stream terminated due to an error.
 * - timed_out: The stream terminated due to a timeout.
 */

/**
 * @typedef {object} SourceStreamState
 * @property {string} id - The unique identifier for this stream source.
 * @property {StreamStatus} status - The current lifecycle status of the stream.
 * @property {string} content - The accumulated content from the stream.
 * @property {object | null} error - An error object if the stream's status is 'error' or 'timed_out'.
 * @property {object} metadata - A user-provided object for arbitrary data.
 */

/**
 * Manages the lifecycle and state of a single incoming AI provider stream.
 *
 * This class is responsible for:
 * - Assigning a unique ID to the stream.
 * - Normalizing the input stream into a standard async iterator.
 * - Wrapping the iterator with a timeout to prevent hangs.
 * - Processing the stream, accumulating content, and updating its state.
 * - Emitting events for state changes ('start', 'data', 'end', 'error').
 * - Providing a structured `getState` method for the Multiplexer to poll.
 *
 * @extends {EventEmitter}
 */
export class SourceStreamHandler extends EventEmitter {
  #id;
  #streamIterator;
  #state;
  #processingPromise;

  /**
   * Constructs a new SourceStreamHandler.
   *
   * @param {AsyncIterable<any> | import('node:stream').Readable} streamLike - The raw stream from the AI provider.
   * @param {object} [options={}] - Configuration options for the handler.
   * @param {string} [options.id] - A specific ID to assign to the stream. If not provided, a UUID will be generated.
   * @param {number} [options.timeoutMs=30000] - Timeout in milliseconds between data chunks. If no data is received within this period, the stream is considered timed out.
   * @param {object} [options.metadata={}] - An object to store arbitrary metadata associated with this stream.
   */
  constructor(streamLike, options = {}) {
    super();

    const { id = uuidv4(), timeoutMs = 30000, metadata = {} } = options;

    this.#id = id;

    /** @type {SourceStreamState} */
    this.#state = {
      id: this.#id,
      status: 'pending',
      content: '',
      error: null,
      metadata: structuredClone(metadata),
    };

    try {
      const asyncIterator = toAsyncIterator(streamLike);
      this.#streamIterator = withTimeout(asyncIterator, timeoutMs, `Stream (id: ${this.#id}) timed out after ${timeoutMs}ms`);
    } catch (error) {
      this.#state.status = 'error';
      this.#state.error = { name: error.name, message: error.message };
      // Defer the emission to allow listeners to be attached.
      process.nextTick(() => this.emit('error', this.#state.error, this.#id));
    }

    this.#processingPromise = null;
  }

  /**
   * Returns the unique identifier of this stream handler.
   * @returns {string} The stream ID.
   */
  get id() {
    return this.#id;
  }

  /**
   * Returns a snapshot of the current state of the stream.
   * This method is designed to be non-mutating and safe to call at any time.
   * @returns {SourceStreamState} A clone of the internal state object.
   */
  getState() {
    return structuredClone(this.#state);
  }

  /**
   * Starts processing the stream. This method is idempotent.
   * It initiates the consumption of the async iterator and handles the stream's
   * lifecycle events (data, completion, errors).
   *
   * @returns {Promise<void>} A promise that resolves when the stream processing is complete or has failed.
   */
  start() {
    if (this.#processingPromise) {
      return this.#processingPromise;
    }

    if (!this.#streamIterator) {
      this.#processingPromise = Promise.resolve();
      return this.#processingPromise;
    }

    this.#processingPromise = this.#processStream();
    return this.#processingPromise;
  }

  /**
   * The core private method that consumes the stream iterator.
   * @private
   */
  async #processStream() {
    try {
      for await (const chunk of this.#streamIterator) {
        if (this.#state.status === 'pending') {
          this.#updateState({ status: 'streaming' });
          this.emit('start', this.#id);
        }

        // Assuming chunks are strings or can be converted to strings.
        // In a real-world scenario, this might need more robust parsing,
        // e.g., for Server-Sent Events (SSE).
        const contentChunk = typeof chunk === 'string' ? chunk : String(chunk);
        this.#updateState({ content: this.#state.content + contentChunk });
        this.emit('data', contentChunk, this.#id);
      }

      // If the loop completes without error, the stream is done.
      if (this.#state.status !== 'error' && this.#state.status !== 'timed_out') {
        this.#updateState({ status: 'completed' });
        this.emit('end', this.#id);
      }
    } catch (error) {
      const isTimeout = error.name === 'TimeoutError';
      const newStatus = isTimeout ? 'timed_out' : 'error';

      this.#updateState({
        status: newStatus,
        error: { name: error.name, message: error.message },
      });
      this.emit('error', this.#state.error, this.#id);
    }
  }

  /**
   * A centralized method for updating the internal state.
   * @param {Partial<SourceStreamState>} updates - An object with properties to update.
   * @private
   */
  #updateState(updates) {
    Object.assign(this.#state, updates);
  }
}