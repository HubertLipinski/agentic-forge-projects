#!/usr/bin/env node

/**
 * @file src/cli.js
 * @description The main entry point for the ini-env-sync command-line application.
 *
 * This file uses 'yargs' to define and parse command-line arguments, providing a
 * user-friendly interface for file conversion and synchronization. It orchestrates
 * the core logic by calling the appropriate functions from the `syncer` module
 * based on user input.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { performSync, startWatcher } from './core/syncer.js';
import { CASE_TRANSFORMATIONS } from './utils/string-format.js';

/**
 * The main execution function for the CLI.
 * It sets up yargs, parses arguments, and triggers the appropriate action.
 * @param {string[]} argv - Command-line arguments, typically from `process.argv`.
 */
async function main(argv) {
  const yargsInstance = yargs(hideBin(argv));

  yargsInstance
    .scriptName('ini-env-sync')
    .usage('Usage: $0 <source> <destination> [options]')
    .command(
      '$0 <source> <destination>',
      'Convert or synchronize an INI file and a .env file.',
      (yargs) => {
        yargs
          .positional('source', {
            describe: 'The source file path (e.g., config.ini or .env)',
            type: 'string',
            normalize: true,
          })
          .positional('destination', {
            describe: 'The destination file path (e.g., .env or config.ini)',
            type: 'string',
            normalize: true,
          });
      },
      async (argv) => {
        const { source, destination, watch, ...converterOptions } = argv;

        try {
          if (watch) {
            await startWatcher(source, destination, converterOptions);
          } else {
            await performSync(source, destination, converterOptions);
          }
        } catch (error) {
          console.error(`❌ An unexpected error occurred: ${error.message}`);
          process.exit(1);
        }
      }
    )
    .option('watch', {
      alias: 'w',
      type: 'boolean',
      description: 'Watch the source file for changes and sync automatically.',
      default: false,
    })
    .option('case-type', {
      alias: 'c',
      type: 'string',
      description: 'The case style to apply to keys during conversion.',
      choices: Object.keys(CASE_TRANSFORMATIONS),
      default: 'SNAKE_CASE',
    })
    .option('prefix-delimiter', {
      alias: 'd',
      type: 'string',
      description: 'The delimiter used to join INI section names and keys.',
      default: '_',
    })
    .option('sync-on-start', {
      type: 'boolean',
      description: 'Perform an initial sync when starting watch mode.',
      default: true,
      implies: 'watch',
    })
    .alias('help', 'h')
    .alias('version', 'v')
    .epilogue(
      'For more information, find the project on GitHub: https://github.com/your-username/ini-env-sync'
    )
    .demandCommand(2, 'You must provide both a source and a destination file.')
    .strict() // Report errors for unknown options
    .fail((msg, err, yargs) => {
      // Custom failure handler for better error messages
      if (err) {
        // This is a programmatic error, re-throw it
        throw err;
      }
      console.error(`❌ Error: ${msg}\n`);
      console.error(yargs.help());
      process.exit(1);
    })
    .parse();
}

// Execute the main function, passing command-line arguments.
// The `if (process.argv)` check is a standard way to ensure this runs only when executed as a script.
if (process.argv) {
  main(process.argv).catch((error) => {
    // This top-level catch is a safety net for any unhandled promise rejections.
    console.error(`\n🚨 A critical error occurred:\n${error.stack || error}`);
    process.exit(1);
  });
}

// Export main for potential programmatic use or testing, though it's primarily a CLI entry point.
export { main };