#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The command-line interface (CLI) for the Markdown to JSON converter.
 * This script uses `yargs` to parse command-line arguments and orchestrates the
 * file conversion process, handling input from files, directories, or glob patterns,
 * and outputting the result to the console or a specified file.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'node:path';
import { writeFileWithDir } from '../src/utils/file-helpers.js';
import { convert } from '../src/converter.js';
import { createRequire } from 'node:module';

// Get package.json metadata like version and description for the CLI.
const require = createRequire(import.meta.url);
const { version, description } = require('../package.json');

/**
 * The main entry point for the CLI application.
 * It configures yargs, parses arguments, runs the conversion, and handles output.
 * @async
 */
async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('md-to-json')
    .usage('$0 <input> [options]')
    .command('$0 <input>', description, (yargs) => {
      yargs.positional('input', {
        describe: 'Path to a Markdown file, a directory, or a glob pattern',
        type: 'string',
        demandOption: true,
      });
    })
    .option('output', {
      alias: 'o',
      describe: 'Path to the output JSON file. If omitted, prints to stdout.',
      type: 'string',
      normalize: true, // Resolves the path to an absolute path
    })
    .option('pretty', {
      alias: 'p',
      describe: 'Format the JSON output for readability.',
      type: 'boolean',
      default: false,
    })
    .version('version', 'Show version number', version)
    .alias('version', 'v')
    .help('help', 'Show help')
    .alias('help', 'h')
    .epilogue('For more information, find our repository at https://github.com/your-username/md-front-matter-json')
    .strict() // Report errors for unknown options
    .fail((msg, err, yargs) => {
      // Custom failure handler for better error messages
      console.error(`Error: ${msg}\n`);
      console.error(yargs.help());
      process.exit(1);
    })
    .parseAsync();

  try {
    const results = await convert(argv.input);

    if (results.length === 0) {
      console.warn(`Warning: No markdown files found matching the input path/pattern: "${argv.input}"`);
      // Exit gracefully if no files were found.
      process.exit(0);
    }

    // If the input was a single file (not a glob/dir that could match one file),
    // and the output is not a directory, output a single object, not an array.
    const isSingleFileResult = results.length === 1 && path.resolve(argv.input) === path.resolve(results[0].filePath);
    const outputData = isSingleFileResult ? results[0] : results;

    const jsonString = JSON.stringify(
      outputData,
      null,
      argv.pretty ? 2 : undefined
    );

    if (argv.output) {
      await writeFileWithDir(argv.output, jsonString);
      console.log(`Successfully converted ${results.length} file(s) and saved to ${argv.output}`);
    } else {
      // Output to standard output if no output file is specified.
      process.stdout.write(jsonString + '\n');
    }
  } catch (error) {
    // Centralized error handling for the application logic.
    console.error(`\n[FATAL ERROR] An unexpected error occurred during conversion:`);
    console.error(`  Message: ${error.message}`);
    if (error.cause) {
      console.error(`  Cause: ${error.cause.message}`);
    }
    // For debugging, uncomment the line below to see the full stack trace.
    // console.error(error.stack);
    process.exit(1);
  }
}

// Execute the main function and catch any top-level unhandled promise rejections.
main().catch((error) => {
  console.error('An unhandled error occurred in the CLI entry point:', error);
  process.exit(1);
});