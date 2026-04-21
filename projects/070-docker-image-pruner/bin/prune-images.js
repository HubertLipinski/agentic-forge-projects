#!/usr/bin/env node

/**
 * bin/prune-images.js
 *
 * This is the executable entry point for the Docker Image Pruner CLI application.
 * It is referenced in the 'bin' field of the project's package.json.
 *
 * Its sole purpose is to set up the Node.js environment (via the shebang)
 * and kick off the main application logic located in `src/cli.js`. This separation
 * keeps the executable file minimal and clean, while the core CLI parsing and
 * orchestration logic resides in a testable module.
 */

import chalk from 'chalk';
import { main } from '../src/cli.js';

/**
 * A self-invoking async function that serves as the application's root.
 * This pattern allows for top-level await usage and provides a centralized
 * point for unhandled exception catching.
 */
(async () => {
  try {
    // Delegate all logic to the main function in the CLI module.
    await main();
  } catch (error) {
    // This is a final catch-all for any unexpected errors that might not have been
    // handled within the application's specific error-handling logic (e.g., in cli.js
    // or prune-engine.js). It ensures the process exits gracefully with an error message.
    console.error(chalk.red.bold('\nA critical and unexpected error occurred.'));
    console.error(chalk.red(`Message: ${error.message}`));

    // For debugging purposes, show the stack trace if available.
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }

    // Exit with a non-zero status code to indicate failure, which is important
    // for scripting and CI/CD environments.
    process.exit(1);
  }
})();