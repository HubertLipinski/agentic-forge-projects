/**
 * @file src/parser.js
 * @description Core async generator function that takes a readable stream and yields parsed, normalized data objects.
 *
 * This module contains the central logic for processing LLM response streams. It
 * reads chunks from a Node.js ReadableStream, decodes them, splits them into
 * lines or events, and then uses a provider-specific adapter to parse and
 * normalize the data. The output is a standard async iterable, making it easy
 * to consume streaming data from various LLMs with a consistent `for await...of` loop.
 */

import { StreamError } from './errors/StreamError.js';
import {
  SSE_DATA_PREFIX,
  SSE_EVENT_PREFIX,
  OPENAI_STREAM_TERMINATOR,
  NEWLINE_REGEXP,
} from './utils/constants.js';

/**
 * An async generator that parses a readable stream from an LLM API response.
 *
 * It reads the stream chunk by chunk, handles different streaming formats (SSE, chunked JSON),
 * and yields normalized data objects using a provider-specific adapter. This function
 * is the heart of the library, providing a unified `for await...of` interface for
 * consuming LLM streams.
 *
 * @async
 * @generator
 * @param {object} options - The configuration options for the parser.
 * @param {ReadableStream} options.stream - The Node.js ReadableStream to parse (e.g., from `undici` or `node-fetch`).
 * @param {import('./adapters/base-adapter.js').BaseAdapter} options.adapter - An instance of a provider-specific adapter (e.g., `OpenAIAdapter`).
 * @param {boolean} [options.isSSE=true] - A flag indicating if the stream is in Server-Sent Events (SSE) format. Set to `false` for non-SSE formats like Google Gemini's.
 * @yields {Promise<import('./adapters/base-adapter.js').NormalizedChunk>} A promise that resolves to a normalized chunk of data.
 * @throws {StreamError} If the stream is unreadable, data is malformed, or the adapter fails to normalize a chunk.
 * @throws {Error} If the `stream` or `adapter` options are missing.
 *
 * @example
 * // Assuming `response.body` is a ReadableStream from an OpenAI API call
 * const streamParser = parseStream({
 *   stream: response.body,
 *   adapter: new OpenAIAdapter(),
 * });
 *
 * try {
 *   for await (const chunk of streamParser) {
 *     process.stdout.write(chunk.data);
 *   }
 * } catch (error) {
 *   console.error("Error parsing stream:", error);
 * }
 */
export async function* parseStream({ stream, adapter, isSSE = true }) {
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
    throw new Error('A valid ReadableStream must be provided in the `stream` option.');
  }
  if (!adapter || typeof adapter.normalize !== 'function') {
    throw new Error('A valid adapter instance must be provided in the `adapter` option.');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent = 'message'; // Default SSE event type

  try {
    for await (const value of stream) {
      // Decode the raw Uint8Array chunk to a string and append to buffer.
      buffer += decoder.decode(value, { stream: true });

      // Process the buffer line by line (or chunk by chunk for non-SSE).
      let boundary;
      while ((boundary = findBoundary(buffer, isSSE)) !== -1) {
        const rawChunk = buffer.substring(0, boundary).trim();
        buffer = buffer.substring(boundary);

        if (rawChunk === '') {
          // This was likely a double newline, signaling the end of an SSE event.
          // Reset the event type for the next one.
          currentEvent = 'message';
          continue;
        }

        let data;
        if (isSSE) {
          // For SSE, we need to parse event type and data lines.
          if (rawChunk.startsWith(SSE_EVENT_PREFIX)) {
            currentEvent = rawChunk.substring(SSE_EVENT_PREFIX.length).trim();
            continue; // This line is processed, move to the next.
          }

          if (!rawChunk.startsWith(SSE_DATA_PREFIX)) {
            // Ignore lines that are not part of the SSE data/event format (e.g., comments starting with ':').
            continue;
          }
          data = rawChunk.substring(SSE_DATA_PREFIX.length);
        } else {
          // For non-SSE, the entire chunk is the data.
          data = rawChunk;
        }

        // Check for the stream termination signal (e.g., OpenAI's '[DONE]').
        if (data === OPENAI_STREAM_TERMINATOR) {
          return; // Gracefully exit the generator.
        }

        let parsedJson;
        try {
          parsedJson = JSON.parse(data);
        } catch (error) {
          // If JSON parsing fails, it could be a malformed chunk.
          // We throw a specific StreamError with context.
          throw new StreamError('Failed to parse stream data as JSON.', {
            code: 'JSON_PARSE_ERROR',
            chunk: data,
            cause: error,
          });
        }

        // Normalize the parsed JSON using the provided adapter.
        // The adapter might return null to signal that a chunk should be skipped (e.g., Anthropic's 'ping' event).
        const normalized = adapter.normalize(parsedJson, currentEvent);

        if (normalized) {
          yield normalized;
          // If the adapter signals that this is the final chunk, we can stop processing.
          if (normalized.done) {
            return;
          }
        }

        // Reset event type after processing a data payload in SSE.
        if (isSSE) {
          currentEvent = 'message';
        }
      }
    }
  } catch (error) {
    // Re-throw StreamErrors directly.
    if (error instanceof StreamError) {
      throw error;
    }
    // Wrap other errors (e.g., network issues from the stream source) in a StreamError.
    throw new StreamError('The stream was aborted or encountered a network error.', {
      code: 'STREAM_ABORTED',
      cause: error,
    });
  } finally {
    // After the loop, there might be a final, incomplete chunk in the buffer.
    // We decode it here to ensure no data is lost, though it's often empty.
    const finalChunk = decoder.decode(undefined, { stream: false });
    if (finalChunk.trim()) {
      // This case is rare but could happen if the stream ends without a proper newline.
      // We log a warning as it might indicate a truncated response.
      console.warn(
        'llm-stream-parser: The stream ended with a non-empty, unprocessed buffer. This may indicate a truncated response.',
        { buffer: finalChunk },
      );
    }
  }
}

/**
 * Finds the position of the next event boundary in the buffer.
 *
 * - For SSE (`isSSE = true`), the boundary is a newline character (`\n`),
 *   as each line is a separate part of an event.
 * - For non-SSE chunked JSON (`isSSE = false`), the boundary is also a newline,
 *   assuming each JSON object is newline-delimited. This is a common convention
 *   for streams like Google Gemini's.
 *
 * @param {string} buffer - The current data buffer.
 * @param {boolean} isSSE - Flag indicating the stream format.
 * @returns {number} The index of the boundary plus one, or -1 if no boundary is found.
 * @private
 */
function findBoundary(buffer, isSSE) {
  // Both SSE and common chunked JSON formats use newlines as delimiters.
  // The logic is the same for both in this implementation.
  // The `isSSE` parameter is kept for future extensibility if a format
  // requires a different delimiter.
  const _unused = isSSE;
  const newlineIndex = buffer.search(NEWLINE_REGEXP);
  return newlineIndex !== -1 ? newlineIndex + 1 : -1;
}