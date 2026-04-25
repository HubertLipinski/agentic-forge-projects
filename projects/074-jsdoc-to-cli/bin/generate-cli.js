#!/usr/bin/env node

/**
 * @fileoverview The main executable for the jsdoc-to-cli generator.
 *
 * This script defines the command-line interface for the generator tool itself.
 * It uses 'commander' to parse arguments like input file patterns and the
 * output path, loads configuration from a file if present, and then invokes
 * the core generator logic to produce the final CLI script.
 *
 * @module bin/generate-cli
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { generateCli } from '../src/core/generator.js';

// Dynamically import package.json to get version and description.
const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

/**
 * The name of the configuration file to search for.
 * @type {string}
 */
const CONFIG_FILE_NAME = 'jsdoc-to-cli.config.js';

/**
 * Loads configuration from a `jsdoc-to-cli.config.js` file in the specified directory.
 *
 * @param {string} cwd - The current working directory to search for the config file.
 * @returns {Promise<object|null>} A promise that resolves to the configuration object, or null if not found.
 */
async function loadConfig(cwd) {
  const configPath = path.resolve(cwd, CONFIG_FILE_NAME);
  try {
    // Use fs.access to check for file existence without triggering an error that stops the process.
    await fs.access(configPath);
    // Use pathToFileURL to ensure correct ES module import on all platforms (Windows/Unix).
    const configModule = await import(pathToFileURL(configPath).href);
    return configModule.default ?? {};
  } catch (error) {
    // ENOENT means the file doesn't exist, which is a normal case.
    if (error.code === 'ENOENT') {
      return null;
    }
    // For other errors (e.g., syntax errors in the config file), re-throw.
    console.error(`[Error] Failed to load configuration from ${configPath}`);
    throw error;
  }
}

/**
 * Merges configurations from multiple sources, with CLI options taking precedence.
 *
 * The priority order is:
 * 1. CLI options (highest priority)
 * 2. Configuration file (`jsdoc-to-cli.config.js`)
 * 3. Default values (lowest priority)
 *
 * @param {object} cliOptions - Options parsed from the command line.
 * @param {object|null} fileConfig - Options loaded from the configuration file.
 * @returns {{input: string[], output: string}} The final, merged configuration.
 */
function mergeConfig(cliOptions, fileConfig) {
  const defaults = {
    input: ['src/**/*.js'],
    output: 'bin/generated-cli.js',
  };

  const config = { ...defaults, ...(fileConfig ?? {}) };

  // CLI options override file config and defaults.
  if (cliOptions.input?.length) {
    config.input = cliOptions.input;
  }
  if (cliOptions.output) {
    config.output = cliOptions.output;
  }

  return config;
}

/**
 * The main entry point for the executable.
 * It sets up the 'commander' program, parses arguments, and runs the generator.
 */
async function main() {
  const program = new Command();

  program
    .name('jsdoc-to-cli')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .description(pkg.description)
    .argument('[input...]', 'Glob patterns for input source files')
    .option('-o, --output <path>', 'Path to the generated CLI output file')
    .option('-c, --config <path>', 'Path to a custom configuration file (not yet implemented)')
    .action(async (input, options) => {
      try {
        const cwd = process.cwd();
        const fileConfig = await loadConfig(cwd);

        // Combine CLI args and file config to get the final settings.
        const finalConfig = mergeConfig({ input, output: options.output }, fileConfig);

        console.log(`Using configuration:`);
        console.log(`  Input: ${finalConfig.input.join(', ')}`);
        console.log(`  Output: ${finalConfig.output}`);

        await generateCli({ ...finalConfig, cwd });
      } catch (error) {
        console.error(`\n[Fatal Error] ${error.message}`);
        // For debugging purposes, you might want to see the stack trace.
        // console.error(error.stack);
        process.exit(1);
      }
    });

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // This catches errors during parsing itself (e.g., invalid option).
    console.error(`[CLI Error] ${error.message}`);
    process.exit(1);
  }
}

// Execute the main function.
main();