/**
 * @file src/cli/index.js
 * @description Main CLI entrypoint using 'yargs'.
 *
 * This file sets up the command-line interface for the schema-diff-sync tool.
 * It defines the top-level commands (`plan`, `apply`), global options,
 * and overall CLI behavior like error handling and help messages.
 * It acts as the orchestrator, delegating the actual command logic to
 * dedicated modules in the `src/cli/commands/` directory.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import * as planCommand from './commands/plan.js';
import * as applyCommand from './commands/apply.js';

/**
 * The main function that initializes and runs the CLI.
 *
 * It configures yargs with all the commands, options, and settings,
 * then parses the command-line arguments to execute the appropriate command.
 *
 * @param {string[]} argv - The command-line arguments, typically `process.argv`.
 * @returns {Promise<void>} A promise that resolves when the command has been executed.
 */
export async function run(argv) {
  try {
    await yargs(hideBin(argv))
      .scriptName('schema-sync')
      .command(planCommand)
      .command(applyCommand)
      .demandCommand(1, 'You need to specify a command (e.g., plan, apply).')
      .strict()
      .alias('h', 'help')
      .alias('v', 'version')
      .epilogue('For more information, find our documentation at https://github.com/your-username/schema-diff-sync')
      .fail((msg, err, yargsInstance) => {
        // This custom fail handler provides more structured error output.
        if (err) {
          // An unexpected error occurred during yargs processing.
          console.error('❌ An unexpected error occurred:');
          console.error(err.stack || err.message);
        } else {
          // A validation error (e.g., missing command, unknown option).
          console.error(`❌ Error: ${msg}\n`);
          // Show the help text for the current command context.
          yargsInstance.showHelp();
        }
        process.exit(1);
      })
      .parse();
  } catch (error) {
    // This catch block handles errors that might escape the command handlers.
    // While handlers have their own try/catch, this is a final safety net.
    console.error(`\n❌ A critical error occurred: ${error.message}`);
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}