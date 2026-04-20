#!/usr/bin/env node

/**
 * @file bin/git-pr-metrics.js
 * @description The executable entry point for the git-pr-metrics CLI.
 * This file is responsible for setting up the Node.js environment and
 * invoking the main CLI application logic defined in `src/cli.js`.
 */

import { setupCli } from '../src/cli.js';

/**
 * The main execution function for the CLI.
 * It sets up the command-line interface and parses the process arguments.
 * Yargs handles the command execution and argument parsing internally.
 *
 * This structure keeps the executable file minimal and delegates all
 * complex logic to the main application source files.
 */
function main() {
  try {
    // setupCli() configures yargs with all commands, options, and handlers.
    // .parse() triggers yargs to read `process.argv`, validate arguments,
    // and execute the appropriate command handler (in our case, the `run` function).
    setupCli().parse();
  } catch (error) {
    // This is a top-level catch block for any synchronous errors that might
    // occur during the CLI setup phase itself, before the main async `run`
    // function is even called. For example, an issue within yargs configuration.
    console.error(
      `A critical error occurred while initializing the CLI: ${error.message}`,
    );
    process.exit(1);
  }
}

// Execute the main function to start the application.
main();