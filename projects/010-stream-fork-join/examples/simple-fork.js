/**
 * @file examples/simple-fork.js
 * @description Demonstrates the basic `fork` functionality of the stream-fork-join utility.
 *
 * This example sets up a simple pipeline to showcase how to take a single readable
 * stream and "fork" its contents into two separate writable streams. In this case,
 * we generate some sample log data and write it simultaneously to `file-a.log` and
 * `file-b.log`.
 *
 * This pattern is useful for scenarios like:
 * - Writing raw data to a backup file while also sending it to a processing stream.
 * - Sending a data stream to multiple microservices at the same time.
 * - Archiving data and indexing it in parallel.
 *
 * To run this example:
 * `node examples/simple-fork.js`
 *
 * After running, you can inspect the contents of `file-a.log` and `file-b.log` in the
 * `examples/output` directory. They should be identical.
 */

import { fork } from '../src/index.js';
import { createWriteStream, promises as fsPromises } from 'node:fs';
import { Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join as joinPath } from 'node:path';

// Helper to use stream.pipeline with async/await
const pipelineAsync = promisify(pipeline);

// Determine the directory of the current module to write output files
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = joinPath(__dirname, 'output');
const FILE_A_PATH = joinPath(OUTPUT_DIR, 'file-a.log');
const FILE_B_PATH = joinPath(OUTPUT_DIR, 'file-b.log');

/**
 * Generates a simple readable stream of log entries.
 * @returns {Readable} A readable stream that emits several string lines.
 */
function createLogStream() {
  return Readable.from([
    `[${new Date().toISOString()}] INFO: Application starting up.\n`,
    `[${new Date().toISOString()}] DEBUG: Configuration loaded.\n`,
    `[${new Date().toISOString()}] INFO: Processing request #123.\n`,
    `[${new Date().toISOString()}] WARN: High memory usage detected.\n`,
    `[${new Date().toISOString()}] INFO: Request #123 completed.\n`,
    `[${new Date().toISOString()}] INFO: Shutting down.\n`,
  ]);
}

/**
 * Main function to set up and run the simple fork example.
 */
async function runSimpleForkExample() {
  console.log('--- Simple Fork Example ---');
  console.log('This example will write a single source stream to two files concurrently.');

  try {
    // 1. Ensure the output directory exists.
    await fsPromises.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`Output directory created/ensured at: ${OUTPUT_DIR}`);

    // 2. Create the source readable stream.
    const sourceStream = createLogStream();
    console.log('Source stream created.');

    // 3. Create the target writable streams (our forks).
    const fileAStream = createWriteStream(FILE_A_PATH);
    const fileBStream = createWriteStream(FILE_B_PATH);
    console.log(`Fork 1 writing to: ${FILE_A_PATH}`);
    console.log(`Fork 2 writing to: ${FILE_B_PATH}`);

    // 4. Create the fork multiplexer.
    // This is a Writable stream that will distribute data to all provided targets.
    const multiplexer = fork([fileAStream, fileBStream]);
    console.log('Fork multiplexer created.');

    // 5. Set up the stream pipeline.
    // This pipes data from the source, through the multiplexer, to the targets.
    // `pipeline` ensures that all streams are properly destroyed on error or completion.
    console.log('Piping source stream to the multiplexer...');
    await pipelineAsync(sourceStream, multiplexer);

    console.log('\n✅ Pipeline finished successfully!');
    console.log('Both file-a.log and file-b.log should now contain the same log data.');
    console.log('You can verify their contents in the examples/output/ directory.');

  } catch (error) {
    console.error('\n❌ An error occurred during the fork example:', error);
    process.exitCode = 1;
  }
}

// Execute the main function.
runSimpleForkExample();