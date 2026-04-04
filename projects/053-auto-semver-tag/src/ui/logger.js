/**
 * @file src/ui/logger.js
 * @description A simple logging utility using 'chalk' to provide color-coded feedback to the user in the terminal.
 * This module centralizes all console output, making it easy to manage logging levels,
 * add prefixes, or redirect output in the future if needed.
 */

import chalk from 'chalk';

/**
 * A symbol to control verbosity. If this is set to true on the logger object,
 * verbose messages will be displayed.
 * @type {symbol}
 */
const VERBOSE_MODE = Symbol('verboseMode');

/**
 * A simple logger object that provides color-coded output to the console.
 * It uses `chalk` to style messages for different levels (info, success, warn, error).
 *
 * The logger is designed as a plain object with methods, which allows for easy
 * state management (like verbosity) without needing a class instance.
 */
const logger = {
  [VERBOSE_MODE]: false,

  /**
   * Enables or disables verbose logging.
   * When enabled, `verbose()` messages will be printed to the console.
   * @param {boolean} isVerbose - Set to true to enable verbose mode, false to disable.
   */
  setVerbose(isVerbose) {
    this[VERBOSE_MODE] = !!isVerbose;
  },

  /**
   * Logs an informational message. Typically used for neutral status updates.
   * Color: Blue
   * @param {string} message - The message to log.
   */
  info(message) {
    console.log(chalk.blue(`[INFO] ${message}`));
  },

  /**
   * Logs a success message. Typically used for successful operations.
   * Color: Green
   * @param {string} message - The message to log.
   */
  success(message) {
    console.log(chalk.green(`[SUCCESS] ${message}`));
  },

  /**
   * Logs a warning message. Used for non-critical issues that the user should be aware of.
   * Color: Yellow
   * @param {string} message - The message to log.
   */
  warn(message) {
    console.warn(chalk.yellow(`[WARN] ${message}`));
  },

  /**
   * Logs an error message. Used for critical failures that may halt execution.
   * Color: Red
   * @param {string} message - The message to log.
   */
  error(message) {
    console.error(chalk.red(`[ERROR] ${message}`));
  },

  /**
   * Logs a message only if verbose mode is enabled.
   * Useful for debugging information that shouldn't be shown by default.
   * Color: Gray
   * @param {string} message - The message to log.
   */
  verbose(message) {
    if (this[VERBOSE_MODE]) {
      console.log(chalk.gray(`[VERBOSE] ${message}`));
    }
  },

  /**
   * Logs a section header or a title.
   * Useful for visually separating different stages of the process.
   * Style: Bold and underlined.
   * @param {string} title - The title text to display.
   */
  title(title) {
    console.log(chalk.bold.underline(`\n--- ${title} ---\n`));
  },

  /**
   * Logs a block of text without any prefix or special formatting.
   * Useful for printing multi-line content like a changelog.
   * @param {string} text - The text to log.
   */
  log(text) {
    console.log(text);
  },
};

export default logger;