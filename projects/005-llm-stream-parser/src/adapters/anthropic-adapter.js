/**
 * @file src/adapters/anthropic-adapter.js
 * @description Adapter for normalizing chunks from Anthropic's Claude API stream format.
 *
 * This module provides the `AnthropicAdapter` class, which is responsible for
 * transforming data chunks from the Anthropic Messages API stream into a
 * standardized format. It handles the specific Server-Sent Events (SSE) structure
 * used by Anthropic, including different event types like `content_block_delta`
 * and `message_stop`.
 */

import { BaseAdapter } from './base-adapter.js';
import { StreamError } from '../errors/StreamError.js';
import { ANTHROPIC_EVENT_TYPES } from '../utils/constants.js';

/**
 * An adapter for parsing and normalizing streaming responses from the Anthropic API.
 *
 * This class extends `BaseAdapter` and implements the `normalize` method
 * to handle the specific JSON structure and event types of Anthropic's
 * streaming events. It correctly extracts content deltas and identifies the
 * end of the stream.
 *
 * @see {@link https://docs.anthropic.com/claude/reference/messages-streaming}
 * @extends {BaseAdapter}
 */
export class AnthropicAdapter extends BaseAdapter {
  /**
   * Normalizes a provider-specific JSON object from the Anthropic stream into a unified format.
   *
   * This method processes a single parsed JSON object from an Anthropic stream chunk,
   * along with its associated event type. It filters for relevant events and extracts
   * the text content or signals the end of the stream.
   *
   * @param {object} chunk - The parsed JSON object from a single stream event.
   * @param {string} eventType - The SSE event type (e.g., 'message_start', 'content_block_delta').
   * @returns {import('./base-adapter.js').NormalizedChunk | null} A standardized chunk object, or null if the event is not meant for consumption (e.g., 'ping').
   * @throws {StreamError} If the chunk format is unexpected or an API error is reported.
   */
  normalize(chunk, eventType) {
    // Use a switch statement for clear, efficient handling of different event types.
    switch (eventType) {
      case ANTHROPIC_EVENT_TYPES.PING:
        // Ping events are keep-alives and can be safely ignored by the consumer.
        // Returning null signals the parser to skip this chunk.
        return null;

      case ANTHROPIC_EVENT_TYPES.MESSAGE_START:
        // This event signals the beginning of the message and contains metadata.
        // We can capture the message ID here. The actual content comes in subsequent deltas.
        return {
          id: chunk.message?.id ?? null,
          event: eventType,
          data: '', // No text content in this event.
          done: false,
          raw: chunk,
        };

      case ANTHROPIC_EVENT_TYPES.CONTENT_BLOCK_DELTA:
        // This event contains a piece of the message content.
        // We ensure the chunk has the expected structure before accessing nested properties.
        if (chunk.delta?.type !== 'text_delta' || typeof chunk.delta?.text !== 'string') {
          throw new StreamError('Invalid Anthropic content_block_delta: "delta.text" is missing or not a string.', {
            code: 'UNEXPECTED_FORMAT',
            chunk: JSON.stringify(chunk),
          });
        }
        return {
          id: null, // ID is typically sent in message_start, not here.
          event: eventType,
          data: chunk.delta.text,
          done: false,
          raw: chunk,
        };

      case ANTHROPIC_EVENT_TYPES.MESSAGE_DELTA:
        // This event provides updates on the message, like the stop reason.
        // It does not contain content itself but can signal the end.
        return {
          id: null,
          event: eventType,
          data: '',
          done: chunk.delta?.stop_reason !== null && typeof chunk.delta?.stop_reason !== 'undefined',
          raw: chunk,
        };

      case ANTHROPIC_EVENT_TYPES.MESSAGE_STOP:
        // This event explicitly signals the end of the message stream.
        return {
          id: null,
          event: eventType,
          data: '',
          done: true,
          raw: chunk,
        };

      case ANTHROPIC_EVENT_TYPES.ERROR:
        // The stream itself is reporting a provider-side error.
        // We wrap this in a StreamError for consistent error handling.
        const errorMessage = chunk.error?.message ?? 'Unknown Anthropic API error';
        throw new StreamError(`Anthropic API Error: ${errorMessage}`, {
          code: 'PROVIDER_ERROR',
          chunk: JSON.stringify(chunk),
        });

      // Events like 'content_block_start' and 'content_block_stop' are metadata events.
      // While useful, they don't carry primary text content for the consumer.
      // We treat them as empty, skippable chunks to avoid cluttering the output.
      case ANTHROPIC_EVENT_TYPES.CONTENT_BLOCK_START:
      case ANTHROPIC_EVENT_TYPES.CONTENT_BLOCK_STOP:
        return {
          id: null,
          event: eventType,
          data: '',
          done: false,
          raw: chunk,
        };

      default:
        // Handle unknown or unexpected event types gracefully.
        // This could be a new event type introduced by Anthropic.
        // We'll treat it as an empty, non-terminating chunk.
        return {
          id: null,
          event: eventType,
          data: '',
          done: false,
          raw: chunk,
        };
    }
  }
}

// Export a singleton instance for convenience, allowing for direct use
// without manual instantiation in most cases.
export const anthropicAdapter = new AnthropicAdapter();