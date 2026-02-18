/**
 * @file test/adapters.test.js
 * @description Unit tests for each provider adapter, ensuring correct normalization of various chunk formats.
 *
 * These tests verify that each adapter (`OpenAIAdapter`, `AnthropicAdapter`, `GeminiAdapter`)
 * correctly transforms its provider-specific input chunk into the standard `NormalizedChunk` format.
 * This includes handling various event types, extracting data correctly, identifying termination
 * conditions, and throwing appropriate `StreamError` exceptions for malformed or provider-error chunks.
 */

import { test, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { OpenAIAdapter } from '../src/adapters/openai-adapter.js';
import { AnthropicAdapter } from '../src/adapters/anthropic-adapter.js';
import { GeminiAdapter } from '../src/adapters/gemini-adapter.js';
import { StreamError } from '../src/errors/StreamError.js';
import { ANTHROPIC_EVENT_TYPES } from '../src/utils/constants.js';

describe('Adapters', () => {
  describe('OpenAIAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new OpenAIAdapter();
    });

    it('should normalize a standard chat completion chunk', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: 'chatcmpl-123',
        event: 'completion',
        data: 'Hello',
        done: false,
        raw: chunk,
      });
    });

    it('should handle the first chat chunk with an empty delta content', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: '' },
            finish_reason: null,
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: 'chatcmpl-123',
        event: 'completion',
        data: '',
        done: false,
        raw: chunk,
      });
    });

    it('should handle a chunk with an empty delta object', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: 'chatcmpl-123',
        event: 'completion',
        data: '',
        done: true,
        raw: chunk,
      });
    });

    it('should correctly identify the final chunk by `finish_reason`', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1694268190,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.strictEqual(normalized.done, true);
    });

    it('should normalize a legacy completion chunk', () => {
      const chunk = {
        id: 'cmpl-abc',
        object: 'text_completion',
        created: 1694268190,
        model: 'text-davinci-003',
        choices: [
          {
            index: 0,
            text: ' world!',
            finish_reason: null,
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: 'cmpl-abc',
        event: 'completion',
        data: ' world!',
        done: false,
        raw: chunk,
      });
    });

    it('should throw a StreamError for chunks with missing `choices` array', () => {
      const chunk = { id: 'chatcmpl-123', object: 'chat.completion.chunk' };
      assert.throws(
        () => adapter.normalize(chunk),
        (err) => {
          assert(err instanceof StreamError);
          assert.strictEqual(err.code, 'UNEXPECTED_FORMAT');
          assert.strictEqual(
            err.message,
            'Invalid OpenAI chunk: "choices" array is missing or empty.',
          );
          return true;
        },
      );
    });

    it('should throw a StreamError for chunks with an empty `choices` array', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        choices: [],
      };
      assert.throws(
        () => adapter.normalize(chunk),
        (err) => {
          assert(err instanceof StreamError);
          assert.strictEqual(err.code, 'UNEXPECTED_FORMAT');
          return true;
        },
      );
    });

    it('should handle a chunk with no delta or text by returning an empty data string', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, finish_reason: null }],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: 'chatcmpl-123',
        event: 'completion',
        data: '',
        done: false,
        raw: chunk,
      });
    });
  });

  describe('AnthropicAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new AnthropicAdapter();
    });

    it('should normalize a `content_block_delta` event', () => {
      const eventType = ANTHROPIC_EVENT_TYPES.CONTENT_BLOCK_DELTA;
      const chunk = {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello' },
      };
      const normalized = adapter.normalize(chunk, eventType);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: eventType,
        data: 'Hello',
        done: false,
        raw: chunk,
      });
    });

    it('should normalize a `message_start` event', () => {
      const eventType = ANTHROPIC_EVENT_TYPES.MESSAGE_START;
      const chunk = {
        type: 'message_start',
        message: { id: 'msg_123', role: 'assistant', content: [] },
      };
      const normalized = adapter.normalize(chunk, eventType);
      assert.deepStrictEqual(normalized, {
        id: 'msg_123',
        event: eventType,
        data: '',
        done: false,
        raw: chunk,
      });
    });

    it('should normalize a `message_stop` event and set done to true', () => {
      const eventType = ANTHROPIC_EVENT_TYPES.MESSAGE_STOP;
      const chunk = { type: 'message_stop' };
      const normalized = adapter.normalize(chunk, eventType);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: eventType,
        data: '',
        done: true,
        raw: chunk,
      });
    });

    it('should normalize a `message_delta` event and check for done state', () => {
      const eventType = ANTHROPIC_EVENT_TYPES.MESSAGE_DELTA;
      const chunk = {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
      };
      const normalized = adapter.normalize(chunk, eventType);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: eventType,
        data: '',
        done: true,
        raw: chunk,
      });
    });

    it('should return null for `ping` events', () => {
      const eventType = ANTHROPIC_EVENT_TYPES.PING;
      const chunk = { type: 'ping' };
      const normalized = adapter.normalize(chunk, eventType);
      assert.strictEqual(normalized, null);
    });

    it('should return an empty data chunk for metadata events like `content_block_start`', () => {
      const eventType = ANTHROPIC_EVENT_TYPES.CONTENT_BLOCK_START;
      const chunk = { type: 'content_block_start', index: 0 };
      const normalized = adapter.normalize(chunk, eventType);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: eventType,
        data: '',
        done: false,
        raw: chunk,
      });
    });

    it('should throw a StreamError for `error` events', () => {
      const eventType = ANTHROPIC_EVENT_TYPES.ERROR;
      const chunk = {
        type: 'error',
        error: { type: 'api_error', message: 'Overloaded' },
      };
      assert.throws(
        () => adapter.normalize(chunk, eventType),
        (err) => {
          assert(err instanceof StreamError);
          assert.strictEqual(err.code, 'PROVIDER_ERROR');
          assert.strictEqual(err.message, 'Anthropic API Error: Overloaded');
          return true;
        },
      );
    });

    it('should throw a StreamError for malformed `content_block_delta`', () => {
      const eventType = ANTHROPIC_EVENT_TYPES.CONTENT_BLOCK_DELTA;
      const chunk = { type: 'content_block_delta', delta: {} }; // Missing text
      assert.throws(
        () => adapter.normalize(chunk, eventType),
        (err) => {
          assert(err instanceof StreamError);
          assert.strictEqual(err.code, 'UNEXPECTED_FORMAT');
          assert.strictEqual(
            err.message,
            'Invalid Anthropic content_block_delta: "delta.text" is missing or not a string.',
          );
          return true;
        },
      );
    });

    it('should handle unknown event types gracefully', () => {
      const eventType = 'future_event';
      const chunk = { type: 'future_event', data: 'some data' };
      const normalized = adapter.normalize(chunk, eventType);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: eventType,
        data: '',
        done: false,
        raw: chunk,
      });
    });
  });

  describe('GeminiAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new GeminiAdapter();
    });

    it('should normalize a standard content chunk', () => {
      const chunk = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Hello' }],
              role: 'model',
            },
            finishReason: null,
            index: 0,
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: 'completion',
        data: 'Hello',
        done: false,
        raw: chunk,
      });
    });

    it('should correctly identify the final chunk by `finishReason`', () => {
      const chunk = {
        candidates: [
          {
            content: {
              parts: [{ text: ' world!' }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: 'completion',
        data: ' world!',
        done: true,
        raw: chunk,
      });
    });

    it('should handle chunks with missing text content gracefully', () => {
      const chunk = {
        candidates: [
          {
            content: { parts: [{}] }, // No 'text' property
            finishReason: null,
            index: 0,
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: 'completion',
        data: '',
        done: false,
        raw: chunk,
      });
    });

    it('should handle chunks with missing candidates array by returning an empty chunk', () => {
      const chunk = { usageMetadata: { totalTokenCount: 10 } };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: 'completion',
        data: '',
        done: false,
        raw: chunk,
      });
    });

    it('should throw a StreamError for chunks with `promptFeedback` indicating an error', () => {
      const chunk = {
        promptFeedback: {
          blockReason: 'SAFETY',
          safetyRatings: [
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'HIGH' },
          ],
        },
      };
      assert.throws(
        () => adapter.normalize(chunk),
        (err) => {
          assert(err instanceof StreamError);
          assert.strictEqual(err.code, 'PROVIDER_ERROR');
          assert(err.message.includes("Stream blocked due to 'SAFETY'"));
          return true;
        },
      );
    });

    it('should handle chunks with empty `parts` array', () => {
      const chunk = {
        candidates: [
          {
            content: { parts: [] },
            finishReason: null,
            index: 0,
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: 'completion',
        data: '',
        done: false,
        raw: chunk,
      });
    });

    it('should handle chunks with missing `content` object', () => {
      const chunk = {
        candidates: [
          {
            finishReason: 'MAX_TOKENS',
            index: 0,
          },
        ],
      };
      const normalized = adapter.normalize(chunk);
      assert.deepStrictEqual(normalized, {
        id: null,
        event: 'completion',
        data: '',
        done: true,
        raw: chunk,
      });
    });
  });
});