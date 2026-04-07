/**
 * @file examples/log-splitter.js
 * @description Example script demonstrating how to split a single log stream into separate files
 *              for errors, warnings, and general info based on log content.
 *
 * This script simulates a stream of log entries and uses the StreamRouter to direct
 * each log line to the appropriate file ('errors.log', 'warnings.log', 'info.log').
 * It showcases the use of the 'regex' rule engine for text-based routing.
 *
 * To run this example:
 * 1. Ensure you are in the root directory of the project.
 * 2. Execute the command: `npm run example:log-splitter`
 * 3. Check the `examples/` directory for the generated log files: `errors.log`,
 *    `warnings.log`, and `info.log`.
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { pipeline, Readable } from 'node:stream';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import the factory function from the local project index.
// In a real application, you would use: import createStreamRouter from 'stream-router-js';
import { createStreamRouter } from '../index.js';

// Convert a stream pipeline into a promise-based function for cleaner async/await usage.
const pipelineAsync = promisify(pipeline);

// Get the directory name of the current module.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 1. Define Log Data and Source Stream ---

// A sample array of log entries to be streamed.
const logEntries = [
  'INFO: Application starting up...',
  'INFO: Database connection successful.',
  'WARN: Configuration value "timeout" is deprecated. Please use "requestTimeout".',
  'INFO: User "admin" logged in.',
  'ERROR: Failed to process request #123. Reason: Connection refused.',
  'FATAL: Unrecoverable error in subsystem "payment-gateway". Shutting down.',
  'DEBUG: Payload for request #123: { "user": "guest" }', // This will go to info.log
  'WARN: High memory usage detected: 95%.',
  'INFO: Processing complete.',
  'ERROR: Invalid credentials for user "testuser".',
];

/**
 * Creates a readable stream that emits our sample log entries.
 * In a real-world scenario, this could be `process.stdin`, a file stream from
 * `fs.createReadStream`, or a stream from a logging agent.
 * @returns {Readable} A readable stream of log lines.
 */
function createLogSourceStream() {
  return Readable.from(logEntries.map(line => `${new Date().toISOString()} - ${line}\n`));
}

// --- 2. Define Destination Writable Streams ---

// Define paths for our output log files.
const errorLogPath = path.join(__dirname, 'errors.log');
const warningLogPath = path.join(__dirname, 'warnings.log');
const infoLogPath = path.join(__dirname, 'info.log');

/**
 * Creates the destination writable streams for our categorized logs.
 * @returns {{errorLog: import('fs').WriteStream, warningLog: import('fs').WriteStream, infoLog: import('fs').WriteStream}}
 */
function createDestinationStreams() {
  try {
    const errorLog = createWriteStream(errorLogPath, { flags: 'a' });
    const warningLog = createWriteStream(warningLogPath, { flags: 'a' });
    const infoLog = createWriteStream(infoLogPath, { flags: 'a' });

    // Add error handlers to prevent unhandled exceptions from crashing the process.
    errorLog.on('error', (err) => console.error('Error writing to errors.log:', err));
    warningLog.on('error', (err) => console.error('Error writing to warnings.log:', err));
    infoLog.on('error', (err) => console.error('Error writing to info.log:', err));

    return { errorLog, warningLog, infoLog };
  } catch (error) {
    console.error('Failed to create destination log files:', error);
    process.exit(1);
  }
}

// --- 3. Configure and Create the Stream Router ---

/**
 * Defines the routing rules and creates the StreamRouter instance.
 * @param {object} destinations - An object containing the writable streams.
 * @returns {import('../lib/stream-router.js').StreamRouter} The configured router instance.
 */
function setupRouter(destinations) {
  const { errorLog, warningLog, infoLog } = destinations;

  // Define the rules for routing. We'll use regular expressions to match log levels.
  const routingRules = [
    {
      name: 'error-rule',
      type: 'regex',
      // This regex matches any line containing 'ERROR' or 'FATAL'.
      expression: 'ERROR|FATAL',
      destination: errorLog,
    },
    {
      name: 'warning-rule',
      type: 'regex',
      // This regex matches any line containing 'WARN' or 'WARNING'.
      expression: 'WARN|WARNING',
      destination: warningLog,
    },
  ];

  // Create the router instance.
  const router = createStreamRouter({
    rules: routingRules,
    // We use a default destination for any log that doesn't match the error or warning rules.
    // This ensures all logs are captured somewhere.
    defaultDestination: infoLog,
  });

  // Listen for metrics to see the final counts.
  router.on('finish', () => {
    console.log('\n--- Routing Metrics ---');
    const metrics = router.getMetrics();
    console.log(`Total Chunks Processed: ${metrics.totalChunksProcessed}`);
    console.log(`Chunks Routed to Errors: ${metrics.rules['error-rule'].routed}`);
    console.log(`Chunks Routed to Warnings: ${metrics.rules['warning-rule'].routed}`);
    console.log(`Chunks Routed to Info (Default): ${metrics.default.routed}`);
    console.log('-----------------------\n');
  });

  return router;
}

// --- 4. Main Execution Logic ---

/**
 * Cleans up old log files before running the example.
 */
async function cleanupOldLogs() {
  console.log('Cleaning up previous log files...');
  const filesToDelete = [errorLogPath, warningLogPath, infoLogPath];
  const promises = filesToDelete.map(file =>
    rm(file, { force: true, recursive: false }).catch(err => {
      // Ignore 'file not found' errors, but log others.
      if (err.code !== 'ENOENT') {
        console.warn(`Could not delete ${file}: ${err.message}`);
      }
    })
  );
  await Promise.all(promises);
}

/**
 * The main function to set up and run the log splitting pipeline.
 */
async function main() {
  try {
    await cleanupOldLogs();

    console.log('Starting log splitting example...');

    // 1. Create the source stream.
    const sourceStream = createLogSourceStream();

    // 2. Create the destination streams.
    const destinationStreams = createDestinationStreams();

    // 3. Set up the router.
    const logRouter = setupRouter(destinationStreams);

    // 4. Set up the stream pipeline: source -> router.
    // The router internally handles writing to the destination streams.
    console.log('Piping log source through the router...');
    await pipelineAsync(sourceStream, logRouter);

    console.log('Pipeline finished successfully!');
    console.log(`Log files created:\n- ${errorLogPath}\n- ${warningLogPath}\n- ${infoLogPath}`);

  } catch (error) {
    console.error('An error occurred during the stream pipeline:', error);
    process.exit(1);
  }
}

// Execute the main function.
main();