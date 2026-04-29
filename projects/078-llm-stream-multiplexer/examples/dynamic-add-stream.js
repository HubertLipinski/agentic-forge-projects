/**
 * @file examples/dynamic-add-stream.js
 * @description An advanced example showing how to add a new AI stream to an already running multiplexer instance.
 *
 * This script demonstrates the dynamic capabilities of the LLM Stream Multiplexer.
 * It starts by processing a single stream, and after a short delay, it adds a
 * second stream to the same multiplexer instance. The client-side logic seamlessly
 * handles the appearance of the new stream by applying the incoming JSON patches.
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
  console.log('--- LLM Stream Multiplexer (Dynamic Add Example) ---');
  console.log('Current Combined State:\n');

  if (!state.sources || Object.keys(state.sources).length === 0) {
    console.log('No streams are currently being processed.');
    return;
  }

  for (const source of Object.values(state.sources)) {
    console.log(`[${source.id}]`);
    console.log(`  Agent: ${source.metadata.agentName}`);
    console.log(`  Status: ${source.status}`);
    console.log(`  Content: "${source.content}"`);
    if (source.error) {
      console.log(`  Error: ${source.error.name} - ${source.error.message}`);
    }
    console.log('----------------------------------------------------');
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
  const multiplexer = new Multiplexer({ updateIntervalMs: 100 });

  // 2. Create the first mock AI provider stream.
  const stream1 = createMockProviderStream(
    'Agent Alpha is online and beginning its analysis. The situation appears to be stable.',
    { chunkDelayMs: 80, chunkSize: 4 }
  );

  // 3. Add the initial stream to the multiplexer.
  multiplexer.addStream(stream1, { metadata: { agentName: 'Agent Alpha' } });
  console.log('Initial stream added. Consuming patch stream...\n');

  // 4. Set a timeout to dynamically add a second stream after a delay.
  setTimeout(() => {
    console.log('\n>>> Dynamically adding a new stream... <<<\n');
    const stream2 = createMockProviderStream(
      'Agent Bravo, joining the session. My analysis indicates a new variable has been introduced.',
      { chunkDelayMs: 60, chunkSize: 3 }
    );
    try {
      multiplexer.addStream(stream2, { metadata: { agentName: 'Agent Bravo' } });
    } catch (error) {
      console.error('Failed to add second stream dynamically:', error);
    }
  }, 2500); // Add the second stream after 2.5 seconds.


  try {
    // 5. Consume the multiplexer's output stream.
    // The `for await...of` loop will continue to run and will automatically
    // start receiving patches for the new stream once it's added.
    for await (const patches of multiplexer) {
      // 6. Apply the patches to the local client state.
      // The patches will include 'add' operations for the new stream object
      // and subsequent 'replace' operations for its content.
      applyPatch(clientState, patches, true);

      // 7. Render the updated state to the console.
      renderState(clientState);
    }

    console.log('\nMultiplexer stream has completed.');
    // Final render to show the completed state.
    renderState(clientState);

  } catch (error) {
    console.error('\nAn unexpected error occurred while consuming the multiplexer stream:', error);
  } finally {
    // Ensure the multiplexer is closed to terminate the internal loop.
    multiplexer.close();
  }
}

// Execute the main function and handle any top-level errors.
main().catch(error => {
  console.error('Failed to run dynamic add stream example:', error);
  process.exit(1);
});