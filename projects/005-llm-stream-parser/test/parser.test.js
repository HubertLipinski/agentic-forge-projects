/**
 * @file test/parser.test.js
 * @description Unit tests for the core stream parser logic.
 *
 * These tests use mocked stream data and a simple mock adapter to isolate the
 * `parseStream` function's behavior. The goal is to verify that the parser correctly
 * handles various stream formats, data chunking, error conditions, and termination signals,
 * independent of any specific LLM provider's adapter logic.
 */

import { test, describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { Readable } from 'node:stream';
import { parseStream } from '../src/parser.js';
import { BaseAdapter } from '../src/adapters/base-adapter.js';
import { StreamError } from '../src/errors/StreamError.js';

/**
 * A simple mock adapter for testing purposes.
 * It normalizes by creating a string representation of the chunk.
 * @extends {BaseAdapter}
 */
class MockAdapter extends BaseAdapter {
  normalize(chunk, event) {
    if (chunk.error) {
      throw new StreamError(`Adapter error: ${chunk.error}`, {
        code: 'PROVIDER_ERROR',
      });
    }
    return {
      id: chunk.id ?? null,
      event: event ?? 'message',
      data: chunk.content ?? '',
      done: chunk.done ?? false,
      raw: chunk,
    };
  }
}

/**
 * Creates a mock ReadableStream from an array of strings or Buffers.
 * @param {Array<string | Buffer>} chunks - The data chunks to stream.
 * @returns {Readable} A Node.js ReadableStream.
 */
const createMockStream = (chunks) => Readable.from(chunks);

/**
 * Asynchronously collects all yielded values from an async generator into an array.
 * @param {AsyncGenerator} generator - The async generator to consume.
 * @returns {Promise<Array<any>>} A promise that resolves to an array of the generated items.
 */
const collectStream = async (generator) => {
  const results = [];
  for await (const value of generator) {
    results.push(value);
  }
  return results;
};

describe('parseStream()', () => {
  let adapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('Input Validation', () => {
    it('should throw an error if `stream` option is missing', async () => {
      const options = { adapter };
      await assert.rejects(
        async () => {
          // We don't need to consume the stream to trigger this error
          parseStream(options).next();
        },
        {
          name: 'Error',
          message: 'A valid ReadableStream must be provided in the `stream` option.',
        },
      );
    });

    it('should throw an error if `stream` is not a readable stream', async () => {
      const options = { stream: {}, adapter };
      await assert.rejects(
        async () => {
          parseStream(options).next();
        },
        {
          name: 'Error',
          message: 'A valid ReadableStream must be provided in the `stream` option.',
        },
      );
    });

    it('should throw an error if `adapter` option is missing', async () => {
      const options = { stream: createMockStream([]) };
      await assert.rejects(
        async () => {
          parseStream(options).next();
        },
        {
          name: 'Error',
          message: 'A valid adapter instance must be provided in the `adapter` option.',
        },
      );
    });

    it('should throw an error if `adapter` is not a valid adapter', async () => {
      const options = { stream: createMockStream([]), adapter: {} };
      await assert.rejects(
        async () => {
          parseStream(options).next();
        },
        {
          name: 'Error',
          message: 'A valid adapter instance must be provided in the `adapter` option.',
        },
      );
    });
  });

  describe('SSE Stream Parsing (isSSE=true)', () => {
    it('should parse a simple SSE stream with one data line', async () => {
      const stream = createMockStream(['data: {"content":"Hello"}\n\n']);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 1);
      assert.deepStrictEqual(results[0], {
        id: null,
        event: 'message',
        data: 'Hello',
        done: false,
        raw: { content: 'Hello' },
      });
    });

    it('should parse multiple data lines in a single chunk', async () => {
      const stream = createMockStream([
        'data: {"content":"Chunk 1"}\n\ndata: {"content":"Chunk 2"}\n\n',
      ]);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].data, 'Chunk 1');
      assert.strictEqual(results[1].data, 'Chunk 2');
    });

    it('should handle data split across multiple stream chunks', async () => {
      const stream = createMockStream([
        'data: {"content":"Part 1',
        '"}\n\ndata: {"content":"Part 2"}\n\n',
      ]);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].data, 'Part 1');
      assert.strictEqual(results[1].data, 'Part 2');
    });

    it('should correctly handle custom event types', async () => {
      const stream = createMockStream([
        'event: custom_event\n',
        'data: {"content":"Custom"}\n\n',
        'data: {"content":"Default"}\n\n',
      ]);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].event, 'custom_event');
      assert.strictEqual(results[0].data, 'Custom');
      assert.strictEqual(results[1].event, 'message');
      assert.strictEqual(results[1].data, 'Default');
    });

    it('should handle multi-line data within a single SSE event (not standard but robust)', async () => {
      // This is not standard SSE, but tests the line-by-line processing.
      // The parser should process each `data:` line as a separate message.
      const stream = createMockStream(['data: {"content":"line1"}\ndata: {"content":"line2"}\n\n']);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].data, 'line1');
      assert.strictEqual(results[1].data, 'line2');
    });

    it('should ignore comment lines and empty lines', async () => {
      const stream = createMockStream([
        ': this is a comment\n',
        '\n',
        'data: {"content":"Data"}\n\n',
      ]);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].data, 'Data');
    });

    it('should terminate gracefully on [DONE] signal', async () => {
      const stream = createMockStream([
        'data: {"content":"Final"}\n\n',
        'data: [DONE]\n\n',
        'data: {"content":"Should not be processed"}\n\n',
      ]);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].data, 'Final');
    });

    it('should terminate if adapter signals done', async () => {
      const stream = createMockStream([
        'data: {"content":"First"}\n\n',
        'data: {"content":"Last", "done": true}\n\n',
        'data: {"content":"Should not be processed"}\n\n',
      ]);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].data, 'First');
      assert.strictEqual(results[1].data, 'Last');
      assert.strictEqual(results[1].done, true);
    });

    it('should skip chunks if adapter returns null', async () => {
      mock.method(adapter, 'normalize', (chunk) => {
        if (chunk.content === 'skip') {
          return null;
        }
        return { data: chunk.content, done: false, raw: chunk };
      });

      const stream = createMockStream([
        'data: {"content":"First"}\n\n',
        'data: {"content":"skip"}\n\n',
        'data: {"content":"Third"}\n\n',
      ]);
      const parser = parseStream({ stream, adapter });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].data, 'First');
      assert.strictEqual(results[1].data, 'Third');
    });
  });

  describe('Non-SSE Stream Parsing (isSSE=false)', () => {
    it('should parse newline-delimited JSON objects', async () => {
      const stream = createMockStream([
        '{"content":"Chunk 1"}\n{"content":"Chunk 2"}\n',
      ]);
      const parser = parseStream({ stream, adapter, isSSE: false });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].data, 'Chunk 1');
      assert.strictEqual(results[1].data, 'Chunk 2');
    });

    it('should handle JSON objects split across stream chunks', async () => {
      const stream = createMockStream([
        '{"content":"Part 1"}\n{"co',
        'ntent":"Part 2"}\n',
      ]);
      const parser = parseStream({ stream, adapter, isSSE: false });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].data, 'Part 1');
      assert.strictEqual(results[1].data, 'Part 2');
    });

    it('should ignore empty lines between JSON objects', async () => {
      const stream = createMockStream([
        '{"content":"Chunk 1"}\n\n\n{"content":"Chunk 2"}\n',
      ]);
      const parser = parseStream({ stream, adapter, isSSE: false });
      const results = await collectStream(parser);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].data, 'Chunk 1');
      assert.strictEqual(results[1].data, 'Chunk 2');
    });
  });

  describe('Error Handling', () => {
    it('should throw StreamError on invalid JSON', async () => {
      const malformedChunk = 'data: { "content": "bad json\n\n';
      const stream = createMockStream([malformedChunk]);
      const parser = parseStream({ stream, adapter });

      await assert.rejects(collectStream(parser), (err) => {
        assert(err instanceof StreamError, 'Error should be a StreamError');
        assert.strictEqual(err.code, 'JSON_PARSE_ERROR');
        assert.strictEqual(err.message, 'Failed to parse stream data as JSON.');
        assert.strictEqual(err.chunk, '{ "content": "bad json');
        assert(err.cause instanceof SyntaxError, 'Cause should be SyntaxError');
        return true;
      });
    });

    it('should throw StreamError if adapter throws an error', async () => {
      const stream = createMockStream(['data: {"error":"test error"}\n\n']);
      const parser = parseStream({ stream, adapter });

      await assert.rejects(collectStream(parser), (err) => {
        assert(err instanceof StreamError, 'Error should be a StreamError');
        assert.strictEqual(err.code, 'PROVIDER_ERROR');
        assert.strictEqual(err.message, 'Adapter error: test error');
        return true;
      });
    });

    it('should throw StreamError if underlying stream emits an error', async () => {
      const testError = new Error('Network failure');
      const stream = new Readable({
        read() {
          this.destroy(testError);
        },
      });
      const parser = parseStream({ stream, adapter });

      await assert.rejects(collectStream(parser), (err) => {
        assert(err instanceof StreamError, 'Error should be a StreamError');
        assert.strictEqual(err.code, 'STREAM_ABORTED');
        assert.strictEqual(
          err.message,
          'The stream was aborted or encountered a network error.',
        );
        assert.deepStrictEqual(err.cause, testError);
        return true;
      });
    });

    it('should warn about unprocessed buffer at the end', async () => {
      const warnMock = mock.method(console, 'warn', () => {});
      const stream = createMockStream(['data: {"content":"incomplete"}']); // No trailing newline
      const parser = parseStream({ stream, adapter });
      await collectStream(parser);

      assert.strictEqual(warnMock.mock.callCount(), 1);
      const [message, context] = warnMock.mock.calls[0].arguments;
      assert.strictEqual(
        message,
        'llm-stream-parser: The stream ended with a non-empty, unprocessed buffer. This may indicate a truncated response.',
      );
      assert.deepStrictEqual(context, {
        buffer: 'data: {"content":"incomplete"}',
      });
    });
  });
});