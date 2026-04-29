/**
 * @file examples/basic-usage.js
 * @description A simple example demonstrating how to use the LLM Stream Multiplexer.
 *
 * This script initializes a Multiplexer, adds two simulated AI provider streams,
 * and then consumes the resulting JSON Patch output. It shows how to apply these
 * patches to a local state object to reconstruct the combined view of all streams,
 * logging the state to the console after each update.
 */

import { applyPatch } from 'fast-json-patch';
import { Multiplexer } from '../src/index.js';
import { createMockProviderStream } from './mock-provider.js';

// A simple utility to clear the console for a cleaner output display.
const clearConsole = () => {
  process.stdout.write(
    process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H'
  );
};

/**
 * Renders the current state of the streams to the console.
 * @param {object} state - The combined state object from the multiplexer.
 */
function renderState(state) {
  clearConsole();
  console.log('--- LLM Stream Multiplexer ---');
  console.log('Current Combined State:\n');

  if (!state.sources || Object.keys(state.sources).length === 0) {
    console.log('No streams are currently being processed.');
    return;
  }

  for (const source of Object.values(state.sources)) {
    console.log(`[${source.id}]`);
    console.log(`  Status: ${source.status}`);
    console.log(`  Content: "${source.content}"`);
    if (source.error) {
      console.log(`  Error: ${source.error.name} - ${source.error.message}`);
    }
    console.log('---------------------------------');
  }
}

/**
 * The main asynchronous function to run the example.
 */
async function main() {
  console.log('Initializing LLM Stream Multiplexer...');

  // This object represents the client-side state. It will be updated
  // by applying the JSON patches received from the multiplexer.
  let clientState = { sources: {} };

  // 1. Create a new Multiplexer instance.
  const multiplexer = new Multiplexer();

  // 2. Create two mock AI provider streams.
  // These simulate real-time responses from different LLMs.
  const stream1 = createMockProviderStream(
    'This is the first agent, providing its analysis.',
    { chunkDelayMs: 60 }
  );
  const stream2 = createMockProviderStream(
    'Meanwhile, the second agent offers a different perspective.',
    { chunkDelayMs: 75 }
  );

  // 3. Add the streams to the multiplexer.
  // We can assign custom metadata to each stream for client-side use.
  multiplexer.addStream(stream1, { metadata: { agentName: 'Agent One' } });
  multiplexer.addStream(stream2, { metadata: { agentName: 'Agent Two' } });

  console.log('Streams added. Consuming patch stream...\n');

  try {
    // 4. Consume the multiplexer's output stream.
    // The multiplexer is an async iterable that yields arrays of JSON patches.
    for await (const patches of multiplexer) {
      // 5. Apply the patches to the local client state.
      // The `applyPatch` function mutates the object in place.
      // The `true` flag validates each patch operation.
      applyPatch(clientState, patches, true);

      // 6. Render the updated state to the console.
      renderState(clientState);
    }

    console.log('\nMultiplexer stream has completed.');
    // Final render to show the completed state.
    renderState(clientState);

  } catch (error) {
    console.error('\nAn unexpected error occurred while consuming the multiplexer stream:', error);
  }
}

// Execute the main function and handle any top-level errors.
main().catch(error => {
  console.error('Failed to run basic usage example:', error);
  process.exit(1);
});