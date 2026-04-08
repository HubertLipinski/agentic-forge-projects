import chalk from 'chalk';

/**
 * @fileoverview A simple logging utility using 'chalk' for consistent, colored console output.
 * This ensures that all terminal output from the application shares a common style.
 */

/**
 * A singleton-like object that provides methods for logging messages with
 * different levels and colors. This promotes consistency in the CLI's output.
 *
 * Using a plain object with methods is a simple and effective way to group
 * related logging functions without the overhead of a class.
 */
const logger = {
  /**
   * Logs a standard informational message to stdout.
   * @param {string} message - The message to log.
   */
  info(message) {
    // Using console.log for standard informational output.
    console.log(message);
  },

  /**
   * Logs a success message to stdout, typically in green.
   * Useful for indicating that a significant step has completed successfully.
   * @param {string} message - The message to log.
   */
  success(message) {
    console.log(chalk.green(`✔ ${message}`));
  },

  /**
   * Logs a warning message to stderr, typically in yellow.
   * Use this for non-critical issues that the user should be aware of.
   * @param {string} message - The message to log.
   */
  warn(message) {
    // Warnings and errors should go to stderr.
    console.error(chalk.yellow(`⚠ ${message}`));
  },

  /**
   * Logs an error message to stderr, typically in red.
   * Use this for critical failures that may halt the program's execution.
   * @param {string} message - The message to log.
   */
  error(message) {
    console.error(chalk.red(`✖ ${message}`));
  },

  /**
   * Logs a debug message, only if the `DEBUG` environment variable is set.
   * These messages are for developers of the tool and are hidden by default.
   * The output is styled to be distinct from other log types.
   * @param {string} message - The debug message to log.
   */
  debug(message) {
    // The `process.env.DEBUG` check allows for opt-in verbose logging.
    // The value of DEBUG can be a wildcard '*' or specific to this tool.
    if (process.env.DEBUG) {
      console.log(chalk.magenta(`[DEBUG] ${message}`));
    }
  },

  /**
   * A collection of chalk styles for direct use when building more complex
   * log messages in other parts of the application. This centralizes color
   * definitions and ensures a consistent palette.
   */
  style: {
    header: chalk.bold.cyan,
    command: chalk.yellow,
    path: chalk.cyan,
    ref: chalk.bold.magenta,
    metric: chalk.blue,
    value: chalk.bold.white,
    improvement: chalk.green,
    regression: chalk.red,
    neutral: chalk.gray,
  },
};

export default logger;