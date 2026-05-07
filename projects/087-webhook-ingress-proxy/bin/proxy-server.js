#!/usr/bin/env node

/**
 * @fileoverview The main executable CLI script for the Webhook Ingress Proxy.
 * This script is the entry point for starting the server from the command line.
 * It handles parsing command-line arguments, loading the configuration file,
 * and initializing and starting the Fastify server.
 *
 * It is designed to be robust, providing clear feedback on startup and graceful
 * handling of initialization errors.
 *
 * @example
 * # Start the server with a specific config file
 * node bin/proxy-server.js --config ./config/routes.dev.yml
 *
 * @example
 * # Show help message
 * node bin/proxy-server.js --help
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../src/utils/logger.js';
import { loadConfig } from '../src/config/loader.js';
import { startServer } from '../src/server.js';

// Determine the project root directory to resolve default paths correctly.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Parses command-line arguments using yargs.
 * This function defines the expected CLI arguments, their types, descriptions,
 * and default values, providing a user-friendly command-line interface.
 *
 * @param {string[]} argv - The command-line arguments array (e.g., process.argv).
 * @returns {object} The parsed arguments object.
 */
function parseCliArgs(argv) {
  return yargs(hideBin(argv))
    .usage('Usage: $0 [options]')
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to the configuration file (YAML or JSON).',
      default: path.resolve(projectRoot, 'config', 'routes.example.yml'),
      normalize: true, // Ensures the path is resolved correctly.
    })
    .option('log-level', {
      alias: 'l',
      type: 'string',
      description: 'Override the log level from the config file.',
      choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
    })
    .help('h')
    .alias('h', 'help')
    .version(false) // Disable default version, or customize with package.json version
    .alias('v', 'version')
    .epilogue(
      'For more information, visit the project repository at https://github.com/your-username/webhook-ingress-proxy'
    )
    .strict() // Report errors for unknown options.
    .parse();
}

/**
 * The main asynchronous function that orchestrates the application startup.
 * It encapsulates the entire startup sequence: parsing arguments, loading
 * configuration, and starting the server. This allows for clean async/await
 * syntax and centralized error handling.
 */
async function main() {
  try {
    const argv = parseCliArgs(process.argv);

    logger.info('Starting Webhook Ingress Proxy...');

    // If a log level is provided via CLI, it overrides any other setting.
    // We update the global logger instance level.
    if (argv.logLevel) {
      logger.level = argv.logLevel;
      logger.info(`Log level set to '${argv.logLevel}' via command line.`);
    }

    // Load and validate the configuration file.
    // This is a critical step; if it fails, the server cannot start.
    const config = await loadConfig(argv.config);

    // The configuration might specify a log level. If not set by CLI, use this.
    // The order of precedence is: CLI > Config File > Environment Variable > Default.
    if (!argv.logLevel && config.server?.logLevel) {
      logger.level = config.server.logLevel;
      logger.info(
        `Log level set to '${config.server.logLevel}' from config file.`
      );
    }

    // Initialize and start the Fastify server with the loaded configuration.
    await startServer(config);

    // Graceful shutdown handling
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, () => {
        logger.info(`Received ${signal}. Shutting down gracefully...`);
        // Fastify's `close` method will be called by `startServer`'s error handling
        // or a more sophisticated shutdown manager if implemented. For now, exit.
        // In a real app, you'd close the server, database connections, etc.
        process.exit(0);
      });
    });
  } catch (error) {
    // Catch any errors that occur during the startup process.
    // `loadConfig` and `startServer` are designed to throw on critical errors.
    // The logger will have already logged the specific error details.
    logger.fatal(
      { err: error },
      'A fatal error occurred during application startup. The process will now exit.'
    );
    // Exit with a non-zero code to indicate failure, which is important for
    // process managers and CI/CD pipelines.
    process.exit(1);
  }
}

// Execute the main function to start the application.
main();