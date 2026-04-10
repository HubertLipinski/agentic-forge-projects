/**
 * @file src/utils/logger.js
 * @description A simple console logger with color-coded output.
 *
 * This utility provides a standardized way to log messages with different severity levels (info, warning, error, success).
 * It uses ANSI escape codes for coloring, making the console output more readable.
 * The logger also respects the `NO_COLOR` environment variable to disable colorized output when needed.
 */

/**
 * ANSI escape codes for terminal colors.
 * @see {@link https://en.wikipedia.org/wiki/ANSI_escape_code#Colors}
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * A flag to determine if colorized output should be used.
 * The `NO_COLOR` standard is respected.
 * @see {@link https://no-color.org/}
 */
const useColor = !process.env.NO_COLOR && process.stdout.isTTY;

/**
 * Wraps a string with ANSI color codes.
 * If color is disabled, returns the original string.
 * @param {string} str - The string to colorize.
 * @param {string} color - The ANSI color code to apply.
 * @returns {string} The colorized string.
 */
const colorize = (str, color) => (useColor ? `${color}${str}${colors.reset}` : str);

/**
 * Formats a message with a timestamp and a colored prefix.
 * @param {string} level - The log level (e.g., 'INFO', 'WARN').
 * @param {string} color - The ANSI color code for the prefix.
 * @param {string} message - The main log message.
 * @returns {string} The formatted log string.
 */
const formatMessage = (level, color, message) => {
  const timestamp = new Date().toISOString();
  const prefix = colorize(`[${level}]`, `${colors.bright}${color}`);
  return `${timestamp} ${prefix} ${message}`;
};

/**
 * The logger object containing methods for different log levels.
 */
const logger = {
  /**
   * Logs an informational message.
   * @param {string} message - The message to log.
   */
  info(message) {
    console.info(formatMessage('INFO', colors.cyan, message));
  },

  /**
   * Logs a success message.
   * @param {string} message - The message to log.
   */
  success(message) {
    console.log(formatMessage('SUCCESS', colors.green, message));
  },

  /**
   * Logs a warning message.
   * @param {string} message - The message to log.
   */
  warn(message) {
    console.warn(formatMessage('WARN', colors.yellow, message));
  },

  /**
   * Logs an error message.
   * If the second argument is an Error object, its stack trace is also logged.
   * @param {string} message - The message to log.
   * @param {Error} [error] - An optional Error object to include.
   */
  error(message, error) {
    console.error(formatMessage('ERROR', colors.red, message));
    if (error instanceof Error && error.stack) {
      // Log stack trace on a new line for better readability, without the full prefix.
      console.error(colorize(error.stack, colors.red));
    }
  },

  /**
   * Logs a message with a custom prefix, useful for specific contexts like 'DRY-RUN'.
   * @param {string} prefix - The custom prefix for the log entry.
   * @param {string} message - The message to log.
   */
  log(prefix, message) {
    console.log(formatMessage(prefix.toUpperCase(), colors.blue, message));
  },
};

export default logger;