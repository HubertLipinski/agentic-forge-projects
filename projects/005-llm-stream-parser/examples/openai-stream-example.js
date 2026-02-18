/**
 * @file examples/openai-stream-example.js
 * @description Demonstrates how to use the llm-stream-parser with a mocked or real OpenAI API stream.
 *
 * This example showcases the primary usage pattern of the library:
 * 1. Import `createStreamParser` and the specific provider adapter (`OpenAIAdapter`).
 * 2. Instantiate the adapter.
 * 3. Create a parser instance using the factory function.
 * 4. Make an API request to an LLM provider (here, OpenAI) using a library like `undici`.
 * 5. Pass the response body (a ReadableStream) to the parser's `parse` method.
 * 6. Consume the normalized chunks using a `for await...of` loop.
 *
 * To run this example with a real API key:
 * 1. Make sure you have `undici` installed (`npm install undici`).
 * 2. Set your OpenAI API key as an environment variable: `export OPENAI_API_KEY="your_key_here"`.
 * 3. Run the file: `node examples/openai-stream-example.js`.
 *
 * The example includes a mock server to demonstrate functionality without needing a real API key.
 */

import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { request } from 'undici';
import { createStreamParser, OpenAIAdapter } from '../src/index.js';

// --- Mock OpenAI Server ---

const MOCK_OPENAI_RESPONSE_CHUNKS = [
  'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
  'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
  'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
  'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}\n\n',
  'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1694268190,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
  'data: [DONE]\n\n',
];

/**
 * Creates a simple mock server that streams a predefined OpenAI-like response.
 * This allows testing the parser without making real API calls.
 * @returns {import('node:http').Server} The created HTTP server instance.
 */
function createMockServer() {
  return createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Create a readable stream from the mock chunks
      const stream = Readable.from(MOCK_OPENAI_RESPONSE_CHUNKS);
      stream.pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });
}

// --- Main Application Logic ---

/**
 * Fetches a stream from the OpenAI API (or a mock) and processes it.
 * @param {string} apiUrl - The URL of the API endpoint.
 * @param {string | null} apiKey - The API key, or null for mock requests.
 */
async function processOpenAIStream(apiUrl, apiKey) {
  console.log(`\n--- Calling API at: ${apiUrl} ---`);

  // 1. Create a parser instance configured for OpenAI's SSE format.
  const parser = createStreamParser({
    adapter: new OpenAIAdapter(),
    isSSE: true, // OpenAI uses Server-Sent Events format
  });

  try {
    // 2. Make the streaming API request using `undici`.
    const { body: stream } = await request(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Say "Hello world!"' }],
        stream: true,
      }),
    });

    console.log('Response stream received. Parsing chunks...\n');
    let fullResponse = '';

    // 3. Use `for await...of` to consume the parsed and normalized chunks.
    for await (const chunk of parser.parse(stream)) {
      // `chunk` is a NormalizedChunk: { id, event, data, done, raw }
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
      console.error('Hint: The API key is likely invalid or missing.');
    }
  }
}

/**
 * Main function to run the examples.
 */
async function main() {
  const realApiKey = process.env.OPENAI_API_KEY;
  const realApiUrl = 'https://api.openai.com/v1/chat/completions';

  // --- Example 1: Using the mock server ---
  const mockServer = createMockServer();
  const mockPort = 3000;
  const mockApiUrl = `http://localhost:${mockPort}/v1/chat/completions`;

  await new Promise(resolve => mockServer.listen(mockPort, resolve));
  console.log(`Mock server running at ${mockApiUrl}`);

  await processOpenAIStream(mockApiUrl, null);

  mockServer.close();
  console.log('\nMock server stopped.');

  // --- Example 2: Using the real OpenAI API (if key is provided) ---
  if (realApiKey) {
    console.log('\n--- Found OPENAI_API_KEY environment variable. Running real API example. ---');
    await processOpenAIStream(realApiUrl, realApiKey);
  } else {
    console.log('\n--- Skipping real API example: OPENAI_API_KEY environment variable not set. ---');
    console.log('To run the real example, set your key: export OPENAI_API_KEY="your_key_here"');
  }
}

main().catch(console.error);