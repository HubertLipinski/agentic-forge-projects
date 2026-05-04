#!/usr/bin/env node

/**
 * @file bin/run-server.js
 * @description Executable script for the CLI, making the package runnable from the command line.
 * This script sets up and parses command-line arguments using 'yargs' to configure
 * and launch the Procedural Dungeon Net server. It serves as the main entry point
 * for running the application from a terminal.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { startServer } from '../src/index.js';

/**
 * Main function to parse arguments and start the server.
 * This is the core logic of the CLI executable.
 */
async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .command('$0', 'Start the Procedural Dungeon Net server', (yargs) => {
      return yargs
        .option('port', {
          alias: 'p',
          describe: 'TCP server port to listen on',
          type: 'number',
          default: 4242,
        })
        .option('host', {
          alias: 'h',
          describe: 'TCP server host to bind to',
          type: 'string',
          default: '0.0.0.0',
        })
        .option('snapshot-interval', {
          describe: 'Interval in seconds for saving world state snapshots',
          type: 'number',
          default: 300, // 5 minutes
        })
        .option('snapshot-path', {
          describe: 'Path to the world state snapshot file',
          type: 'string',
          default: './world-state.json',
        })
        .option('load-snapshot', {
          describe: 'Load world state from the snapshot file on startup',
          type: 'boolean',
          default: true,
        })
        .option('tick-rate', {
          describe: 'Game engine tick rate in milliseconds',
          type: 'number',
          default: 100, // 10 ticks per second
        })
        .option('seed', {
          alias: 's',
          describe: 'Seed for deterministic dungeon generation (if no snapshot is loaded)',
          type: 'number',
          // Use a default seed for consistency if not specified
          default: Math.floor(Math.random() * 1000000),
        })
        .option('width', {
          alias: 'w',
          describe: 'Width of the generated dungeon',
          type: 'number',
          default: 80,
        })
        .option('height', {
          describe: 'Height of the generated dungeon',
          type: 'number',
          default: 50,
        });
    })
    .help('help')
    .alias('help', '?')
    .version()
    .alias('version', 'v')
    .epilog('For more information, visit the project repository.')
    .strict() // Enforce that only defined options are used
    .argv;

  // The parsed arguments are now in `argv`.
  // We can pass them directly to our server start function.
  try {
    await startServer(argv);
  } catch (error) {
    console.error('An unexpected error occurred while running the server:');
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

// Execute the main function.
main();