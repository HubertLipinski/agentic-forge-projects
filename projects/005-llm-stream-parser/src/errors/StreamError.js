/**
 * @file src/errors/StreamError.js
 * @description Custom error class for handling parsing and stream-related exceptions.
 *
 * This module defines a specialized Error class, `StreamError`, to provide
 * more context and structured information when errors occur during the
 * processing of LLM response streams. This helps developers using the library
 * to better diagnose and handle issues like malformed data, invalid JSON,
 * or provider-specific API errors.
 */

/**
 * Represents an error that occurred during the parsing of an LLM stream.
 *
 * This custom error class extends the native `Error` object to include
 * additional context relevant to stream processing, such as the raw data chunk
 * that caused the error and a specific error code for programmatic handling.
 *
 * Using a dedicated error class allows consumers of the library to differentiate
 * between stream-specific issues and other runtime errors.
 *
 * @example
 * try {
 *   for await (const chunk of streamParser(response.body)) {
 *     // ... process chunk
 *   }
 * } catch (error) {
 *   if (error instanceof StreamError) {
 *     console.error('A stream parsing error occurred:', error.message);
 *     console.error('Error Code:', error.code);
 *     console.error('Problematic Chunk:', error.chunk);
 *   } else {
 *     console.error('An unexpected error occurred:', error);
 *   }
 * }
 */
export class StreamError extends Error {
  /**
   * A unique code identifying the type of stream error.
   * This allows for programmatic handling of different error scenarios.
   * Possible values include:
   * - 'JSON_PARSE_ERROR': Failed to parse a data string as JSON.
   * - 'UNEXPECTED_FORMAT': The stream chunk did not match the expected format.
   * - 'PROVIDER_ERROR': The stream reported an error from the LLM provider.
   * - 'STREAM_ABORTED': The underlying stream was aborted or closed unexpectedly.
   * @type {string}
   */
  code;

  /**
   * The raw data chunk (as a string) that was being processed when the error occurred.
   * This can be invaluable for debugging malformed stream data.
   * It may be `null` if the error is not associated with a specific chunk.
   * @type {string | null}
   */
  chunk;

  /**
   * Constructs a new StreamError instance.
   *
   * @param {string} message - A human-readable description of the error.
   * @param {object} [options] - Optional parameters for additional context.
   * @param {string} [options.code='UNEXPECTED_FORMAT'] - A specific error code.
   * @param {string | null} [options.chunk=null] - The raw data chunk causing the error.
   * @param {Error} [options.cause] - The original error that caused this one, for error chaining.
   */
  constructor(message, options = {}) {
    // Pass the message and cause to the parent Error constructor
    super(message, { cause: options.cause });

    /**
     * The name of the error class.
     * @type {string}
     */
    this.name = 'StreamError';

    this.code = options.code ?? 'UNEXPECTED_FORMAT';
    this.chunk = options.chunk ?? null;

    // Maintain a proper stack trace (V8-specific)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StreamError);
    }
  }
}