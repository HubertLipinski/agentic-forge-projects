/**
 * @file src/index.js
 * @description Main entry point for the Job Queue Manager application.
 * This script serves as a dispatcher, starting either the API server or the
 * background worker process based on the command-line arguments provided.
 * It also handles basic argument validation and provides usage instructions.
 *
 * To start the server: `node src/index.js server`
 * To start the worker: `node src/index.js worker`
 */

import 'dotenv/config'; // Load environment variables from .env file
import pino from 'pino';

// --- Logger Initialization ---
// A top-level logger for the entry point script itself.
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
    },
  },
}).child({ module: 'main-index' });

/**
 * Displays usage instructions and exits the process.
 * This is called when the script is run with invalid or no arguments.
 */
function showUsageAndExit() {
  console.error(`
  Usage: node src/index.js <command>

  Commands:
    server    Start the Job Queue API server.
    worker    Start a background job processor worker.

  Example:
    node src/index.js server
  `);
  process.exit(1);
}

/**
 * The main asynchronous function that parses arguments and starts the
 * appropriate process (server or worker).
 *
 * This function uses dynamic imports (`await import(...)`) to load the server or
 * worker code only when needed. This improves startup performance and reduces
 * the memory footprint for each specific process, as the server doesn't load
 * worker-specific logic and vice-versa.
 */
async function main() {
  // `process.argv` contains the full command-line invocation.
  //   - argv[0] is the path to the Node.js executable.
  //   - argv[1] is the path to the script being run.
  //   - argv[2] is the first actual argument.
  const command = process.argv[2];

  if (!command) {
    logger.error('No command provided.');
    showUsageAndExit();
  }

  try {
    switch (command.toLowerCase()) {
      case 'server':
        logger.info('Starting API server...');
        // Dynamically import and run the server's start function.
        const { start: startServer } = await import('./server.js');
        await startServer();
        break;

      case 'worker':
        logger.info('Starting background worker...');
        // Dynamically import and run the worker's start function.
        const { start: startWorker } = await import('./workers/job-processor.js');
        await startWorker();
        break;

      default:
        logger.error(`Unknown command: "${command}"`);
        showUsageAndExit();
    }
  } catch (error) {
    logger.fatal({ err: error }, `A critical error occurred during startup for command "${command}".`);
    // A non-zero exit code indicates an abnormal termination.
    process.exit(1);
  }
}

// Execute the main function.
main();