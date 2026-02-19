import chalk from 'chalk';

/**
 * @file A simple logger module using 'chalk' that respects a verbose flag to
 * control output level.
 */

/**
 * A singleton-like object to hold the logger's configuration state.
 * This ensures that the verbosity setting is shared across the application
 * wherever the logger is imported.
 *
 * @private
 * @type {{isVerbose: boolean}}
 */
const config = {
  isVerbose: false,
};

/**
 * Sets the verbosity level for the logger.
 * When verbose is true, `log.verbose()` messages will be printed.
 *
 * @param {boolean} isVerbose - Whether to enable verbose logging.
 */
function setVerbose(isVerbose) {
  config.isVerbose = !!isVerbose;
}

/**
 * Logs a standard informational message to the console.
 * These messages are always displayed, regardless of the verbosity setting.
 *
 * @param {string} message - The message to log.
 */
function info(message) {
  console.log(chalk.blue('ℹ'), message);
}

/**
 * Logs a success message to the console.
 * These messages are always displayed.
 *
 * @param {string} message - The message to log.
 */
function success(message) {
  console.log(chalk.green('✔'), message);
}

/**
 * Logs a warning message to the console.
 * These messages are always displayed.
 *
 * @param {string} message - The message to log.
 */
function warn(message) {
  console.warn(chalk.yellow('⚠'), message);
}

/**
 * Logs an error message to the console.
 * These messages are always displayed.
 *
 * @param {string} message - The message to log.
 * @param {Error} [error] - An optional associated error object for more context.
 */
function error(message, error) {
  console.error(chalk.red('✖'), message);
  // If an actual Error object is passed, log its stack for better debugging,
  // especially in verbose mode or if it provides useful context.
  if (error instanceof Error && config.isVerbose) {
    console.error(chalk.red(error.stack));
  }
}

/**
 * Logs a message only if verbose mode is enabled.
 * Useful for debugging information that users don't need to see by default.
 *
 * @param {string} message - The message to log.
 */
function verbose(message) {
  if (config.isVerbose) {
    console.log(chalk.gray('›'), message);
  }
}

/**
 * A collection of logging functions.
 *
 * @example
 * import logger from './utils/logger.js';
 *
 * logger.setVerbose(true);
 * logger.info('Starting process...');
 * logger.verbose('Reading file at path/to/file.json');
 * logger.success('Process complete!');
 * logger.error('Something went wrong.');
 */
const logger = {
  setVerbose,
  info,
  success,
  warn,
  error,
  verbose,
};

export default logger;