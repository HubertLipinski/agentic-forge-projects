#!/usr/bin/env node

/**
 * @file bin/seed.js
 * @description The executable script for the CLI. This file makes the script
 * runnable from the command line (e.g., `json-file-seeder -- ...`).
 * It serves as the entry point, passing command-line arguments to the main
 * CLI logic and handling top-level process events like unhandled errors.
 */

// This shebang `#!/usr/bin/env node` ensures the script is executed with Node.js.

import { main } from '../src/cli.js';
import logger from '../src/utils/logger.js';

/**
 * An immediately-invoked function expression (IIFE) to start the CLI application.
 * This pattern allows us to use `async/await` at the top level of the script.
 */
(async () => {
  try {
    // Pass all command-line arguments, excluding the first two (node executable and script path),
    // to the main application logic.
    await main(process.argv.slice(2));

    // A zero exit code indicates success.
    process.exit(0);
  } catch (error) {
    // The `main` function and `runSeeder` are designed to log specific errors.
    // This top-level catch block handles any unhandled exceptions or re-thrown errors
    // that signify a fatal failure in the application.
    // The error message itself is often already logged by the time it gets here.
    // We log a final, simple message to indicate the process is terminating due to an error.
    logger.error('CLI process terminated due to a fatal error.');

    // A non-zero exit code signals to the shell that the script failed.
    process.exit(1);
  }
})();

/**
 * Graceful shutdown handling.
 * Listen for OS signals to ensure resources like database connections are closed properly
 * before the process exits unexpectedly.
 */
const handleShutdown = async (signal) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  // In a more complex application, you would trigger cleanup here (e.g., close open connections).
  // For this tool, the `finally` block in `src/cli.js` handles disconnection,
  // but this is good practice for robustness.
  process.exit(0);
};

process.on('SIGINT', handleShutdown); // Ctrl+C
process.on('SIGTERM', handleShutdown); // `kill` command

/**
 * Catch unhandled promise rejections.
 * This prevents the process from crashing silently on unhandled async errors.
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // It's generally recommended to exit on unhandled rejections as the application
  // state might be corrupted.
  process.exit(1);
});

/**
 * Catch uncaught exceptions.
 * This is a last resort for errors not caught by any try/catch block.
 */
process.on('uncaughtException', (error, origin) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(`Origin: ${origin}`);
  logger.error(error.stack);
  process.exit(1);
});