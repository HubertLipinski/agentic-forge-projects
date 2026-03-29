/**
 * @file src/utils/logger.js
 * @description A simple logging utility with different levels (info, warn, error, debug)
 *              to provide feedback during the scan. It supports configurable log levels
 *              and colorized output for better readability in the terminal.
 */

import { inspect } from 'util';

// ANSI escape codes for colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const LOG_LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const LOG_PREFIXES = {
  error: `${colors.red}[ERROR]${colors.reset}`,
  warn: `${colors.yellow}[WARN]${colors.reset}`,
  info: `${colors.green}[INFO]${colors.reset}`,
  debug: `${colors.blue}[DEBUG]${colors.reset}`,
};

/**
 * The current logging level. Defaults to 'info'.
 * Can be changed by calling `logger.setLevel()`.
 * @type {keyof typeof LOG_LEVELS}
 */
let currentLevel = 'info';

/**
 * Formats a log message, handling various data types.
 * Objects and arrays are formatted using `util.inspect` for better readability.
 *
 * @param {any[]} args - The arguments to format.
 * @returns {string} The formatted log message string.
 */
const formatMessage = (args) => {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      // Use util.inspect for a more detailed view of objects, arrays, etc.
      return inspect(arg, { depth: null, colors: true });
    })
    .join(' ');
};

/**
 * The core logging function. It checks the current log level before writing
 * to the appropriate stream (stdout or stderr).
 *
 * @param {keyof typeof LOG_LEVELS} level - The level of the message (e.g., 'info', 'error').
 * @param {string} prefix - The colored prefix for the log level.
 * @param {NodeJS.WriteStream} stream - The stream to write to (process.stdout or process.stderr).
 * @param {any[]} args - The content of the log message.
 */
const log = (level, prefix, stream, ...args) => {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) {
    return;
  }
  const message = formatMessage(args);
  stream.write(`${prefix} ${message}\n`);
};

const logger = {
  /**
   * Sets the global logging level.
   * @param {keyof typeof LOG_LEVELS} newLevel - The new log level ('silent', 'error', 'warn', 'info', 'debug').
   */
  setLevel(newLevel) {
    if (Object.keys(LOG_LEVELS).includes(newLevel)) {
      currentLevel = newLevel;
    } else {
      this.warn(`Invalid log level: "${newLevel}". Keeping current level: "${currentLevel}".`);
    }
  },

  /**
   * Gets the current logging level.
   * @returns {keyof typeof LOG_LEVELS} The current log level.
   */
  getLevel() {
    return currentLevel;
  },

  /**
   * Logs an informational message. Visible at 'info' and 'debug' levels.
   * @param {...any} args - The message parts to log.
   */
  info(...args) {
    log('info', LOG_PREFIXES.info, process.stdout, ...args);
  },

  /**
   * Logs a warning message. Visible at 'warn', 'info', and 'debug' levels.
   * @param {...any} args - The message parts to log.
   */
  warn(...args) {
    log('warn', LOG_PREFIXES.warn, process.stderr, ...args);
  },

  /**
   * Logs an error message. Always visible unless level is 'silent'.
   * @param {...any} args - The message parts to log.
   */
  error(...args) {
    log('error', LOG_PREFIXES.error, process.stderr, ...args);
  },

  /**
   * Logs a debug message. Only visible at 'debug' level.
   * Useful for verbose, development-only output.
   * @param {...any} args - The message parts to log.
   */
  debug(...args) {
    log('debug', LOG_PREFIXES.debug, process.stdout, ...args);
  },
};

export default logger;