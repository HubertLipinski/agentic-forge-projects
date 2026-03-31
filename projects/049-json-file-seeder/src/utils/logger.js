/**
 * @file src/utils/logger.js
 * @description A simple console logger utility that formats output with timestamps and log levels.
 */

/**
 * ANSI color codes for terminal output.
 * Using these makes the logs easier to read at a glance.
 */
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  FG_BLUE: '\x1b[34m',
  FG_YELLOW: '\x1b[33m',
  FG_RED: '\x1b[31m',
  FG_WHITE: '\x1b[37m',
};

/**
 * Log levels and their associated colors.
 */
const LEVELS = {
  INFO: {
    name: 'INFO',
    color: COLORS.FG_BLUE
  },
  WARN: {
    name: 'WARN',
    color: COLORS.FG_YELLOW
  },
  ERROR: {
    name: 'ERROR',
    color: COLORS.FG_RED
  },
};

/**
 * Formats a log message with a timestamp, log level, and color.
 *
 * @param {object} level - The log level object (e.g., LEVELS.INFO).
 * @param {string} message - The message to log.
 * @returns {string} The formatted log string.
 */
const formatMessage = (level, message) => {
  const timestamp = new Date().toISOString();
  return `${COLORS.DIM}${timestamp}${COLORS.RESET} ${level.color}${COLORS.BRIGHT}${level.name.padEnd(5)}${COLORS.RESET} ${message}`;
};

/**
 * A simple logger object with methods for different log levels.
 * Each method prints a formatted message to the appropriate console stream.
 */
const logger = {
  /**
   * Logs an informational message to stdout.
   * @param {string} message - The message to log.
   */
  info(message) {
    // eslint-disable-next-line no-console
    console.log(formatMessage(LEVELS.INFO, message));
  },

  /**
   * Logs a warning message to stderr.
   * @param {string} message - The message to log.
   */
  warn(message) {
    // eslint-disable-next-line no-console
    console.warn(formatMessage(LEVELS.WARN, message));
  },

  /**
   * Logs an error message to stderr.
   * If the message is an Error object, its stack is also logged for better debugging.
   * @param {string | Error} message - The message or Error object to log.
   */
  error(message) {
    if (message instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(formatMessage(LEVELS.ERROR, message.message));
      // eslint-disable-next-line no-console
      console.error(`${COLORS.FG_RED}${message.stack}${COLORS.RESET}`);
    } else {
      // eslint-disable-next-line no-console
      console.error(formatMessage(LEVELS.ERROR, message));
    }
  },
};

export default logger;