#!/usr/bin/env node

/**
 * @file bin/generate-api.js
 * @description The executable CLI script for the JSDoc to REST API generator.
 *
 * This script serves as the main entry point for the command-line interface.
 * It uses the 'yargs' library to define the command structure, parse arguments,
 * and handle user input. It orchestrates the entire API generation process by
 * calling the main application logic with the provided source and output paths.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'node:path';
import { generateApi } from '../src/index.js';
import { isDirectory } from '../src/utils/file-system.js';

/**
 * The main function that sets up and runs the Yargs CLI.
 * It defines the primary command, its options, and the handler logic.
 * This function is immediately invoked to start the CLI application.
 */
async function main() {
  await yargs(hideBin(process.argv))
    .scriptName('generate-api')
    .usage('Usage: $0 <source> [options]')
    .command(
      // The default command, invoked when the script is run with arguments.
      // e.g., `generate-api ./services -o ./dist/api`
      '$0 <source>',
      'Generate a REST API server from JSDoc-annotated service files.',
      (yargs) => {
        // --- Positional Argument: <source> ---
        yargs.positional('source', {
          describe: 'The source directory containing your service files.',
          type: 'string',
        });
      },
      // --- Command Handler ---
      async (argv) => {
        try {
          console.log('🚀 Starting JSDoc to REST API generator...');

          // Resolve paths to be absolute to ensure consistency.
          const sourceDir = path.resolve(process.cwd(), argv.source);
          const outputDir = path.resolve(process.cwd(), argv.output);

          // Perform pre-flight checks before starting the core logic.
          await validatePaths(sourceDir, outputDir);

          // Delegate to the main application logic.
          await generateApi({ sourceDir, outputDir });
        } catch (error) {
          // Catch errors from path validation or the core generation process.
          console.error(`\n❌ An unexpected error occurred: ${error.message}`);
          // Exit with a non-zero status code to indicate failure, which is crucial for CI/CD environments.
          process.exit(1);
        }
      },
    )
    // --- Global Options ---
    .option('output', {
      alias: 'o',
      describe: 'The directory to output the generated API server.',
      type: 'string',
      default: './generated-api',
      normalize: true, // Automatically resolves the path.
    })
    .option('verbose', {
      alias: 'v',
      describe: 'Enable verbose logging for debugging.',
      type: 'boolean',
      default: false,
    })
    // --- Help and Version ---
    .help('h')
    .alias('h', 'help')
    .version() // Automatically reads version from package.json
    .alias('version', 'V')
    // --- Strict Mode and Error Handling ---
    .strict() // Throws an error for unknown commands or options.
    .demandCommand(1, 'You must provide a source directory to scan.')
    .epilogue(
      'For more information, visit https://github.com/your-username/jsdoc-to-rest',
    )
    // --- Finalize ---
    .parse(); // This triggers the parsing and execution.
}

/**
 * Validates the source and output directory paths provided by the user.
 *
 * @param {string} sourceDir - The absolute path to the source directory.
 * @param {string} outputDir - The absolute path to the output directory.
 * @throws {Error} If the source directory does not exist or is not a directory.
 * @throws {Error} If the output directory is the same as the source directory.
 */
async function validatePaths(sourceDir, outputDir) {
  // Check 1: Ensure the source directory exists and is actually a directory.
  const sourceIsValid = await isDirectory(sourceDir);
  if (!sourceIsValid) {
    throw new Error(
      `The specified source path "${sourceDir}" is not a valid directory or does not exist.`,
    );
  }

  // Check 2: Prevent accidental overwriting of source files.
  if (sourceDir === outputDir) {
    throw new Error(
      'The source and output directories cannot be the same. Please specify a different output path.',
    );
  }

  console.log(`- Source directory: ${sourceDir}`);
  console.log(`- Output directory: ${outputDir}`);
}

// Execute the main CLI function.
main().catch((error) => {
  // This catch block handles synchronous errors during Yargs setup,
  // though most async errors are handled within the command handler.
  console.error('\n❌ A critical error occurred during CLI initialization:');
  console.error(error.message);
  process.exit(1);
});