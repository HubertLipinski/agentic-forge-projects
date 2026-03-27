#!/usr/bin/env node

/**
 * @file bin/git-blame-sifter.js
 * @description The executable entry point for the Git Blame Sifter CLI.
 * This file configures `yargs` to define the command-line interface,
 * including commands, options, and help text. It then invokes the
 * appropriate command handler based on user input.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { sift } from '../src/commands/sift.js';
import { isGitRepository } from '../src/utils/git-executor.js';

/**
 * The main entry point for the CLI application.
 * It sets up and executes the yargs-based command parser.
 */
async function main() {
  // Before running any commands, check if we are in a Git repository.
  // This provides a better user experience than letting a git command fail deep inside the logic.
  try {
    const inGitRepo = await isGitRepository();
    if (!inGitRepo) {
      console.error(chalk.red('Error: Not a git repository.'));
      console.error(chalk.yellow('Git Blame Sifter must be run from within a Git working tree.'));
      process.exit(1);
    }
  } catch (error) {
    // This can happen if `git` is not installed or not in the PATH.
    console.error(chalk.red('Error checking for Git repository:'), error.message);
    process.exit(1);
  }

  // Configure yargs for the entire application
  const argv = yargs(hideBin(process.argv))
    // Main command: 'sift'
    .command(
      // The command name, its aliases, and its description
      'sift <file>',
      'Analyze git blame for a file, filtering out trivial commits.',
      
      // Builder function to define command-specific options
      (yargs) => {
        return yargs
          .positional('file', {
            describe: 'The path to the file to analyze',
            type: 'string',
            demandOption: true,
          })
          .option('format', {
            alias: 'f',
            describe: 'The output format for the results.',
            choices: ['standard', 'json', 'summary'],
            default: 'standard',
            type: 'string',
          })
          .option('commit-message', {
            alias: 'm',
            describe: 'Regex pattern to identify trivial commit messages.',
            type: 'string',
          })
          .option('ignore-authors', {
            alias: 'a',
            describe: 'Comma-separated list of author names or emails to ignore.',
            type: 'string', // Will be parsed into an array in the handler
          })
          .option('ignore-revs', {
            describe: 'Path to a file containing a list of commit SHAs to ignore (e.g., .git-blame-ignore-revs).',
            type: 'string',
          })
          .option('is-trivial', {
            describe: 'Enable diff-based analysis to detect purely cosmetic changes.',
            type: 'boolean',
            default: true,
          })
          .option('blame-args', {
            describe: 'Additional arguments to pass directly to `git blame`.',
            type: 'string',
          })
          .option('show-progress', {
            describe: 'Display a progress spinner during analysis.',
            type: 'boolean',
            default: true,
          })
          .option('interactive', {
            alias: 'i',
            describe: 'Enable interactive mode to review and confirm trivial commits.',
            type: 'boolean',
            default: false,
          });
      },
      
      // Handler function for the 'sift' command
      async (argv) => {
        try {
          // The `sift` function contains the core logic. We pass the parsed arguments to it.
          await sift(argv);
        } catch (error) {
          // Catch and log any errors that bubble up from the command handler
          console.error(chalk.red.bold('\nAn error occurred during the sift operation:'));
          console.error(chalk.red(error.message));
          if (process.env.DEBUG) {
            console.error(error.stack);
          }
          process.exit(1);
        }
      }
    )
    // Global configurations for yargs
    .scriptName('git-blame-sifter')
    .alias('h', 'help')
    .alias('v', 'version')
    .demandCommand(1, 'You must provide a command. Try "sift --help" for more information.')
    .strict() // Report errors for unknown options
    .epilogue(`For more information, find the documentation at ${chalk.underline('https://github.com/your-username/git-blame-sifter')}`)
    .fail((msg, err, yargs) => {
      // Custom failure handler for more readable error messages
      if (err) {
        // Preserve stack trace in debug mode
        if (process.env.DEBUG) {
            console.error(err);
        } else {
            console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
      console.error(chalk.red('Error:'), msg);
      console.error('\n' + yargs.help());
      process.exit(1);
    })
    .parse(); // This triggers the parsing and execution
}

// Execute the main function and handle top-level unhandled promise rejections
main().catch((error) => {
  console.error(chalk.red.bold('\nA critical unexpected error occurred:'));
  console.error(chalk.red(error.message));
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});