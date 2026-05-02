#!/usr/bin/env node

/**
 * @file bin/chaos-run.js
 * @description The CLI executable for the Network Chaos Injector.
 * This script parses command-line arguments, loads a chaos configuration file,
 * starts the chaos injector, and then executes a target Node.js script.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';

import { Injector } from '../src/injector.js';
import { ConfigValidationError } from '../src/utils/config-validator.js';

/**
 * Dynamically imports a configuration file.
 * Supports both ES Modules (.js, .mjs) and CommonJS (.cjs) by adding a cache-busting
 * query string to the path, which forces Node.js to treat it as an ESM.
 *
 * @param {string} configPath - The absolute path to the configuration file.
 * @returns {Promise<object>} The default export from the configuration file.
 * @throws {Error} If the file cannot be loaded or does not have a default export.
 */
async function loadConfig(configPath) {
  try {
    // Use a cache-busting query to ensure Node.js re-evaluates and treats it as an ES module.
    const moduleUrl = `file://${configPath}?t=${Date.now()}`;
    const configModule = await import(moduleUrl);

    if (configModule.default === undefined) {
      throw new Error(`Configuration file '${configPath}' must have a default export.`);
    }
    if (typeof configModule.default !== 'object' || configModule.default === null) {
      throw new Error(`The default export of '${configPath}' must be an object.`);
    }
    return configModule.default;
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`Configuration file not found at '${configPath}'.`);
    }
    // Re-throw other import errors with more context.
    throw new Error(`Failed to load configuration from '${configPath}': ${error.message}`);
  }
}

/**
 * The main execution function for the CLI.
 *
 * @param {string[]} argv - The command-line arguments.
 */
export async function main(argv) {
  const spinner = ora();
  let injector;
  let childProcess;

  try {
    const parsedArgs = await yargs(hideBin(argv))
      .usage('Usage: chaos-run --config <path/to/chaos.config.js> -- <your-script.js> [script-args...]')
      .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to the chaos configuration file.',
        demandOption: true,
      })
      .help()
      .alias('help', 'h')
      .version(false) // Disable yargs' default version, we can add our own if needed.
      .epilog('For more information, visit the project repository.')
      .fail((msg, err, yargs) => {
        // Custom failure handler for better error messages.
        console.error(`Error: ${msg}\n`);
        yargs.showHelp();
        process.exit(1);
      })
      .parse();

    const { config: configPath, _: scriptAndArgs } = parsedArgs;

    if (scriptAndArgs.length === 0) {
      console.error('Error: No target script specified.');
      console.error('Usage: chaos-run --config <path> -- <script.js> [args]');
      process.exit(1);
    }

    const [targetScript, ...scriptArgs] = scriptAndArgs;

    // 1. Load and validate configuration
    spinner.start('Loading chaos configuration...');
    const absoluteConfigPath = path.resolve(process.cwd(), configPath);
    const chaosConfig = await loadConfig(absoluteConfigPath);
    spinner.succeed('Chaos configuration loaded');

    // 2. Initialize and start the injector
    spinner.start('Initializing chaos injector...');
    injector = new Injector();
    injector.loadRules(chaosConfig.rules); // `loadRules` also validates the config
    injector.start();
    spinner.succeed('Chaos injector is active');

    // 3. Run the target script
    const targetScriptPath = path.resolve(process.cwd(), targetScript);
    spinner.info(`Running target script: ${targetScript} with chaos enabled...`);
    console.log('--------------------------------------------------');

    childProcess = spawn(
      process.execPath, // Use the same node executable that is running this script
      [targetScriptPath, ...scriptArgs],
      {
        stdio: 'inherit', // Pipe stdin, stdout, stderr of the child to the parent
        env: {
          ...process.env,
          // Set an environment variable to indicate that chaos is active.
          // The target application could potentially use this information.
          NETWORK_CHAOS_INJECTOR: 'active',
        },
      }
    );

    // Graceful shutdown logic
    const cleanup = (signal) => {
      spinner.start(`Received ${signal}. Shutting down...`);
      if (injector && injector.isActive()) {
        injector.stop();
        spinner.succeed('Chaos injector stopped.');
      }
      if (childProcess && !childProcess.killed) {
        childProcess.kill(signal);
      }
      process.exit();
    };

    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('SIGTERM', () => cleanup('SIGTERM'));

    // Wait for the child process to exit
    await new Promise((resolve, reject) => {
      childProcess.on('close', (code) => {
        console.log('--------------------------------------------------');
        if (code === 0) {
          spinner.succeed(`Target script finished successfully (exit code ${code}).`);
          resolve();
        } else {
          spinner.warn(`Target script finished with a non-zero exit code: ${code}.`);
          resolve(); // Resolve to allow cleanup, don't reject.
        }
      });

      childProcess.on('error', (err) => {
        console.log('--------------------------------------------------');
        spinner.fail('Failed to start or run target script.');
        reject(err);
      });
    });

  } catch (error) {
    spinner.fail('An unexpected error occurred.');
    if (error instanceof ConfigValidationError) {
      console.error(`Configuration Error: ${error.message}`);
    } else {
      console.error(error.stack || error.message);
    }
    process.exitCode = 1;
  } finally {
    // Final cleanup
    if (injector && injector.isActive()) {
      spinner.start('Stopping chaos injector...');
      injector.stop();
      spinner.succeed('Chaos injector stopped.');
    }
    if (childProcess && !childProcess.killed) {
      childProcess.kill();
    }
  }
}

// Execute the main function if the script is run directly.
// This check prevents the script from running automatically when imported elsewhere.
const isDirectRun = fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  main(process.argv);
}