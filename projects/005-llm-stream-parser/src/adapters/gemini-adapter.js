/**
 * @file src/adapters/gemini-adapter.js
 * @description Adapter for normalizing chunks from Google's Gemini API stream format.
 *
 * This module provides the `GeminiAdapter` class, which is responsible for
 * transforming data chunks from the Google Gemini API stream into a
 * standardized format. The Gemini API uses a non-SSE, chunked JSON format
 * where each chunk is a valid JSON object, but the stream as a whole is not
 * a JSON array. This adapter handles this specific structure.
 */

import { BaseAdapter } from './base-adapter.js';
import { StreamError } from '../errors/StreamError.js';

/**
 * An adapter for parsing and normalizing streaming responses from the Google Gemini API.
 *
 * This class extends `BaseAdapter` and implements the `normalize` method
 * to handle the specific JSON structure of Gemini's streaming responses. It
 * correctly extracts text content from the `candidates` array.
 *
 * Unlike SSE-based streams, Gemini's stream sends a series of JSON objects.
 * The parser needs to be configured to handle this format by splitting on a
 * specific delimiter or by parsing each data event as a self-contained JSON.
 * This adapter assumes the input `chunk` is a single, parsed JSON object from the stream.
 *
 * @see {@link https://ai.google.dev/docs/gemini_api_overview#stream}
 * @extends {BaseAdapter}
 */
export class GeminiAdapter extends BaseAdapter {
  /**
   * Normalizes a provider-specific JSON object from the Gemini stream into a unified format.
   *
   * This method processes a single parsed JSON object from a Gemini stream.
   * It extracts the text content from the first candidate's content part.
   *
   * @param {object} chunk - The parsed JSON object from a single stream event.
   *   Expected to have a `candidates` array, where each candidate contains
   *   `content.parts`.
   * @returns {import('./base-adapter.js').NormalizedChunk} A standardized chunk object.
   * @throws {StreamError} If the chunk format is unexpected, lacks essential properties,
   *   or reports a `promptFeedback` error.
   */
  normalize(chunk) {
    // According to Gemini docs, a stream may end with a `promptFeedback`
    // block indicating a safety-related issue (e.g., `BLOCK_REASON_SAFETY`).
    // This is a terminal state and should be treated as an error.
    if (chunk.promptFeedback?.blockReason) {
      const reason = chunk.promptFeedback.blockReason;
      const safetyRatings = JSON.stringify(chunk.promptFeedback.safetyRatings ?? {});
      throw new StreamError(
        `Gemini API Error: Stream blocked due to '${reason}'. Safety ratings: ${safetyRatings}`,
        {
          code: 'PROVIDER_ERROR',
          chunk: JSON.stringify(chunk),
        },
      );
    }

    // A valid chunk with content must have a `candidates` array.
    if (!chunk.candidates || !Array.isArray(chunk.candidates) || chunk.candidates.length === 0) {
      // It's possible to receive an empty chunk or a chunk without candidates
      // that isn't an error (e.g., metadata). We'll treat it as an empty,
      // non-terminating event.
      return {
        id: null,
        event: 'completion',
        data: '',
        done: false,
        raw: chunk,
      };
    }

    const candidate = chunk.candidates[0];

    // The `finishReason` indicates if the stream for this candidate is complete.
    // Possible values: "STOP", "MAX_TOKENS", "SAFETY", "RECITATION", "OTHER".
    const done = candidate.finishReason !== null && typeof candidate.finishReason !== 'undefined';

    // Extract the text content. The structure is `content.parts[0].text`.
    // We use optional chaining for safe navigation.
    const text = candidate.content?.parts?.[0]?.text ?? '';

    return {
      // Gemini does not provide a consistent stream ID in each chunk.
      id: null,
      event: 'completion',
      data: text,
      done,
      raw: chunk,
    };
  }
}

// Export a singleton instance for convenience, allowing for direct use
// without manual instantiation in most cases.
export const geminiAdapter = new GeminiAdapter();