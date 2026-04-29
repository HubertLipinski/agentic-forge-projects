/**
 * @file src/multiplexer.js
 * @description The core class of the LLM Stream Multiplexer library.
 *
 * This module defines the `Multiplexer` class, which orchestrates the entire
 * stream management process. It maintains a collection of `SourceStreamHandler`
 * instances, aggregates their individual states into a single, unified state object,
 * and exposes the changes to this state as a stream of JSON Patch operations.
 * This architecture enables efficient, real-time updates for complex AI UIs
 * displaying multiple agent responses.
 */

import { EventEmitter } from 'node:events';
import { SourceStreamHandler } from './source-stream-handler.js';
import { createPatchGenerator } from './utils/patch-generator.js';

/**
 * @typedef {import('./source-stream-handler.js').SourceStreamState} SourceStreamState
 */

/**
 * @typedef {object} MultiplexerOptions
 * @property {number} [updateIntervalMs=50] - The interval in milliseconds at which to check for state changes and yield JSON patches. A smaller value provides lower latency but may increase CPU usage.
 */

/**
 * Manages a collection of streaming AI responses, multiplexing them into a
 * single, structured output stream of JSON Patch operations.
 *
 * The Multiplexer is an async iterable. When you iterate over it (e.g., with a
 * `for await...of` loop), it yields arrays of JSON Patch operations that describe
 * the changes to the combined state of all managed streams.
 *
 * @extends {EventEmitter}
 * @implements {AsyncIterable<import('fast-json-patch').Operation[]>}
 */
export class Multiplexer extends EventEmitter {
  /** @type {Map<string, SourceStreamHandler>} */
  #handlers = new Map();
  /** @type {object} */
  #combinedState = { sources: {} };
  /** @type {import('./utils/patch-generator.js').createPatchGenerator} */
  #patchGenerator;
  /** @type {MultiplexerOptions} */
  #options;
  /** @type {boolean} */
  #isClosed = false;
  /** @type {() => void | null} */
  #resolveController = null;
  /** @type {Promise<void> | null} */
  #updateLoopPromise = null;

  /**
   * Constructs a new Multiplexer instance.
   *
   * @param {MultiplexerOptions} [options={}] - Configuration options for the multiplexer.
   */
  constructor(options = {}) {
    super();
    this.#options = {
      updateIntervalMs: 50,
      ...options,
    };
    this.#patchGenerator = createPatchGenerator(this.#combinedState);
  }

  /**
   * Adds a new AI provider stream to the multiplexer.
   *
   * This method creates a `SourceStreamHandler` for the given stream, starts
   * processing it, and integrates its state into the multiplexer's combined state.
   *
   * @param {AsyncIterable<any> | import('node:stream').Readable} streamLike - The raw stream from the AI provider.
   * @param {object} [options={}] - Options passed directly to the `SourceStreamHandler` constructor (e.g., id, timeoutMs, metadata).
   * @returns {string} The unique ID assigned to the newly added stream.
   * @throws {Error} If the multiplexer has already been closed.
   */
  addStream(streamLike, options = {}) {
    if (this.#isClosed) {
      throw new Error('Cannot add a stream to a closed multiplexer.');
    }

    const handler = new SourceStreamHandler(streamLike, options);
    const id = handler.id;

    if (this.#handlers.has(id)) {
      // This case should be rare, especially with UUIDs, but is a good safeguard.
      throw new Error(`A stream with the ID "${id}" already exists.`);
    }

    this.#handlers.set(id, handler);

    // Initialize the state for this new source.
    this.#combinedState.sources[id] = handler.getState();

    // Attach event listeners to propagate events from the handler.
    handler.on('start', (streamId) => this.emit('stream:start', streamId));
    handler.on('data', (chunk, streamId) => this.emit('stream:data', chunk, streamId));
    handler.on('end', (streamId) => this.emit('stream:end', streamId));
    handler.on('error', (error, streamId) => this.emit('stream:error', error, streamId));

    // Start processing the stream asynchronously.
    handler.start();

    // If the update loop isn't running, start it. This happens on the first
    // call to addStream or when iterating the multiplexer.
    if (!this.#updateLoopPromise) {
      this.#updateLoopPromise = this.#runUpdateLoop();
    }

    return id;
  }

  /**
   * Gracefully closes the multiplexer and all associated streams.
   *
   * This stops the generation of new patches and signals the end of the async
   * iterator. Any ongoing stream processing will be allowed to finish.
   * The multiplexer becomes unusable after being closed.
   */
  close() {
    if (this.#isClosed) {
      return;
    }
    this.#isClosed = true;

    // Signal the update loop to terminate.
    if (this.#resolveController) {
      this.#resolveController();
      this.#resolveController = null;
    }

    this.emit('close');
  }

  /**
   * The core private method that runs in a loop, checking for state changes
   * and notifying consumers.
   * @private
   */
  async #runUpdateLoop() {
    while (!this.#isClosed) {
      this.#updateCombinedState();

      // If there's a consumer waiting for the next set of patches, notify them.
      if (this.#resolveController) {
        this.#resolveController();
        this.#resolveController = null;
      }

      // Wait for the specified interval before the next check.
      await new Promise(resolve => setTimeout(resolve, this.#options.updateIntervalMs));
    }
  }

  /**
   * Iterates over all active handlers and updates the `combinedState` object
   * with their latest states.
   * @private
   */
  #updateCombinedState() {
    for (const [id, handler] of this.#handlers.entries()) {
      this.#combinedState.sources[id] = handler.getState();
    }
  }

  /**
   * Implements the async iterator protocol for the Multiplexer.
   *
   * This allows the multiplexer to be used in `for await...of` loops, yielding
   * arrays of JSON Patch operations whenever the combined state changes.
   *
   * @returns {AsyncGenerator<import('fast-json-patch').Operation[], void, void>}
   */
  async *[Symbol.asyncIterator]() {
    // Ensure the update loop is running, even if no streams have been added yet.
    if (!this.#updateLoopPromise) {
      this.#updateLoopPromise = this.#runUpdateLoop();
    }

    try {
      while (!this.#isClosed) {
        // Create a promise that will be resolved by the update loop
        // when it's time to generate the next patch.
        const controllerPromise = new Promise(resolve => {
          this.#resolveController = resolve;
        });

        await controllerPromise;

        // If closed while waiting, exit the loop.
        if (this.#isClosed) break;

        // Generate patches based on the latest state.
        const patches = this.#patchGenerator.generate(this.#combinedState);

        // Only yield if there are actual changes.
        if (patches.length > 0) {
          yield patches;
        }
      }
    } finally {
      // Ensure cleanup happens if the consumer breaks the loop early.
      this.close();
    }
  }
}