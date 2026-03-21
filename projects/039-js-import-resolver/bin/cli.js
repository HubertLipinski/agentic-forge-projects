#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The executable entry point for the JS Import Resolver command-line tool.
 * This file is linked by npm's `bin` field in `package.json` and is responsible
 * for bootstrapping and running the main CLI application.
 *
 * It ensures that the application runs with proper error handling at the top level,
 * catching any unhandled promise rejections or uncaught exceptions that might
 * otherwise crash the process silently.
 */

import pc from 'picocolors';
import { run } from '../src/cli.js';

/**
 * A top-level error handler to gracefully manage unexpected process-wide errors.
 * This ensures that if any part of the application throws an unhandled error,
 * it is logged in a user-friendly format, and the process exits with a non-zero
 * status code, which is crucial for scripting and CI/CD environments.
 *
 * @param {Error} error - The uncaught exception or unhandled rejection error.
 */
function handleProcessError(error) {
  console.error(`\n${pc.bgRed(pc.white(' UNEXPECTED ERROR '))}`);
  console.error(pc.red('An unhandled error occurred. This might be a bug in js-import-resolver.'));
  console.error(pc.red('Please report this issue on GitHub if it persists.'));
  console.error('\n--- Error Details ---');
  console.error(error);
  console.error('---------------------\n');
  process.exit(1);
}

// Register global error handlers to catch any unexpected issues.
process.on('uncaughtException', handleProcessError);
process.on('unhandledRejection', handleProcessError);

// The main execution function. It immediately invokes the `run` function
// from the main CLI module.
(async () => {
  try {
    // The `run` function in `src/cli.js` configures and executes yargs.
    // Yargs handles its own command execution and error reporting for known cases.
    await run();
  } catch (error) {
    // This catch block is a final safeguard for any synchronous or asynchronous
    // errors that might bubble up from the `run` function itself, although
    // the global handlers above are the primary safety net.
    handleProcessError(error);
  }
})();