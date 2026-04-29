/**
 * @file test/multiplexer.test.js
 * @description Unit and integration tests for the Multiplexer class.
 *
 * This test suite uses Node.js's built-in test runner (`node:test`) to verify
 * the functionality of the Multiplexer class. It covers stream addition, data
 * handling, JSON Patch generation, error isolation, timeouts, and dynamic
 * stream management.
 */

import { test, describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { applyPatch } from 'fast-json-patch';
import { Multiplexer } from '../src/multiplexer.js';
import { createMockProviderStream } from '../examples/mock-provider.js';

// Helper to collect all patches from a multiplexer stream
async function collectPatches(multiplexer) {
  const allPatches = [];
  for await (const patches of multiplexer) {
    allPatches.push(...patches);
  }
  return allPatches;
}

// Helper to collect all chunks from an async iterable
async function collectStream(iterator) {
  const chunks = [];
  for await (const chunk of iterator) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('Multiplexer', () => {

  it('should instantiate with default options', () => {
    const multiplexer = new Multiplexer();
    assert.ok(multiplexer instanceof Multiplexer, 'Multiplexer should be an instance of Multiplexer');
  });

  it('should instantiate with custom options', () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 100 });
    assert.ok(multiplexer instanceof Multiplexer, 'Multiplexer should be an instance of Multiplexer with custom options');
  });

  it('should add a stream and return a valid ID', () => {
    const multiplexer = new Multiplexer();
    const stream = createMockProviderStream('test');
    const id = multiplexer.addStream(stream);
    assert.strictEqual(typeof id, 'string', 'addStream should return a string ID');
    assert.ok(id.length > 0, 'The returned ID should not be empty');
    multiplexer.close();
  });

  it('should throw an error if adding a stream with a duplicate ID', () => {
    const multiplexer = new Multiplexer();
    const stream = createMockProviderStream('test');
    const id = 'custom-id-123';
    multiplexer.addStream(stream, { id });
    assert.throws(
      () => multiplexer.addStream(stream, { id }),
      new Error(`A stream with the ID "${id}" already exists.`),
      'Should throw when adding a stream with a duplicate ID'
    );
    multiplexer.close();
  });

  it('should process a single stream and produce correct JSON patches', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 10 });
    const text = 'Hello, world!';
    const stream = createMockProviderStream(text, { chunkDelayMs: 5, chunkSize: 5 });
    const id = multiplexer.addStream(stream);

    const patches = await collectPatches(multiplexer);

    let clientState = { sources: {} };
    applyPatch(clientState, patches);

    assert.strictEqual(clientState.sources[id].content, text, 'Final content should match');
    assert.strictEqual(clientState.sources[id].status, 'completed', 'Final status should be completed');
    assert.strictEqual(clientState.sources[id].error, null, 'Error should be null');
  });

  it('should process multiple concurrent streams correctly', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 10 });
    const text1 = 'First stream content.';
    const text2 = 'Second stream content.';

    const stream1 = createMockProviderStream(text1, { chunkDelayMs: 15 });
    const stream2 = createMockProviderStream(text2, { chunkDelayMs: 10 });

    const id1 = multiplexer.addStream(stream1, { metadata: { name: 'stream1' } });
    const id2 = multiplexer.addStream(stream2, { metadata: { name: 'stream2' } });

    const patches = await collectPatches(multiplexer);

    let clientState = { sources: {} };
    applyPatch(clientState, patches);

    assert.strictEqual(clientState.sources[id1].content, text1, 'Stream 1 content should be correct');
    assert.strictEqual(clientState.sources[id1].status, 'completed', 'Stream 1 status should be completed');
    assert.deepStrictEqual(clientState.sources[id1].metadata, { name: 'stream1' }, 'Stream 1 metadata should be correct');

    assert.strictEqual(clientState.sources[id2].content, text2, 'Stream 2 content should be correct');
    assert.strictEqual(clientState.sources[id2].status, 'completed', 'Stream 2 status should be completed');
    assert.deepStrictEqual(clientState.sources[id2].metadata, { name: 'stream2' }, 'Stream 2 metadata should be correct');
  });

  it('should isolate errors: one stream fails, others complete', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 10 });
    const text1 = 'This stream will complete.';
    const text2 = 'This stream will fail.';
    const errorMessage = 'Simulated failure';

    const stream1 = createMockProviderStream(text1, { chunkDelayMs: 10 });
    const stream2 = createMockProviderStream(text2, { chunkDelayMs: 5, willError: true, errorMessage });

    const id1 = multiplexer.addStream(stream1);
    const id2 = multiplexer.addStream(stream2);

    const patches = await collectPatches(multiplexer);

    let clientState = { sources: {} };
    applyPatch(clientState, patches);

    // Check successful stream
    assert.strictEqual(clientState.sources[id1].content, text1, 'Successful stream content should be complete');
    assert.strictEqual(clientState.sources[id1].status, 'completed', 'Successful stream status should be completed');
    assert.strictEqual(clientState.sources[id1].error, null, 'Successful stream should have no error');

    // Check failed stream
    assert.ok(clientState.sources[id2].content.length > 0, 'Failed stream should have partial content');
    assert.strictEqual(clientState.sources[id2].status, 'error', 'Failed stream status should be error');
    assert.strictEqual(clientState.sources[id2].error.name, 'Error', 'Failed stream error name should be correct');
    assert.strictEqual(clientState.sources[id2].error.message, errorMessage, 'Failed stream error message should be correct');
  });

  it('should handle stream timeouts correctly', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 10 });
    
    // This generator will yield one chunk then hang forever
    async function* hangingGenerator() {
      yield 'first chunk';
      await new Promise(() => {}); // Never resolves
    }
    const hangingStream = Readable.from(hangingGenerator());

    const id = multiplexer.addStream(hangingStream, { timeoutMs: 50 });

    const patches = await collectPatches(multiplexer);
    
    let clientState = { sources: {} };
    applyPatch(clientState, patches);

    assert.strictEqual(clientState.sources[id].content, 'first chunk', 'Content before timeout should be present');
    assert.strictEqual(clientState.sources[id].status, 'timed_out', 'Stream status should be timed_out');
    assert.strictEqual(clientState.sources[id].error.name, 'TimeoutError', 'Error name should be TimeoutError');
    assert.ok(clientState.sources[id].error.message.includes('timed out after 50ms'), 'Error message should indicate timeout');
  });

  it('should dynamically add a stream to a running multiplexer', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 20 });
    const text1 = 'Initial stream.';
    const text2 = 'Dynamically added stream.';

    const stream1 = createMockProviderStream(text1, { chunkDelayMs: 10 });
    const id1 = multiplexer.addStream(stream1);

    // After a delay, add the second stream
    setTimeout(() => {
      const stream2 = createMockProviderStream(text2, { chunkDelayMs: 10 });
      multiplexer.addStream(stream2);
    }, 50);

    const patches = await collectPatches(multiplexer);

    let clientState = { sources: {} };
    applyPatch(clientState, patches);

    const sourceIds = Object.keys(clientState.sources);
    assert.strictEqual(sourceIds.length, 2, 'There should be two sources in the final state');
    
    const id2 = sourceIds.find(id => id !== id1);

    assert.strictEqual(clientState.sources[id1].content, text1);
    assert.strictEqual(clientState.sources[id1].status, 'completed');

    assert.strictEqual(clientState.sources[id2].content, text2);
    assert.strictEqual(clientState.sources[id2].status, 'completed');
  });

  it('should throw an error when adding a stream to a closed multiplexer', () => {
    const multiplexer = new Multiplexer();
    multiplexer.close();
    const stream = createMockProviderStream('test');
    assert.throws(
      () => multiplexer.addStream(stream),
      new Error('Cannot add a stream to a closed multiplexer.'),
      'Should throw when adding a stream after closing'
    );
  });

  it('should emit events correctly', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 10 });
    const text1 = 'abc';
    const text2 = 'def';
    const errorMessage = 'error test';

    const stream1 = createMockProviderStream(text1, { chunkDelayMs: 5, chunkSize: 1 });
    const stream2 = createMockProviderStream(text2, { chunkDelayMs: 5, chunkSize: 1, willError: true, errorMessage });

    const id1 = multiplexer.addStream(stream1);
    const id2 = multiplexer.addStream(stream2);

    const events = {
      'stream:start': [],
      'stream:data': [],
      'stream:end': [],
      'stream:error': [],
      'close': [],
    };

    multiplexer.on('stream:start', (streamId) => events['stream:start'].push(streamId));
    multiplexer.on('stream:data', (chunk, streamId) => events['stream:data'].push({ chunk, streamId }));
    multiplexer.on('stream:end', (streamId) => events['stream:end'].push(streamId));
    multiplexer.on('stream:error', (error, streamId) => events['stream:error'].push({ error, streamId }));
    multiplexer.on('close', () => events['close'].push(true));

    await collectPatches(multiplexer); // Consume the stream to let it run to completion

    assert.deepStrictEqual(new Set(events['stream:start']), new Set([id1, id2]), 'Should emit start for both streams');
    assert.strictEqual(events['stream:end'].length, 1, 'Should emit end for one stream');
    assert.strictEqual(events['stream:end'][0], id1, 'Should emit end for the successful stream');
    assert.strictEqual(events['stream:error'].length, 1, 'Should emit error for one stream');
    assert.strictEqual(events['stream:error'][0].streamId, id2, 'Should emit error for the failed stream');
    assert.strictEqual(events['stream:error'][0].error.message, errorMessage, 'Error message in event should be correct');
    assert.strictEqual(events.close.length, 1, 'Should emit close event');

    const dataForStream1 = events['stream:data'].filter(d => d.streamId === id1).map(d => d.chunk).join('');
    assert.strictEqual(dataForStream1, text1, 'Should emit all data chunks for stream 1');
  });

  it('should stop yielding patches after being closed', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 10 });
    multiplexer.addStream(createMockProviderStream('A long stream that will be cut short.', { chunkDelayMs: 5 }));

    const collectedPatches = [];
    const iterator = multiplexer[Symbol.asyncIterator]();

    // Consume a few patches
    collectedPatches.push((await iterator.next()).value);
    collectedPatches.push((await iterator.next()).value);

    // Now close it
    multiplexer.close();

    const result = await iterator.next();
    assert.strictEqual(result.done, true, 'Iterator should be done after close() is called');
  });

  it('should handle an empty input stream correctly', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 10 });
    const stream = createMockProviderStream('', { chunkDelayMs: 5 });
    const id = multiplexer.addStream(stream);

    const patches = await collectPatches(multiplexer);
    
    let clientState = { sources: {} };
    applyPatch(clientState, patches);

    assert.strictEqual(clientState.sources[id].content, '', 'Content should be empty');
    assert.strictEqual(clientState.sources[id].status, 'completed', 'Status should be completed');
    assert.strictEqual(clientState.sources[id].error, null, 'Error should be null');
  });

  it('should handle a stream that fails immediately', async () => {
    const multiplexer = new Multiplexer({ updateIntervalMs: 10 });
    
    async function* failingGenerator() {
      throw new Error('Immediate failure');
    }
    const failingStream = Readable.from(failingGenerator());

    const id = multiplexer.addStream(failingStream);

    const patches = await collectPatches(multiplexer);
    
    let clientState = { sources: {} };
    applyPatch(clientState, patches);

    assert.strictEqual(clientState.sources[id].content, '', 'Content should be empty');
    assert.strictEqual(clientState.sources[id].status, 'error', 'Status should be error');
    assert.strictEqual(clientState.sources[id].error.message, 'Immediate failure', 'Error message should be correct');
  });
});