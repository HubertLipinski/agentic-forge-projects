/**
 * @file examples/anthropic-stream-example.js
 * @description Demonstrates how to use the llm-stream-parser with a mocked or real Anthropic API stream.
 *
 * This example showcases the primary usage pattern of the library for Anthropic's API:
 * 1. Import `createStreamParser` and the `AnthropicAdapter`.
 * 2. Instantiate the adapter.
 * 3. Create a parser instance using the factory function.
 * 4. Make an API request to Anthropic using `undici`, ensuring the correct headers are set.
 * 5. Pass the response body (a ReadableStream) to the parser's `parse` method.
 * 6. Consume the normalized chunks using a `for await...of` loop.
 *
 * To run this example with a real API key:
 * 1. Make sure you have `undici` installed (`npm install undici`).
 * 2. Set your Anthropic API key as an environment variable: `export ANTHROPIC_API_KEY="your_key_here"`.
 * 3. Run the file: `node examples/anthropic-stream-example.js`.
 *
 * The example includes a mock server to demonstrate functionality without needing a real API key.
 */

import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { request } from 'undici';
import { createStreamParser, AnthropicAdapter } from '../src/index.js';

// --- Mock Anthropic Server ---

const MOCK_ANTHROPIC_RESPONSE_CHUNKS = [
  'event: message_start\n',
  'data: {"type": "message_start", "message": {"id": "msg_123", "type": "message", "role": "assistant", "model": "claude-3-opus-20240229", "content": [], "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 10, "output_tokens": 1}}}\n\n',
  'event: content_block_start\n',
  'data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}\n\n',
  'event: ping\n',
  'data: {"type": "ping"}\n\n',
  'event: content_block_delta\n',
  'data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}\n\n',
  'event: content_block_delta\n',
  'data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": ", world"}}\n\n',
  'event: content_block_delta\n',
  'data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "!"}}\n\n',
  'event: content_block_stop\n',
  'data: {"type": "content_block_stop", "index": 0}\n\n',
  'event: message_delta\n',
  'data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence":null}, "usage":{"output_tokens": 4}}\n\n',
  'event: message_stop\n',
  'data: {"type": "message_stop"}\n\n',
];

/**
 * Creates a simple mock server that streams a predefined Anthropic-like response.
 * This allows testing the parser without making real API calls.
 * @returns {import('node:http').Server} The created HTTP server instance.
 */
function createMockServer() {
  return createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/v1/messages') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Create a readable stream from the mock chunks with a small delay
      const stream = Readable.from(MOCK_ANTHROPIC_RESPONSE_CHUNKS);
      stream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });
}

// --- Main Application Logic ---

/**
 * Fetches a stream from the Anthropic API (or a mock) and processes it.
 * @param {string} apiUrl - The URL of the API endpoint.
 * @param {string | null} apiKey - The API key, or null for mock requests.
 */
async function processAnthropicStream(apiUrl, apiKey) {
  console.log(`\n--- Calling API at: ${apiUrl} ---`);

  // 1. Create a parser instance configured for Anthropic's SSE format.
  const parser = createStreamParser({
    adapter: new AnthropicAdapter(),
    isSSE: true, // Anthropic uses Server-Sent Events format
  });

  try {
    // 2. Make the streaming API request using `undici`.
    const { body: stream } = await request(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(apiKey && { 'x-api-key': apiKey }),
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Say "Hello, world!"' }],
        stream: true,
      }),
    });

    console.log('Response stream received. Parsing chunks...\n');
    let fullResponse = '';

    // 3. Use `for await...of` to consume the parsed and normalized chunks.
    for await (const chunk of parser.parse(stream)) {
      // `chunk` is a NormalizedChunk: { id, event, data, done, raw }
      // The adapter filters out irrelevant events like 'ping'.
      if (chunk.data) {
        process.stdout.write(chunk.data);
        fullResponse += chunk.data;
      }
    }

    console.log('\n\nStream finished.');
    console.log('Full reconstructed response:', fullResponse);
  } catch (error) {
    console.error('\n--- An error occurred ---');
    console.error('Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.error('Hint: Check if the API endpoint is reachable or if a firewall is blocking the connection.');
    } else if (error.statusCode === 401) {
      console.error('Hint: The API key is likely invalid or missing. Ensure it is set in the `x-api-key` header.');
    }
  }
}

/**
 * Main function to run the examples.
 */
async function main() {
  const realApiKey = process.env.ANTHROPIC_API_KEY;
  const realApiUrl = 'https://api.anthropic.com/v1/messages';

  // --- Example 1: Using the mock server ---
  const mockServer = createMockServer();
  const mockPort = 3001;
  const mockApiUrl = `http://localhost:${mockPort}/v1/messages`;

  await new Promise(resolve => mockServer.listen(mockPort, resolve));
  console.log(`Mock server running at ${mockApiUrl}`);

  await processAnthropicStream(mockApiUrl, null);

  mockServer.close();
  console.log('\nMock server stopped.');

  // --- Example 2: Using the real Anthropic API (if key is provided) ---
  if (realApiKey) {
    console.log('\n--- Found ANTHROPIC_API_KEY environment variable. Running real API example. ---');
    await processAnthropicStream(realApiUrl, realApiKey);
  } else {
    console.log('\n--- Skipping real API example: ANTHROPIC_API_KEY environment variable not set. ---');
    console.log('To run the real example, set your key: export ANTHROPIC_API_KEY="your_key_here"');
  }
}

main().catch(console.error);