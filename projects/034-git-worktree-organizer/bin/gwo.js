#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'node:module';

// Import command handlers
import { addCommand } from '../src/commands/add.js';
import { listCommand } from '../src/commands/list.js';
import { cleanCommand } from '../src/commands/clean.js';

// Helper to get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

/**
 * The main function that sets up and executes the CLI.
 * This is the primary entry point of the application.
 */
async function main() {
  const program = new Command();

  // --- General Program Configuration ---
  program
    .name('gwo')
    .description(pkg.description)
    .version(pkg.version, '-v, --version', 'Output the current version')
    .usage('<command> [options]')
    .on('command:*', () => {
      // Custom handler for unknown commands
      console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
      console.error('See --help for a list of available commands.');
      process.exit(1);
    });

  // --- 'add' Command ---
  program
    .command('add')
    .argument('[branch]', 'The branch to create a worktree for (prompts if omitted)')
    .description('Create a new worktree for a specific branch.')
    .action(addCommand);

  // --- 'list' Command ---
  program
    .command('list')
    .alias('ls')
    .description('List all managed worktrees.')
    .action(listCommand);

  // --- 'clean' Command ---
  program
    .command('clean')
    .description('Remove worktrees linked to deleted branches.')
    .option('-f, --force', 'Remove prunable worktrees without confirmation', false)
    .action(cleanCommand);

  try {
    // Parse command-line arguments and execute the corresponding action
    await program.parseAsync(process.argv);
  } catch (error) {
    // Catch-all for unexpected errors during parsing or command execution
    // that are not handled within the command itself.
    console.error(chalk.red('\nAn unexpected error occurred:'));
    console.error(chalk.red(error.message));
    if (process.env.DEBUG) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

// Execute the main function
main();