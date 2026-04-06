#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The main executable script for the pg-schema-snapshot CLI.
 *
 * This script configures and launches the yargs-based command-line interface.
 * It registers the `capture` and `diff` commands, handles global options,
 * provides help and usage information, and manages top-level error handling.
 * It serves as the entry point for all user interactions with the tool.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { disconnectClient } from '../src/utils/db-client.js';
import * as captureCommand from '../src/commands/capture.js';
import * as diffCommand from '../src/commands/diff.js';

/**
 * The main asynchronous function that sets up and runs the CLI.
 *
 * It configures yargs with the necessary commands, options, and error handling.
 * It ensures that the process exits gracefully, and in the case of the `capture`
 * command, it guarantees the database connection is closed.
 */
const main = async () => {
  try {
    const cli = yargs(hideBin(process.argv));

    cli
      .scriptName('pg-schema-snapshot')
      .usage('Usage: $0 <command> [options]')
      .command(captureCommand)
      .command(diffCommand)
      .demandCommand(1, 'You must specify a command: `capture` or `diff`.')
      .strict()
      .alias('h', 'help')
      .alias('v', 'version')
      .epilogue(
        'For more information, visit https://github.com/your-username/pg-schema-snapshot',
      )
      .fail((msg, err, yargsInstance) => {
        // This handler is invoked for argument validation errors (e.g., missing required args).
        console.error(`❌ Error: ${msg}\n`);
        console.error(yargsInstance.help());
        // Ensure that if a DB connection was somehow made before validation failed, it gets closed.
        // This is a defensive measure.
        disconnectClient().finally(() => {
          process.exit(1);
        });
      });

    // The `parse` method triggers the execution of the matched command's handler.
    // The handler itself is responsible for its own process.exit calls.
    await cli.parse();
  } catch (error) {
    // This top-level catch block handles unexpected, unhandled exceptions from
    // within the yargs setup or command execution lifecycle that were not
    // caught by the command handlers themselves.
    console.error('\n🔥 A critical unexpected error occurred:');
    if (error instanceof Error) {
      console.error(error.stack || error.message);
    } else {
      console.error(error);
    }

    // Attempt a final, graceful disconnection before exiting.
    await disconnectClient();
    process.exit(1);
  }
};

// Execute the main CLI function.
main();