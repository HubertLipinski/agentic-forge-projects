# LLM Stream Parser

A lightweight, zero-dependency Node.js utility for parsing and normalizing streaming responses from various Large Language Models (LLMs) like OpenAI, Anthropic, and Google Gemini. It handles different streaming formats (SSE, chunked JSON) and provides a consistent, asynchronous iterable interface for developers building real-time AI applications.

[![npm version](https://badge.fury.io/js/llm-stream-parser.svg)](https://badge.fury.io/js/llm-stream-parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Description

Working with streaming LLM responses can be complex. Each provider (OpenAI, Anthropic, Google, etc.) has its own unique data format, event types, and termination signals. This often leads to repetitive, provider-specific parsing logic in your application.

`llm-stream-parser` solves this by providing a single, unified interface. It abstracts away the complexities of different stream formats, allowing you to consume data from any supported LLM using a simple `for await...of` loop.

## Features

-   **Unified Interface**: Parses Server-Sent Events (SSE) and chunked JSON streams into a consistent `NormalizedChunk` object.
-   **Multi-Provider Support**: Built-in adapters for OpenAI (Chat & Completions), Anthropic (Messages), and Google Gemini.
-   **Async Iterator**: Provides a standard `for await...of` loop for easy consumption of stream events.
-   **Automatic Termination**: Detects and handles provider-specific stream termination signals (e.g., OpenAI's `[DONE]`).
-   **Robust Error Handling**: Custom `StreamError` class provides detailed context for parsing failures and provider errors.
-   **Lightweight & Zero-Dependency**: No runtime dependencies, ensuring minimal footprint and easy integration.
-   **Extensible**: Simple adapter architecture makes it easy to add support for new LLM providers.

## Installation

You can install the package using npm or yarn:

```bash
npm install llm-stream-parser
```

Or, if you prefer to clone the repository:

```bash
git clone https://github.com/your-username/llm-stream-parser.git
cd llm-stream-parser
npm install
```

## Usage

The primary way to use the library is with the `createStreamParser` factory function.

1.  **Import** `createStreamParser` and the adapter for your LLM provider.
2.  **Create a parser instance**, passing it an instance of the adapter.
3.  **Fetch a stream** from your LLM provider using a library like `undici` or `node-fetch`.
4.  **Parse the stream** by passing the response body to the `parser.parse()` method.
5.  **Iterate over the results** using a `for await...of` loop.

```javascript
import { request } from 'undici';
import { createStreamParser, OpenAIAdapter } from 'llm-stream-parser';

// 1. Create a configured parser instance
const parser = createStreamParser({
  adapter: new OpenAIAdapter(),
  isSSE: true, // OpenAI uses Server-Sent Events
});

async function getOpenAICompletion() {
  // 2. Fetch a stream from the OpenAI API
  const { body: stream } = await request('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Tell me a short story.' }],
      stream: true,
    }),
  });

  let fullResponse = '';
  console.log('--- Streaming Response ---');

  try {
    // 3. Parse the stream and iterate over the normalized chunks
    for await (const chunk of parser.parse(stream)) {
      // chunk is a NormalizedChunk: { id, event, data, done, raw }
      if (chunk.data) {
        process.stdout.write(chunk.data);
        fullResponse += chunk.data;
      }
    }

    console.log('\n\n--- Stream Complete ---');
    console.log('Reconstructed response:', fullResponse);

  } catch (error) {
    console.error('\n\n--- Error Parsing Stream ---', error);
  }
}

getOpenAICompletion();
```

Each `chunk` yielded by the parser is a `NormalizedChunk` object with the following structure:

```typescript
interface NormalizedChunk {
  id: string | null;      // A unique identifier for the stream or event
  event: string | null;   // The type of event (e.g., 'completion', 'message_delta')
  data: string | null;    // The primary content payload (the text)
  done: boolean;          // True if this is the final chunk
  raw: object | null;     // The original, unprocessed JSON object from the provider
}
```

## Examples

### Example 1: OpenAI Stream

This example demonstrates parsing a stream from OpenAI's Chat Completions API.

```javascript
// examples/openai-stream-example.js
import { request } from 'undici';
import { createStreamParser, OpenAIAdapter } from 'llm-stream-parser';

const parser = createStreamParser({ adapter: new OpenAIAdapter() });

const { body: stream } = await request('https://api.openai.com/v1/chat/completions', {
  // ... request options
});

for await (const chunk of parser.parse(stream)) {
  if (chunk.data) {
    process.stdout.write(chunk.data);
  }
}
```

**Expected Output:**

```
Once upon a time, in a forest woven with silver moonlight, lived a tiny fox with a coat the color of autumn leaves...
```

### Example 2: Anthropic (Claude) Stream

This example shows how to use the `AnthropicAdapter` to parse a stream from Anthropic's Messages API. Note the use of the `x-api-key` header.

```javascript
// examples/anthropic-stream-example.js
import { request } from 'undici';
import { createStreamParser, AnthropicAdapter } from 'llm-stream-parser';

const parser = createStreamParser({ adapter: new AnthropicAdapter() });

const { body: stream } = await request('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
  },
  body: JSON.stringify({
    model: 'claude-3-opus-20240229',
    messages: [{ role: 'user', content: 'Why is the sky blue?' }],
    stream: true,
  }),
});

for await (const chunk of parser.parse(stream)) {
  if (chunk.data) {
    process.stdout.write(chunk.data);
  }
}
```

**Expected Output:**

```
The sky appears blue because of a phenomenon called Rayleigh scattering. As sunlight enters Earth's atmosphere, it collides with tiny oxygen and nitrogen molecules...
```

### Example 3: Google Gemini Stream

Google Gemini uses a non-SSE, newline-delimited JSON stream. To handle this, set the `isSSE` option to `false`.

```javascript
// examples/gemini-stream-example.js
import { request } from 'undici';
import { createStreamParser, GeminiAdapter } from 'llm-stream-parser';

// Note: isSSE is set to false for Gemini
const parser = createStreamParser({
  adapter: new GeminiAdapter(),
  isSSE: false,
});

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?key=${apiKey}`;

const { body: stream } = await request(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Explain quantum computing in simple terms.' }] }],
  }),
});

for await (const chunk of parser.parse(stream)) {
  if (chunk.data) {
    process.stdout.write(chunk.data);
  }
}
```

**Expected Output:**

```
Imagine a regular computer bit, which is like a light switch that can be either on (1) or off (0). A quantum computer uses "qubits," which are like dimmer switches...
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.