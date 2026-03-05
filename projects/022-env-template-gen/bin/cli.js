#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The command-line interface (CLI) entry point for the Env Template Generator.
 * This script uses 'yargs' to parse command-line arguments and then invokes the
 * main application logic to generate the .env.template file.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { generateEnvTemplate } from '../src/index.js';
import {
  DEFAULT_OUTPUT_FILE,
  DEFAULT_SOURCE_PATTERN,
  DEFAULT_IGNORE_PATTERNS,
} from '../src/utils/constants.js';

/**
 * Main CLI execution function.
 * It configures yargs for argument parsing and then calls the core application logic.
 * @async
 */
async function main() {
  // Configure yargs to parse command-line arguments.
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .scriptName('env-template-generator')
    .command(
      '$0 [patterns...]',
      'Scan for process.env usage and generate a .env.template file.',
      (yargs) => {
        yargs.positional('patterns', {
          describe: 'One or more glob patterns to scan for source files.',
          type: 'string',
          default: [DEFAULT_SOURCE_PATTERN],
        });
      }
    )
    .option('output', {
      alias: 'o',
      describe: 'Path to the output template file.',
      type: 'string',
      default: DEFAULT_OUTPUT_FILE,
      normalize: true, // Ensures the path is resolved correctly
    })
    .option('ignore', {
      alias: 'i',
      describe: 'One or more glob patterns to ignore.',
      type: 'array',
      default: DEFAULT_IGNORE_PATTERNS,
    })
    .option('verbose', {
      alias: 'v',
      describe: 'Enable verbose logging for debugging.',
      type: 'boolean',
      default: false,
    })
    .alias('help', 'h')
    .alias('version', 'V')
    .epilogue(
      'For more information, visit https://github.com/your-username/env-template-generator'
    )
    .example(
      '$0',
      'Scan default "src" directory and create .env.template'
    )
    .example(
      '$0 "lib/**/*.js" "api/**/*.ts"',
      'Scan custom directories for .js and .ts files'
    )
    .example(
      '$0 -o .env.example -i "**/__tests__/**"',
      'Output to a different file and add an ignore pattern'
    )
    .strict() // Report errors for unknown options
    .parse();

  try {
    // Pass the parsed arguments to the main application logic.
    await generateEnvTemplate({
      patterns: argv.patterns,
      outputPath: argv.output,
      ignore: argv.ignore,
      verbose: argv.verbose,
    });
  } catch (error) {
    // Catch errors bubbled up from the application logic (e.g., file system errors).
    // The core logic should have already logged specific error details.
    console.error('\n[Error] The operation failed. Aborting.');
    // Exit with a non-zero status code to indicate failure, which is useful for CI/CD pipelines.
    process.exit(1);
  }
}

// Execute the main function and handle any top-level unhandled promise rejections.
main().catch((error) => {
  console.error('\n[Critical Error] An unexpected error occurred:');
  console.error(error);
  process.exit(1);
});