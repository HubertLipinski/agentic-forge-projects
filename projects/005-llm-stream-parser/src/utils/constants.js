/**
 * @file src/utils/constants.js
 * @description Exports constants used for parsing LLM streams.
 *
 * This file centralizes various string literals and regular expressions
 * required for processing Server-Sent Events (SSE) and other chunked
 * data formats from different LLM providers. This approach improves
 * maintainability and readability of the core parsing logic.
 */

/**
 * @constant {string} SSE_DATA_PREFIX
 * The standard prefix for a data line in a Server-Sent Event stream.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format}
 */
export const SSE_DATA_PREFIX = 'data: ';

/**
 * @constant {string} SSE_EVENT_PREFIX
 * The standard prefix for an event type line in a Server-Sent Event stream.
 * Used by providers like Anthropic to signal different event types (e.g., 'ping', 'content_block_delta').
 */
export const SSE_EVENT_PREFIX = 'event: ';

/**
 * @constant {string} OPENAI_STREAM_TERMINATOR
 * The specific data payload sent by OpenAI's API to signal the end of a stream.
 */
export const OPENAI_STREAM_TERMINATOR = '[DONE]';

/**
 * @constant {RegExp} NEWLINE_REGEXP
 * A regular expression to match one or more newline characters (`\n` or `\r\n`).
 * Used to split the incoming stream data into individual lines for processing.
 * This is more robust than a simple `string.split('\n')` as it handles
 * different line ending conventions and multiple blank lines between events.
 */
export const NEWLINE_REGEXP = /\r?\n/g;

/**
 * @constant {object} ANTHROPIC_EVENT_TYPES
 * A frozen object containing the known event types for Anthropic's streaming API.
 * Using this helps avoid magic strings in the parsing logic.
 * @property {string} PING - A keep-alive event.
 * @property {string} MESSAGE_START - Signals the beginning of a message.
 * @property {string} MESSAGE_DELTA - Contains a piece of the message content.
 * @property {string} MESSAGE_STOP - Signals the end of the message.
 * @property {string} CONTENT_BLOCK_START - Signals the start of a content block.
 * @property {string} CONTENT_BLOCK_DELTA - Contains a piece of a content block.
 * @property {string} CONTENT_BLOCK_STOP - Signals the end of a content block.
 * @property {string} ERROR - Signals an error from the API.
 */
export const ANTHROPIC_EVENT_TYPES = Object.freeze({
  PING: 'ping',
  MESSAGE_START: 'message_start',
  MESSAGE_DELTA: 'message_delta',
  MESSAGE_STOP: 'message_stop',
  CONTENT_BLOCK_START: 'content_block_start',
  CONTENT_BLOCK_DELTA: 'content_block_delta',
  CONTENT_BLOCK_STOP: 'content_block_stop',
  ERROR: 'error',
});