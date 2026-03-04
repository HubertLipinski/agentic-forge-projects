#!/usr/bin/env node

/**
 * bin/cli.js
 *
 * This is the executable entry point for the CLI Quick Alias tool.
 * It uses 'yargs' to parse command-line arguments, define commands, and
 * delegate execution to the appropriate command handler.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { createAliasCommandHandler } from '../src/commands/create-alias.js';

/**
 * Main function to configure and run the CLI.
 *
 * This function sets up the yargs instance with all the necessary
 * commands, options, and configurations, then parses the command-line
 * arguments to execute the application.
 */
async function main() {
  try {
    await yargs(hideBin(process.argv))
      // Use the create-alias logic as the default command.
      // This allows users to run `quick-alias` directly without a subcommand.
      .command(
        '$0',
        'Interactively create a new shell alias from your command history',
        (yargs) => {
          return yargs
            .option('dry-run', {
              alias: 'd',
              type: 'boolean',
              description: 'Show what alias would be created without modifying any files',
              default: false,
            })
            .option('limit', {
              alias: 'l',
              type: 'number',
              description: 'The number of recent history commands to display',
              default: 50,
              coerce: (val) => {
                if (val < 10) return 10;
                if (val > 200) return 200;
                return val;
              },
            });
        },
        createAliasCommandHandler
      )
      // Configuration for the CLI tool
      .scriptName('quick-alias')
      .usage('Usage: $0 [options]')
      .help('h')
      .alias('h', 'help')
      .alias('v', 'version')
      .epilogue('For more information, find the project on GitHub: https://github.com/your-username/cli-quick-alias')
      // Enforce that only defined commands and options are accepted.
      .strict()
      // Ensure at least one command is executed. In our case, the default command.
      .demandCommand(1, '')
      // Enable asynchronous command handlers.
      .parse();
  } catch (error) {
    // This is a top-level catch for unexpected errors during yargs setup or execution.
    // Errors within command handlers should be managed there, but this is a fail-safe.
    console.error('❌ An unexpected error occurred in the CLI tool:');
    console.error(error.message);
    // Set a non-zero exit code to indicate failure, which is useful for scripting.
    process.exitCode = 1;
  }
}

// Execute the main function to start the CLI application.
main();