# LLM Stream Multiplexer

[![npm version](https://img.shields.io/npm/v/llm-stream-multiplexer.svg)](https://www.npmjs.com/package/llm-stream-multiplexer)
[![Node.js CI](https://img.shields.io/github/actions/workflow/status/your-username/llm-stream-multiplexer/node.js.yml?branch=main)](https://github.com/your-username/llm-stream-multiplexer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Node.js library for managing multiple concurrent streaming AI responses. It multiplexes several LLM provider streams (e.g., from OpenAI, Anthropic) into a single, structured output stream, making it ideal for building AI UIs that show multiple agent responses simultaneously. It handles individual stream errors, timeouts, and completion, providing a robust and unified interface.

## Features

-   **Multiplex Streams**: Combine multiple AI provider streams into a single structured output stream.
-   **Unique IDs**: Assigns unique IDs to each source stream for easy client-side tracking.
-   **Efficient Updates**: Uses JSON Patch (RFC 6902) for efficient delta updates of the combined output.
-   **Error Isolation**: Handles individual stream errors and timeouts without terminating the entire multiplexer.
-   **Dynamic Management**: Supports adding streams dynamically to a running multiplexer.
-   **Structured Events**: Emits events for stream start, data, error, and end.
-   **Modern & Pure ESM**: A pure ESM module compatible with Node.js 20+ async iterators.

## Installation

Install the package using npm:

```bash
npm install llm-stream-multiplexer
```

## Usage

The `Multiplexer` is an async iterable. You can add multiple AI provider streams and then consume the multiplexed output using a `for await...of` loop. The loop yields arrays of JSON Patch operations that describe changes to the combined state.

On the client side, you apply these patches to a local state object to keep it in sync.

### API Overview

1.  **`new Multiplexer(options)`**: Creates a new multiplexer instance.
    -   `options.updateIntervalMs`: How often to check for state changes (default: `50`).
2.  **`multiplexer.addStream(streamLike, options)`**: Adds a stream to be managed.
    -   `streamLike`: A Node.js `Readable` stream, a Web Stream (`Response.body`), or any `AsyncIterable`.
    -   `options.id`: A custom ID for the stream (a UUID is generated if omitted).
    -   `options.timeoutMs`: Timeout between data chunks (default: `30000`).
    -   `options.metadata`: An arbitrary object to attach to the stream's state.
3.  **`for await (const patches of multiplexer)`**: Consumes the output stream of JSON Patch operations.
4.  **`multiplexer.close()`**: Gracefully closes the multiplexer and all streams.

### JSON Patch Output Structure

The multiplexer maintains a combined state object. The JSON patches describe how to update your client-side copy of this state. The state has the following structure:

```json
{
  "sources": {
    "stream-id-1": {
      "id": "stream-id-1",
      "status": "streaming" | "completed" | "error" | "timed_out",
      "content": "The accumulated text from the stream...",
      "error": null | { "name": "ErrorName", "message": "..." },
      "metadata": { "key": "value" }
    },
    "stream-id-2": {
      /* ... state for another stream ... */
    }
  }
}
```

## Examples

### 1. Basic Usage: Combining Two Streams

This example shows how to initialize the multiplexer with two simulated AI streams and consume the resulting JSON Patch output.

```javascript
// examples/basic-usage.js
import { applyPatch } from 'fast-json-patch';
import { Multiplexer } from 'llm-stream-multiplexer';
import { createMockProviderStream } from './mock-provider.js'; // A helper from the examples

async function main() {
  // This object represents your client-side state.
  let clientState = { sources: {} };

  // 1. Create a new Multiplexer instance.
  const multiplexer = new Multiplexer();

  // 2. Create and add two mock AI provider streams.
  const stream1 = createMockProviderStream('Agent one is analyzing the data.');
  const stream2 = createMockProviderStream('Agent two offers a counter-point.');
  multiplexer.addStream(stream1, { metadata: { agentName: 'Agent One' } });
  multiplexer.addStream(stream2, { metadata: { agentName: 'Agent Two' } });

  console.log('Consuming patch stream...');

  // 3. Consume the multiplexer's output stream.
  for await (const patches of multiplexer) {
    // 4. Apply the patches to the local client state.
    applyPatch(clientState, patches, true);

    // 5. Render the updated state (e.g., in your UI).
    console.clear();
    console.log(JSON.stringify(clientState, null, 2));
  }

  console.log('\nMultiplexer stream has completed.');
}

main();
```

**Expected Output (final state):**

```json
{
  "sources": {
    "b2d3f4a5-...": {
      "id": "b2d3f4a5-...",
      "status": "completed",
      "content": "Agent one is analyzing the data.",
      "error": null,
      "metadata": { "agentName": "Agent One" }
    },
    "c1e4g5b6-...": {
      "id": "c1e4g5b6-...",
      "status": "completed",
      "content": "Agent two offers a counter-point.",
      "error": null,
      "metadata": { "agentName": "Agent Two" }
    }
  }
}
```

### 2. Advanced: Dynamically Adding a Stream

This example shows how to add a new AI stream to an already running multiplexer.

```javascript
// examples/dynamic-add-stream.js
import { applyPatch } from 'fast-json-patch';
import { Multiplexer } from 'llm-stream-multiplexer';
import { createMockProviderStream } from './mock-provider.js';

async function main() {
  let clientState = { sources: {} };
  const multiplexer = new Multiplexer();

  // Add the initial stream.
  const stream1 = createMockProviderStream('Agent Alpha is online.');
  multiplexer.addStream(stream1, { metadata: { agentName: 'Agent Alpha' } });

  // After 2 seconds, dynamically add a second stream.
  setTimeout(() => {
    console.log('\n>>> Dynamically adding Agent Bravo... <<<\n');
    const stream2 = createMockProviderStream('Agent Bravo, joining the session.');
    multiplexer.addStream(stream2, { metadata: { agentName: 'Agent Bravo' } });
  }, 2000);

  // The loop will seamlessly handle the new stream's patches.
  for await (const patches of multiplexer) {
    applyPatch(clientState, patches, true);
    console.clear();
    console.log(JSON.stringify(clientState, null, 2));
  }

  console.log('\nMultiplexer stream has completed.');
}

main();
```

The output will first show only "Agent Alpha", and after two seconds, "Agent Bravo" will appear and start streaming its content alongside the first agent. The client code doesn't need any special logic; it just keeps applying the patches.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.