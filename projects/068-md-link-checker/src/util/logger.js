/**
 * @file src/util/logger.js
 * @description A simple logging utility using 'chalk' to print colored status
 * messages (e.g., success, error, warning) to the console. This centralizes
 * console output logic for consistent formatting.
 */

import chalk from 'chalk';

/**
 * Logs a standard informational message to the console.
 * @param {string} message - The message to log.
 */
export function log(message) {
  console.log(message);
}

/**
 * Logs a success message, typically prefixed with a green checkmark.
 * @param {string} message - The success message to log.
 */
export function success(message) {
  console.log(chalk.green(`✔ ${message}`));
}

/**
 * Logs an error message, typically prefixed with a red cross.
 * @param {string} message - The error message to log.
 */
export function error(message) {
  console.error(chalk.red(`✖ ${message}`));
}

/**
 * Logs a warning message, typically prefixed with a yellow exclamation mark.
 * @param {string} message - The warning message to log.
 */
export function warn(message) {
  console.warn(chalk.yellow(`! ${message}`));
}

/**
 * Logs a detailed message, often used for file paths or secondary info.
 * The message is indented and colored gray for de-emphasis.
 * @param {string} message - The detailed message to log.
 */
export function detail(message) {
  console.log(chalk.gray(`  ${message}`));
}

/**
 * Logs a header or title for a section of output.
 * The message is bold and underlined for emphasis.
 * @param {string} message - The header text to log.
 */
export function header(message) {
  console.log(chalk.bold.underline(`\n${message}`));
}

/**
 * A collection of logger functions, exported as a single object
 * for convenient namespacing when imported.
 * e.g., `import logger from './logger.js'; logger.success('Done!');`
 */
const logger = {
  log,
  success,
  error,
  warn,
  detail,
  header,
};

export default logger;