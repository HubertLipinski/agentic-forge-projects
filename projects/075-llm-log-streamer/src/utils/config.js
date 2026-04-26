/**
 * @file src/utils/config.js
 * @description Handles parsing and validating configuration from command-line arguments and environment variables.
 *
 * This module uses `yargs` to define the application's configuration schema,
 * including command-line flags and corresponding environment variables. It provides
 * default values and validation for a robust configuration setup.
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

/**
 * Defines the configuration schema, default values, and descriptions.
 * Uses yargs for parsing command-line arguments and environment variables.
 *
 * @param {string[]} argv - The process arguments, typically `process.argv`.
 * @returns {object} The parsed and validated configuration object.
 */
export function parseConfig(argv) {
  const options = yargs(hideBin(argv))
    .usage('Usage: $0 [options]')
    .option('host', {
      alias: 'h',
      type: 'string',
      description: 'The hostname for the proxy server to listen on.',
      default: '127.0.0.1',
      group: 'Server Configuration:',
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'The port for the proxy server to listen on.',
      default: 8080,
      group: 'Server Configuration:',
    })
    .option('openai-target', {
      type: 'string',
      description: 'The base URL of the OpenAI API to forward requests to.',
      default: 'https://api.openai.com',
      group: 'Proxy Configuration:',
    })
    .option('log-level', {
      type: 'string',
      description: 'The minimum log level to output.',
      choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
      default: 'info',
      group: 'Logging Configuration:',
    })
    .option('log-transports', {
      type: 'array',
      description: 'A list of transports to send logs to (e.g., console).',
      default: ['console'],
      group: 'Logging Configuration:',
    })
    .option('log-pretty', {
      type: 'boolean',
      description: 'Enable pretty-printing for console logs (for development).',
      default: true,
      group: 'Logging Configuration:',
    })
    .option('mask-headers', {
      type: 'array',
      description: 'A list of HTTP header names to mask in logs.',
      default: ['authorization', 'api-key', 'x-api-key'],
      group: 'Security Configuration:',
    })
    .option('mask-body-keys', {
      type: 'array',
      description: 'A list of JSON body property keys to mask in logs.',
      default: ['key', 'secret'],
      group: 'Security Configuration:',
    })
    .env('LLM_LOG_STREAMER')
    .alias('help', 'help')
    .alias('version', 'v')
    .wrap(Math.min(120, yargs(hideBin(argv)).terminalWidth()))
    .epilogue(
      'For more information, visit https://github.com/your-username/llm-log-streamer',
    )
    .fail((msg, err, yargs) => {
      // Custom failure handler to provide a cleaner error message
      if (err) {
        // Preserve stack trace for debugging
        console.error(err);
        process.exit(1);
      }
      console.error('Error:');
      console.error(`  ${msg}\n`);
      console.error('Run with --help for a list of available options.');
      process.exit(1);
    }).argv;

  // Perform custom validations
  if (options.port < 1 || options.port > 65535) {
    throw new Error(
      `Invalid port: ${options.port}. Port must be between 1 and 65535.`,
    );
  }

  try {
    // Validate the target URL
    // eslint-disable-next-line no-new
    new URL(options.openaiTarget);
  } catch (error) {
    throw new Error(
      `Invalid OpenAI target URL: ${options.openaiTarget}. Please provide a valid URL.`,
    );
  }

  return options;
}

/**
 * Singleton instance of the application configuration.
 * Parsed once and exported for use throughout the application.
 */
let configInstance;

/**
 * Returns the singleton configuration object for the application.
 * If the configuration has not been parsed yet, it will be parsed from `process.argv`.
 *
 * @returns {object} The application configuration object.
 */
export function getConfig() {
  if (!configInstance) {
    try {
      configInstance = parseConfig(process.argv);
    } catch (error) {
      console.error(`[CONFIG ERROR] Failed to initialize configuration: ${error.message}`);
      // Exit gracefully if configuration fails, as the application cannot run.
      process.exit(1);
    }
  }
  return configInstance;
}