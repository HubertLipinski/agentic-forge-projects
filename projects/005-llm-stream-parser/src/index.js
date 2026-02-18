/**
 * @file src/index.js
 * @description Main entry point for the llm-stream-parser library.
 *
 * This file serves as the public API surface for the package. It exports the
 * primary `createStreamParser` factory function, which simplifies the process
 * of creating and configuring a stream parser. It also provides direct access
 * to the individual provider adapters and the core `parseStream` generator
 * for more advanced use cases.
 *
 * The `package.json` `exports` field is configured to allow deep imports
 * for individual adapters, enabling tree-shaking and smaller bundle sizes
 * for consumers who only need a specific provider.
 *
 * @example
 * // Basic usage with the factory function
 * import { createStreamParser, OpenAIAdapter } from 'llm-stream-parser';
 *
 * const response = await fetch(...); // fetch call to OpenAI
 * const parser = createStreamParser({ adapter: new OpenAIAdapter() });
 *
 * for await (const chunk of parser.parse(response.body)) {
 *   process.stdout.write(chunk.data);
 * }
 *
 * @example
 * // Direct usage of the async generator
 * import { parseStream, anthropicAdapter } from 'llm-stream-parser';
 *
 * const response = await fetch(...); // fetch call to Anthropic
 * const stream = parseStream({ stream: response.body, adapter: anthropicAdapter });
 *
 * for await (const chunk of stream) {
 *   // ...
 * }
 */

import { parseStream } from './parser.js';
import { OpenAIAdapter, openAIAdapter } from './adapters/openai-adapter.js';
import { AnthropicAdapter, anthropicAdapter } from './adapters/anthropic-adapter.js';
import { GeminiAdapter, geminiAdapter } from './adapters/gemini-adapter.js';
import { BaseAdapter } from './adapters/base-adapter.js';
import { StreamError } from './errors/StreamError.js';

/**
 * @typedef {import('./adapters/base-adapter.js').BaseAdapter} Adapter
 * @typedef {import('./adapters/base-adapter.js').NormalizedChunk} NormalizedChunk
 */

/**
 * @typedef {object} ParserOptions
 * @property {Adapter} adapter - An instance of a provider-specific adapter (e.g., `new OpenAIAdapter()`).
 * @property {boolean} [isSSE=true] - A flag indicating if the stream is in Server-Sent Events (SSE) format. Set to `false` for non-SSE formats like Google Gemini's.
 */

/**
 * Factory function to create a configured stream parser.
 *
 * This function simplifies the setup process by returning an object with a `parse`
 * method. The `parse` method is pre-configured with the provided adapter and options,
 * ready to accept a `ReadableStream`.
 *
 * This approach promotes a clean and reusable pattern for stream processing.
 *
 * @param {ParserOptions} options - The configuration options for the parser.
 * @returns {{parse: (stream: ReadableStream) => AsyncGenerator<NormalizedChunk, void, unknown>}} An object with a `parse` method.
 * @throws {Error} if the `adapter` option is missing or invalid.
 *
 * @example
 * import { createStreamParser, OpenAIAdapter } from 'llm-stream-parser';
 *
 * // 1. Create a configured parser instance
 * const parser = createStreamParser({
 *   adapter: new OpenAIAdapter(),
 * });
 *
 * // 2. Use the instance to parse a stream
 * async function processStream(response) {
 *   for await (const chunk of parser.parse(response.body)) {
 *     console.log(chunk.data);
 *   }
 * }
 */
export function createStreamParser(options) {
  const { adapter, isSSE = true } = options ?? {};

  if (!adapter || typeof adapter.normalize !== 'function') {
    throw new Error(
      'A valid adapter instance must be provided in the `adapter` option.',
    );
  }

  return {
    /**
     * Parses a `ReadableStream` using the pre-configured adapter and options.
     *
     * @param {ReadableStream} stream - The Node.js ReadableStream to parse.
     * @returns {AsyncGenerator<NormalizedChunk, void, unknown>} An async generator that yields normalized data chunks.
     */
    parse: function (stream) {
      return parseStream({ stream, adapter, isSSE });
    },
  };
}

// Export the core async generator for advanced use cases.
export { parseStream };

// Export custom error class for type checking and handling.
export { StreamError };

// Export adapter classes for extension or direct instantiation.
export { BaseAdapter, OpenAIAdapter, AnthropicAdapter, GeminiAdapter };

// Export pre-instantiated singleton adapters for convenience.
export { openAIAdapter, anthropicAdapter, geminiAdapter };