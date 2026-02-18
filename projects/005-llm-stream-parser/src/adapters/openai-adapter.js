/**
 * @file src/adapters/openai-adapter.js
 * @description Adapter for normalizing chunks from OpenAI's API stream format.
 *
 * This module provides the `OpenAIAdapter` class, which is responsible for
 * transforming data chunks from the OpenAI Completions and Chat Completions
 * API streams into a standardized format. It handles the specific structure of
 * OpenAI's Server-Sent Events (SSE), including identifying content deltas,
 * stream termination signals, and other metadata.
 */

import { BaseAdapter } from './base-adapter.js';
import { StreamError } from '../errors/StreamError.js';

/**
 * An adapter for parsing and normalizing streaming responses from the OpenAI API.
 *
 * This class extends `BaseAdapter` and implements the `normalize` method
 * to handle the specific JSON structure of OpenAI's streaming events. It
 * correctly extracts the content delta from chat completion chunks and
 * text from legacy completion chunks.
 *
 * @see {@link https://platform.openai.com/docs/api-reference/chat/streaming}
 * @extends {BaseAdapter}
 */
export class OpenAIAdapter extends BaseAdapter {
  /**
   * Normalizes a provider-specific JSON object from the OpenAI stream into a unified format.
   *
   * This method processes a single parsed JSON object from an OpenAI stream chunk.
   * It identifies the type of response (chat completion vs. legacy completion) and
   * extracts the relevant text content.
   *
   * @param {object} chunk - The parsed JSON object from a single stream event.
   *   Expected to have a `choices` array. For chat completions, each choice has a `delta`
   *   object. For legacy completions, it has a `text` property.
   * @returns {import('./base-adapter.js').NormalizedChunk} A standardized chunk object.
   * @throws {StreamError} If the chunk format is unexpected or lacks essential properties.
   */
  normalize(chunk) {
    if (!chunk || !Array.isArray(chunk.choices) || chunk.choices.length === 0) {
      throw new StreamError('Invalid OpenAI chunk: "choices" array is missing or empty.', {
        code: 'UNEXPECTED_FORMAT',
        chunk: JSON.stringify(chunk),
      });
    }

    // The primary content is usually in the first choice.
    const choice = chunk.choices[0];

    // Handle chat completion streams (e.g., gpt-4, gpt-3.5-turbo)
    // The delta object can be empty in the first chunk.
    if (typeof choice.delta !== 'undefined') {
      const content = choice.delta?.content ?? '';
      return {
        id: chunk.id ?? null,
        event: 'completion',
        data: content,
        // The stream is done when `finish_reason` is not null (e.g., 'stop', 'length').
        done: choice.finish_reason !== null && typeof choice.finish_reason !== 'undefined',
        raw: chunk,
      };
    }

    // Handle legacy completion streams (e.g., text-davinci-003)
    if (typeof choice.text !== 'undefined') {
      return {
        id: chunk.id ?? null,
        event: 'completion',
        data: choice.text,
        done: choice.finish_reason !== null && typeof choice.finish_reason !== 'undefined',
        raw: chunk,
      };
    }

    // If we reach here, the chunk format is unrecognized.
    // It might be the first chunk with an empty delta, but we check for that above.
    // This could also be a chunk with a valid `choices` array but no `delta` or `text`.
    // We can treat this as an empty content chunk without throwing an error,
    // as it might be a metadata-only chunk.
    return {
      id: chunk.id ?? null,
      event: 'completion',
      data: '',
      done: choice.finish_reason !== null && typeof choice.finish_reason !== 'undefined',
      raw: chunk,
    };
  }
}

// Export a singleton instance for convenience, allowing for direct use
// without manual instantiation in most cases.
export const openAIAdapter = new OpenAIAdapter();