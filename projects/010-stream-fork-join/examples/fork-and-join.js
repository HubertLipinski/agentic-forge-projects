/**
 * @file examples/fork-and-join.js
 * @description Demonstrates a complex pipeline using both `fork` and `join` functionality.
 *
 * This example showcases the full power of the fork-join pattern. It starts with a
 * readable stream of simple objects. This stream is then forked into two parallel
 * processing pipelines, each represented by a `Transform` stream.
 *
 * - The first transform (`toUpperCaseTransform`) converts a string property to uppercase.
 * - The second transform (`addTimestampTransform`) adds a processing timestamp to the object.
 *
 * The `join` function orchestrates this entire process. It pipes the source data to the
 * forks and creates a new readable stream that collects the results from both transforms.
 * The final output stream will emit the processed objects from both forks as they become
 * available. The order of the results is not guaranteed, reflecting the parallel nature
 * of the processing.
 *
 * This pattern is ideal for scenarios where a single data source needs to undergo
 * multiple independent, potentially time-consuming transformations or I/O operations
 * before the results are consolidated.
 *
 * To run this example:
 * `node examples/fork-and-join.js`
 */

import { join } from '../src/index.js';
import { Readable, Transform } from 'node:stream';

/**
 * Creates a source Readable stream that emits a series of objects.
 * This simulates a data source like a database query or an API feed.
 * @returns {Readable} A readable stream in object mode.
 */
function createObjectSourceStream() {
  const data = [
    { id: 1, message: 'hello world' },
    { id: 2, message: 'stream processing' },
    { id: 3, message: 'fork and join' },
    { id: 4, message: 'parallel data flow' },
  ];
  return Readable.from(data, { objectMode: true });
}

/**
 * Creates a Transform stream that converts the 'message' property of an object to uppercase.
 * It also adds a property to identify which transform processed the object.
 * @returns {Transform} A transform stream in object mode.
 */
function createUpperCaseTransform() {
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      try {
        // Defensive check for expected object structure
        if (typeof chunk?.message !== 'string') {
          return callback(new Error('Input chunk must have a "message" property of type string.'));
        }
        const transformedChunk = {
          ...chunk,
          message: chunk.message.toUpperCase(),
          processedBy: 'upperCase',
        };
        callback(null, transformedChunk);
      } catch (error) {
        callback(error);
      }
    },
  });
}

/**
 * Creates a Transform stream that adds a 'processedAt' timestamp to an object.
 * It also adds a property to identify which transform processed the object.
 * @returns {Transform} A transform stream in object mode.
 */
function createAddTimestampTransform() {
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      try {
        const transformedChunk = {
          ...chunk,
          processedAt: new Date().toISOString(),
          processedBy: 'addTimestamp',
        };
        // Simulate a slightly slower processing time for this fork
        setTimeout(() => {
          callback(null, transformedChunk);
        }, 10);
      } catch (error) {
        callback(error);
      }
    },
  });
}

/**
 * Main function to set up and run the fork-and-join example.
 */
async function runForkAndJoinExample() {
  console.log('--- Fork and Join Example ---');
  console.log('This example will fork a stream of objects into two parallel transforms and join the results.');

  try {
    // 1. Create the source stream.
    const sourceStream = createObjectSourceStream();
    console.log('\nSource objects:');
    console.log([
      { id: 1, message: 'hello world' },
      { id: 2, message: 'stream processing' },
      { id: 3, message: 'fork and join' },
      { id: 4, message: 'parallel data flow' },
    ]);


    // 2. Create the parallel processing streams (the forks).
    const transformA = createUpperCaseTransform();
    const transformB = createAddTimestampTransform();

    // 3. Use the `join` utility to create the entire pipeline.
    // `join` takes the source and an array of fork streams.
    // It returns a single readable stream that will emit the aggregated results.
    // We must specify `objectMode: true` as we are dealing with objects.
    const joinedStream = join(sourceStream, [transformA, transformB], { objectMode: true });
    console.log('\nPipeline created. Consuming results from the joined stream...');
    console.log('----------------------------------------------------------');


    // 4. Consume the final joined stream.
    // The data will be a mix of results from both transforms.
    // The order is non-deterministic, depending on which transform finishes first for each chunk.
    const results = [];
    for await (const data of joinedStream) {
      console.log('Received data:', data);
      results.push(data);
    }

    console.log('----------------------------------------------------------');
    console.log('\n✅ Pipeline finished successfully!');
    console.log(`Total objects received from joined stream: ${results.length}`);
    console.log('Notice how the output contains objects processed by both transforms.');

  } catch (error) {
    console.error('\n❌ An error occurred during the fork-and-join example:', error);
    process.exitCode = 1;
  }
}

// Execute the main function.
runForkAndJoinExample();