#!/usr/bin/env node

/**
 * @file bin/auto-semver-tag.js
 * @description The executable entry point for the Auto SemVer Tagger CLI.
 * This file sets up and configures the `yargs` command-line interface,
 * defines all available options and flags, and invokes the main application logic.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { run } from '../src/main.js';

/**
 * Configures and executes the yargs CLI parser.
 *
 * It defines the command-line interface for the tool, including all options,
 * their descriptions, types, and default values where applicable.
 *
 * @see {@link https://yargs.js.org/docs/api/} for yargs documentation.
 */
async function main() {
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .epilog('For more information, visit the project repository.')
    .help('h')
    .alias('h', 'help')
    .version(false) // Disable default version flag; we handle versioning via tags.
    .wrap(yargs(process.argv).terminalWidth())
    .options({
      'dry-run': {
        alias: 'd',
        type: 'boolean',
        description: 'Preview the new version and changelog without creating a tag.',
        default: false,
      },
      'push': {
        type: 'boolean',
        description: 'Push the new tag to the remote repository.',
        default: false,
      },
      'prerelease': {
        alias: 'p',
        // Can be a boolean (if flag is present without value) or a string.
        // Yargs handles this conversion automatically.
        type: 'string',
        description: 'Create a pre-release version with an optional identifier (e.g., --prerelease=alpha).',
        // No default value here; `loadConfig` handles the logic if the flag is present but has no value.
      },
      'tag-prefix': {
        type: 'string',
        description: 'The prefix for Git tags (e.g., "v").',
        // Default is handled by `config/loader.js` to respect config file precedence.
      },
      'remote': {
        type: 'string',
        description: 'The Git remote to push to.',
        // Default is handled by `config/loader.js`.
      },
      'verbose': {
        alias: 'v',
        type: 'boolean',
        description: 'Enable detailed logging for debugging purposes.',
        default: false,
      },
    })
    .check((argv) => {
      // Custom validation logic can be added here if needed.
      // For example, ensuring `prerelease` identifier is valid.
      if (typeof argv.prerelease === 'string' && argv.prerelease.includes(' ')) {
        throw new Error('The --prerelease identifier cannot contain spaces.');
      }
      return true; // Indicates validation passed
    })
    .fail((msg, err, yargs) => {
      // Custom failure handler to provide more user-friendly error messages.
      if (err) {
        // This handles exceptions from `check` or other internal yargs errors.
        console.error(`\nError: ${err.message}\n`);
      } else {
        // This handles invalid command/option usage.
        console.error(`\nError: ${msg}\n`);
      }
      console.error('For help, run: auto-semver-tag --help');
      process.exit(1);
    })
    .parseAsync(); // Use parseAsync to handle async checks or middleware in the future.

  // The parsed arguments are passed to the main application logic.
  await run(argv);
}

// Execute the main function and handle any top-level unhandled promise rejections.
main().catch((error) => {
  // This is a final safety net. The `run` function in `src/main.js`
  // should handle its own errors and exit gracefully.
  console.error('\n[FATAL] An unexpected error occurred at the top level:');
  console.error(error);
  process.exit(1);
});