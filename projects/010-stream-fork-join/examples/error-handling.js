/**
 * @file examples/error-handling.js
 * @description Shows how errors in one of the forked streams are propagated and handled by the main pipeline.
 *
 * This example demonstrates the library's error handling capabilities. We set up a
 * pipeline with two forks: one that works correctly and another that is designed
 * to throw an error after processing a few items.
 *
 * We will run this scenario twice to showcase the two main error handling strategies
 * controlled by the `abortOnError` option:
 *
 * 1.  `abortOnError: true` (Default): When the faulty stream throws an error, the
 *     entire pipeline is immediately destroyed. The source stream stops, and the
 *     other, healthy fork is also terminated. This is the "fail-fast" approach.
 *
 * 2.  `abortOnError: false`: When the faulty stream throws an error, it is destroyed,
 *     but the rest of the pipeline continues to run. The source stream keeps flowing,
 *     and the healthy fork will process all remaining data to completion.
 *
 * To run this example:
 * `node examples/error-handling.js`
 */

import { fork } from '../src/index.js';
import { Readable, Writable, pipeline } from 'node:stream';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

/**
 * Creates a simple source Readable stream that emits numbers.
 * @returns {Readable} A readable stream in object mode.
 */
function createNumberSourceStream() {
  return Readable.from([1, 2, 3, 4, 5], { objectMode: true });
}

/**
 * Creates a Writable stream that processes data successfully.
 * It logs each chunk it receives to the console.
 * @param {string} name - A name for the stream for logging purposes.
 * @returns {Writable} A writable stream in object mode.
 */
function createHealthyTarget(name) {
  return new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
      console.log(`[${name}]: Received chunk: ${chunk}`);
      // Simulate some async work
      setTimeout(() => {
        callback();
      }, 20);
    },
    destroy(err, callback) {
      console.log(`[${name}]: Stream destroyed ${err ? `with error: ${err.message}` : 'cleanly'}.`);
      callback(err);
    },
  });
}

/**
 * Creates a Writable stream that is designed to fail.
 * It will process a few chunks successfully and then emit an error.
 * @param {string} name - A name for the stream for logging purposes.
 * @param {number} failOnChunk - The chunk number on which to fail.
 * @returns {Writable} A writable stream in object mode.
 */
function createFaultyTarget(name, failOnChunk) {
  let chunkCount = 0;
  return new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
      chunkCount++;
      console.log(`[${name}]: Received chunk: ${chunk}`);

      if (chunkCount >= failOnChunk) {
        const error = new Error(`[${name}]: Simulated processing failure on chunk #${chunkCount}.`);
        // Use nextTick to ensure the error is emitted asynchronously,
        // which more closely mimics real-world I/O errors.
        process.nextTick(() => callback(error));
      } else {
        // Simulate some async work
        setTimeout(() => {
          callback();
        }, 10);
      }
    },
    destroy(err, callback) {
      console.log(`[${name}]: Stream destroyed ${err ? `with error: ${err.message}` : 'cleanly'}.`);
      callback(err);
    },
  });
}

/**
 * Runs the error handling demonstration with a specific `abortOnError` setting.
 * @param {boolean} abortOnError - The error handling strategy to use.
 */
async function runDemonstration(abortOnError) {
  console.log(`\n--- Running with abortOnError: ${abortOnError} ---`);

  const source = createNumberSourceStream();
  const healthyFork = createHealthyTarget('HealthyFork');
  const faultyFork = createFaultyTarget('FaultyFork', 3);

  // Create the fork multiplexer with the specified error handling option.
  const multiplexer = fork([healthyFork, faultyFork], {
    objectMode: true,
    abortOnError,
  });

  try {
    // Use stream.pipeline for robust error propagation and cleanup.
    await pipelineAsync(source, multiplexer);
    console.log('✅ Pipeline finished without throwing an error.');
  } catch (error) {
    console.error(`\n❌ Pipeline caught an error as expected: "${error.message}"`);
    if (abortOnError) {
      console.log('-> Behavior: With abortOnError=true, the healthy fork was also destroyed.');
    } else {
      console.log('-> Behavior: With abortOnError=false, the error was contained to the faulty fork.');
    }
  }
}

/**
 * Main function to run both error handling scenarios.
 */
async function runErrorHandlingExample() {
  console.log('====== Error Handling Example ======');
  console.log('This example demonstrates how the pipeline behaves when a fork fails.');

  // Scenario 1: Default behavior (abortOnError: true)
  // An error in one fork should stop the entire pipeline.
  await runDemonstration(true);

  console.log('\n'.padEnd(81, '='));

  // Scenario 2: Permissive behavior (abortOnError: false)
  // An error in one fork should allow the other forks to continue.
  // The overall pipeline will still fail, but not before the healthy streams finish.
  await runDemonstration(false);

  console.log('\n====== Example Complete ======');
}

// Execute the main function.
runErrorHandlingExample().catch(err => {
  console.error('An unexpected top-level error occurred:', err);
  process.exitCode = 1;
});