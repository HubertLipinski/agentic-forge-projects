#!/usr/bin/env node

/**
 * @file bin/transform.js
 * @description The executable CLI script for the CSV Stream Transformer.
 * This script uses yargs to parse command-line arguments, orchestrates the loading
 * and validation of the configuration, sets up the I/O streams, and runs the
 * transformation pipeline.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { performance } from 'node:perf_hooks';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadAndValidateConfig } from '../src/utils/config-loader.js';
import { buildAndRunPipeline } from '../src/core/pipeline-builder.js';

/**
 * A custom error class for CLI-specific issues.
 */
class CliError extends Error {
  /**
   * @param {string} message - The primary error message.
   * @param {object} [options] - Optional parameters.
   * @param {Error} [options.cause] - The original error that caused this one.
   */
  constructor(message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'CliError';
  }
}

/**
 * The main entry point for the CLI application.
 * It parses arguments, sets up streams, and initiates the transformation.
 * @param {string[]} argv - The command-line arguments array.
 */
export async function main(argv) {
  const args = await parseArguments(argv);
  const { input, output, config: configPath, silent } = args;

  const startTime = performance.now();
  if (!silent) {
    console.log('🚀 Starting CSV transformation...');
    console.log(`- Config: ${configPath}`);
    console.log(`- Input:  ${input ? input : 'stdin'}`);
    console.log(`- Output: ${output ? output : 'stdout'}`);
  }

  try {
    // 1. Load and validate the transformation configuration file.
    const config = await loadAndValidateConfig(configPath);

    // 2. Set up the source and destination streams.
    // Use stdin/stdout if file paths are not provided.
    const sourceStream = input
      ? createReadStream(input)
      : process.stdin;

    const destinationStream = output
      ? createWriteStream(output)
      : process.stdout;

    // Add error handlers to the I/O streams to catch file system errors.
    sourceStream.on('error', (err) => {
      throw new CliError(`Error reading from source: ${input || 'stdin'}`, { cause: err });
    });

    destinationStream.on('error', (err) => {
      throw new CliError(`Error writing to destination: ${output || 'stdout'}`, { cause: err });
    });

    // 3. Build and run the transformation pipeline.
    await buildAndRunPipeline({
      sourceStream,
      destinationStream,
      config,
      // Note: Custom transformers are not supported via the CLI in this version.
      // They can be passed when using the library programmatically.
      customTransformers: {},
    });

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (!silent) {
      console.log(`✅ Transformation complete in ${duration} seconds.`);
    }
  } catch (error) {
    // Centralized error handling for the CLI.
    console.error(`\n❌ An error occurred: ${error.message}`);

    // Log additional details for specific error types for better debugging.
    if (error.name === 'ConfigError' && error.details) {
      console.error('Validation Details:', error.details);
    } else if (error.cause) {
      // Show the underlying error that caused the failure.
      console.error(`Cause: ${error.cause.message}`);
    }

    // Exit with a non-zero code to indicate failure, important for scripting.
    process.exit(1);
  }
}

/**
 * Configures and parses command-line arguments using yargs.
 * @param {string[]} argv - The raw command-line arguments.
 * @returns {Promise<object>} A promise that resolves to the parsed arguments object.
 */
function parseArguments(argv) {
  return yargs(argv)
    .command('$0 [input] [output]', 'Transform a CSV file based on a JSON configuration.', (yargs) => {
      yargs
        .positional('input', {
          describe: 'Path to the source CSV file. If omitted, reads from stdin.',
          type: 'string',
        })
        .positional('output', {
          describe: 'Path for the transformed CSV file. If omitted, writes to stdout.',
          type: 'string',
        });
    })
    .option('config', {
      alias: 'c',
      describe: 'Path to the JSON transformation configuration file.',
      type: 'string',
      demandOption: true, // This is the most critical piece of information.
    })
    .option('silent', {
      alias: 's',
      describe: 'Suppress console output (logs and progress messages).',
      type: 'boolean',
      default: false,
    })
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .epilogue('For more information, visit https://github.com/your-username/csv-stream-transformer')
    .strict() // Report errors for unknown options.
    .fail((msg, err) => {
      // Custom failure handler for yargs.
      console.error('Error:', msg);
      if (err) {
        console.error(err.stack);
      }
      console.error('\nUse --help for a list of available options.');
      process.exit(1);
    })
    .parseAsync();
}

// Execute the main function only if the script is run directly.
// This check allows the `main` function to be imported and tested separately.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main(hideBin(process.argv));
}