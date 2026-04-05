#!/usr/bin/env node

/**
 * @file bin/infer-schema.js
 * @description Command-line interface for the JSON Schema Inferer.
 * This script allows users to generate a JSON schema from a JSON file
 * via the terminal. It handles file I/O, command-line argument parsing,
 * and orchestrates the schema inference process.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { infer } from '../src/index.js';
import { createRequire } from 'node:module';

// Create a require function to load package.json for version info.
// This is the recommended way to read JSON files in ES modules.
const require = createRequire(import.meta.url);
const { version, description } = require('../package.json');

/**
 * Reads and parses a JSON file from the given file path.
 *
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<any>} A promise that resolves with the parsed JSON data.
 * @throws {Error} If the file cannot be read or parsed.
 */
async function readJsonFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Input file not found: ${filePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file: ${filePath}. ${error.message}`);
    }
    // Re-throw other unexpected errors (e.g., permission issues).
    throw new Error(`Could not read file: ${filePath}. Reason: ${error.message}`);
  }
}

/**
 * Writes the generated schema to a file or to standard output.
 *
 * @param {object} schema - The JSON schema object to write.
 * @param {string|undefined} outputPath - The path to the output file. If undefined, writes to stdout.
 * @param {number} indent - The number of spaces to use for JSON indentation.
 * @returns {Promise<void>} A promise that resolves when the write operation is complete.
 * @throws {Error} If the file cannot be written.
 */
async function writeSchema(schema, outputPath, indent) {
  const schemaString = JSON.stringify(schema, null, indent);

  if (outputPath) {
    try {
      await fs.writeFile(outputPath, schemaString, 'utf-8');
      console.error(`Schema successfully written to ${outputPath}`);
    } catch (error) {
      throw new Error(`Could not write to output file: ${outputPath}. Reason: ${error.message}`);
    }
  } else {
    // Write to standard output.
    process.stdout.write(schemaString + '\n');
  }
}

/**
 * The main execution function for the CLI.
 * It sets up commander, parses arguments, and runs the inference logic.
 *
 * @param {string[]} argv - The command-line arguments array (e.g., process.argv).
 */
export async function main(argv) {
  const program = new Command();

  program
    .name('infer-schema')
    .version(version, '-v, --version', 'Output the current version')
    .description(description)
    .argument('<input-file>', 'Path to the input JSON file containing a single object or an array of objects.')
    .option('-o, --output <file>', 'Path to the output schema file. If omitted, prints to stdout.')
    .option('-i, --indent <number>', 'Number of spaces for JSON output indentation.', (value) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 0) {
        throw new Error('Indent must be a non-negative integer.');
      }
      return parsed;
    }, 2)
    .action(async (inputFile, options) => {
      try {
        const absoluteInputPath = path.resolve(process.cwd(), inputFile);
        const jsonData = await readJsonFile(absoluteInputPath);

        const schema = infer(jsonData);

        const absoluteOutputPath = options.output
          ? path.resolve(process.cwd(), options.output)
          : undefined;

        await writeSchema(schema, absoluteOutputPath, options.indent);
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  await program.parseAsync(argv);
}

// Execute the main function if the script is run directly.
// This check prevents the CLI from running when this file is imported for testing.
if (process.argv[1] === (await fs.realpath(process.argv[1]))) {
  main(process.argv);
}