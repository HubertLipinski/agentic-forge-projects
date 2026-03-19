#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The main executable file for the Git Tag Manager CLI.
 * It uses 'yargs' to define commands, parse arguments, and delegate to the
 * appropriate command handlers in the lib/commands directory. This file
 * orchestrates the entire command-line interface.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

// Import command modules. Each module exports its own `command`, `describe`, `builder`, and `handler`.
import * as listCommand from '../lib/commands/list.js';
import * as deleteCommand from '../lib/commands/delete.js';
import * as moveCommand from '../lib/commands/move.js';

/**
 * Checks if the current directory is a Git repository by running `git rev-parse`.
 * This is a prerequisite for most of the CLI's functionality.
 * @returns {Promise<boolean>} True if it's a Git repository, false otherwise.
 */
async function isGitRepository() {
  try {
    // Dynamically import execa only when needed for this check.
    const { execa } = await import('execa');
    // `git rev-parse --is-inside-work-tree` is a reliable way to check.
    // It exits with 0 and prints "true" if inside a repo, and fails otherwise.
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * The main function that sets up and runs the yargs-based CLI.
 */
async function main() {
  // Perform a quick check to ensure the user is in a git repository.
  // This provides a better user experience than letting individual git commands fail.
  if (!(await isGitRepository())) {
    console.error(chalk.red('✖ This is not a Git repository.'));
    console.error(chalk.dim('Please run git-tag-manager from within a valid Git working directory.'));
    process.exit(1);
  }

  // Configure the yargs instance.
  yargs(hideBin(process.argv))
    // Register commands from their respective modules.
    .command(listCommand)
    .command(deleteCommand)
    .command(moveCommand)

    // --- Global Configuration ---

    // Set a friendly script name for help messages.
    .scriptName('gtm')

    // Provide a general usage message.
    .usage('Usage: $0 <command> [options]')

    // Require a command to be provided. If not, show the help message.
    .demandCommand(1, chalk.red('✖ You must specify a command (e.g., list, delete, move).'))

    // Add a custom epilogue to show where to find more help.
    .epilogue(`For more information, run ${chalk.cyan('gtm <command> --help')}`)

    // --- Global Options ---

    // The help option is enabled by default, but we can customize its description.
    .help('h')
    .alias('h', 'help')
    .describe('help', 'Show command-line help')

    // The version option is also built-in.
    .version('v')
    .alias('v', 'version')
    .describe('version', 'Show version number')

    // --- Advanced Configuration ---

    // Make recommendations for mistyped commands (e.g., "gtm ls" -> "Did you mean list?").
    .recommendCommands()

    // Enforce strict parsing. Unknown options will throw an error.
    .strict()

    // Handle failures gracefully with a custom message.
    .fail((msg, err, yargsInstance) => {
      if (err) {
        // This handles internal yargs errors or errors thrown from command handlers.
        console.error(chalk.red(`✖ An unexpected error occurred: ${err.message}`));
        if (process.env.NODE_ENV !== 'production' && err.stack) {
          console.error(chalk.dim(err.stack));
        }
      } else {
        // This handles validation errors (e.g., missing required arguments).
        console.error(chalk.red(`✖ Error: ${msg}\n`));
        // Show the help output for the current command to guide the user.
        yargsInstance.showHelp();
      }
      process.exit(1);
    })

    // Trigger parsing of the command-line arguments.
    .parse();
}

// Execute the main function and catch any top-level unhandled promise rejections.
main().catch(error => {
  console.error(chalk.red.bold('\n✖ A critical unhandled error occurred. This may be a bug.'));
  console.error(error);
  process.exit(1);
});