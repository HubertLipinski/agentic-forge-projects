/**
 * @file src/cli.js
 * @description The command-line interface (CLI) entry point for the Env Var Mapper tool.
 * This file uses `yargs` to parse command-line arguments, orchestrates the mapping
 * process via the core `mapper` module, and handles outputting the results to the
 * console or a file.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { mapEnvironmentVariables } from './core/mapper.js';
import { OUTPUT_FORMATS, DEFAULT_ENV_EXAMPLE_FILENAME } from './utils/constants.js';

/**
 * Handles writing the output content to a file.
 * If the file already exists, it prompts the user for confirmation before overwriting.
 *
 * @param {string} filePath - The path to the file to be written.
 * @param {string} content - The content to write to the file.
 * @returns {Promise<void>}
 */
const writeOutputToFile = async (filePath, content) => {
  const fullPath = path.resolve(process.cwd(), filePath);
  try {
    await fs.writeFile(fullPath, content, { flag: 'w' }); // 'w' flag ensures overwriting
    console.log(chalk.green(`Successfully generated ${chalk.bold(filePath)}.`));
  } catch (error) {
    console.error(chalk.red(`Error: Failed to write to file "${filePath}".`), `\n${error.message}`);
    process.exit(1);
  }
};

/**
 * Main function to run the CLI application.
 * It parses arguments, calls the core mapper, and handles the output.
 *
 * @param {string[]} argv - The command-line arguments array.
 * @returns {Promise<void>}
 */
export const run = async (argv) => {
  const yargsInstance = yargs(hideBin(argv));

  const options = await yargsInstance
    .usage(`Usage: $0 <directory> [options]`)
    .command('$0 <directory>', 'Scan a directory for environment variable usage.', (y) => {
      y.positional('directory', {
        describe: 'The directory to scan for .js and .mjs files',
        type: 'string',
        normalize: true, // Automatically normalizes the path
      });
    })
    .option('format', {
      alias: 'f',
      describe: 'The output format',
      type: 'string',
      choices: Object.values(OUTPUT_FORMATS),
      default: OUTPUT_FORMATS.DETAIL,
    })
    .option('ignore', {
      alias: 'i',
      describe: 'Glob patterns for files/directories to ignore',
      type: 'array',
      default: [],
    })
    .option('output-file', {
      alias: 'o',
      describe: `Write output to a file. If format is 'env', defaults to '${DEFAULT_ENV_EXAMPLE_FILENAME}'.`,
      type: 'string',
    })
    .example('$0 .', 'Scan the current directory with default options')
    .example('$0 ./src -f list', 'Scan the src directory and output a simple list')
    .example('$0 ./app -f json -o report.json', 'Scan the app directory and save a JSON report')
    .example('$0 . -f env -o .env.local.example', `Scan and generate a custom .env example file`)
    .help()
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .epilogue(`For more information, visit the project's repository.`)
    .fail((msg, err, yargs) => {
      if (err) {
        // This handles internal yargs errors (e.g., programming errors in setup)
        console.error(chalk.red('An unexpected error occurred:'), err.message);
        console.error(err.stack);
      } else {
        // This handles user input errors (e.g., invalid options, missing commands)
        console.error(chalk.red('Error:'), msg);
        console.error(chalk.yellow('\nRun with --help for usage information.'));
      }
      process.exit(1);
    })
    .strict() // Catches unrecognized arguments
    .parseAsync();

  try {
    const { directory, format, ignore: ignorePatterns, outputFile } = options;

    const result = await mapEnvironmentVariables({
      directory,
      format,
      ignorePatterns,
    });

    // Determine if output should be written to a file.
    // This is true if --output-file is specified, or if format is 'env' (which implies a file).
    const shouldWriteToFile = outputFile || result.isFile;
    const finalOutputFile = outputFile ?? result.fileName;

    if (shouldWriteToFile) {
      await writeOutputToFile(finalOutputFile, result.content);
    } else {
      // If no file output, print to console.
      console.log(result.content);
    }
  } catch (error) {
    console.error(chalk.red('An error occurred during execution:'));
    console.error(chalk.red(error.message));
    // For developers, show the stack trace in a less prominent color.
    if (process.env.NODE_ENV === 'development' && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
};