/**
 * @file src/utils/stream-utils.js
 * @description Utility functions for handling async iterators and Node.js streams.
 *
 * This module provides robust, production-quality helpers for common stream
 * operations, tailored for the needs of the LLM Stream Multiplexer. This includes
 * converting various stream-like objects into a standard async iterator format
 * and handling timeouts on async iterators.
 */

import { Readable } from 'node:stream';

/**
 * Normalizes a given stream-like object into a standard async iterator.
 * This function handles Node.js Readable streams, Fetch API Response bodies,
 * and objects that are already async iterators, making them consumable in a
_` * uniform way.
 *
 * @param {Readable | Response['body'] | AsyncIterable<any>} streamLike - The stream-like object to normalize.
 * @returns {AsyncIterable<any>} An async iterator.
 * @throws {TypeError} If the input is not a recognizable stream-like object.
 */
export function toAsyncIterator(streamLike) {
  if (!streamLike) {
    throw new TypeError('toAsyncIterator: received a null or undefined input.');
  }

  // Already an async iterator (e.g., from another generator function).
  if (typeof streamLike[Symbol.asyncIterator] === 'function') {
    return streamLike;
  }

  // Node.js Readable stream.
  if (streamLike instanceof Readable) {
    return Readable.toWeb(streamLike);
  }

  // Check for Web Stream (like fetch Response.body).
  // It's an async iterable, so the first check should catch it, but this is a fallback.
  if (typeof streamLike.getReader === 'function') {
    return streamLike;
  }

  throw new TypeError(
    'Unsupported stream type. Input must be a Node.js Readable stream, a Web Stream (like Response.body), or an async iterable.'
  );
}

/**
 * Wraps an async iterator with a timeout. If the iterator does not yield a
 * value within the specified duration, the wrapper will throw a `TimeoutError`.
 * The timeout is reset after each yielded value.
 *
 * This is crucial for handling unresponsive LLM provider streams that may hang
 * without closing, ensuring the multiplexer can gracefully handle the failure
-` * of a single source.
 *
 * @param {AsyncIterable<any>} iterator - The async iterator to wrap.
 * @param {number} ms - The timeout duration in milliseconds.
 * @param {string} [message='AsyncIterator timed out'] - The error message for the timeout.
 * @yields {any} The values from the original iterator.
 * @throws {TimeoutError} If the iterator fails to produce a value within the timeout period.
 * @returns {AsyncGenerator<any, void, any>} A new async generator with the timeout behavior.
 */
export async function* withTimeout(iterator, ms, message = 'AsyncIterator timed out') {
  if (ms <= 0) {
    yield* iterator;
    return;
  }

  const source = iterator[Symbol.asyncIterator]();

  while (true) {
    const race = Promise.race([
      source.next(),
      new Promise((_, reject) =>
        setTimeout(() => {
          const err = new Error(message);
          err.name = 'TimeoutError';
          reject(err);
        }, ms)
      ),
    ]);

    try {
      const result = await race;
      if (result.done) {
        return; // The source iterator has completed.
      }
      yield result.value;
    } catch (error) {
      // Clean up the underlying iterator if possible.
      // This is important to release resources if the source stream is hanging.
      if (typeof source.return === 'function') {
        // We don't await this, as we want to propagate the error immediately.
        // The return() call is a best-effort cleanup.
        source.return();
      }
      throw error; // Re-throw the timeout or any other error.
    }
  }
}