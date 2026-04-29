/**
 * @file examples/mock-provider.js
 * @description A helper module for examples that simulates a streaming AI provider.
 *
 * This module provides a function to generate mock AI response streams. It's designed
 * to mimic the behavior of a real Large Language Model (LLM) provider's streaming API,
 * yielding text chunks with a configurable delay. This allows for realistic testing
 * and demonstration of the LLM Stream Multiplexer without incurring API costs or
 * relying on network connectivity.
 */

import { Readable } from 'node:stream';

/**
 * Simulates a delay, returning a promise that resolves after the specified duration.
 * @param {number} ms - The delay duration in milliseconds.
 * @returns {Promise<void>} A promise that resolves when the timeout completes.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * An async generator that simulates a streaming AI response.
 *
 * It yields chunks of a given text with a specified delay between each chunk,
 * mimicking the token-by-token output of a real LLM. It can also be configured
 * to simulate a stream that ends in an error.
 *
 * @param {string} text - The full text content to be streamed.
 * @param {object} [options={}] - Configuration options for the mock stream.
 * @param {number} [options.chunkDelayMs=50] - The delay in milliseconds between yielding each chunk.
 * @param {number} [options.chunkSize=5] - The number of characters in each yielded chunk.
 * @param {boolean} [options.willError=false] - If true, the stream will throw an error after a few chunks.
 * @param {string} [options.errorMessage='Simulated provider error'] - The error message to throw if `willError` is true.
 * @yields {string} A chunk of the input text.
 * @throws {Error} Throws an error if `willError` is set to true.
 */
async function* createMockStreamGenerator(text, options = {}) {
  const {
    chunkDelayMs = 50,
    chunkSize = 5,
    willError = false,
    errorMessage = 'Simulated provider error',
  } = options;

  let i = 0;
  while (i < text.length) {
    // Simulate a processing delay before yielding the next chunk.
    await sleep(chunkDelayMs);

    // For demonstration, simulate an error occurring mid-stream.
    if (willError && i >= chunkSize * 3) {
      throw new Error(errorMessage);
    }

    const chunk = text.substring(i, i + chunkSize);
    yield chunk;
    i += chunkSize;
  }
}

/**
 * Creates a mock AI provider stream as a Node.js Readable stream.
 *
 * This function wraps the `createMockStreamGenerator` in a Node.js `Readable` stream,
 * which is a common format for stream sources in Node.js applications.
 *
 * @param {string} text - The full text content to be streamed.
 * @param {object} [options={}] - Configuration options passed to the underlying generator.
 * @returns {Readable} A Node.js Readable stream that will emit the text chunks.
 */
export function createMockProviderStream(text, options = {}) {
  const generator = createMockStreamGenerator(text, options);
  return Readable.from(generator);
}