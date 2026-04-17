import chalk from 'chalk';

/**
 * Defines the available log levels.
 * The keys are the level names, and the values are their severity order.
 * Higher numbers indicate higher severity.
 * @type {Readonly<Record<string, number>>}
 */
export const LOG_LEVELS = Object.freeze({
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
});

/**
 * The current logging level for the application.
 * Messages with a severity lower than this level will not be displayed.
 * Defaults to 'info'.
 * @type {keyof typeof LOG_LEVELS}
 */
let currentLevel = 'info';

/**
 * A flag to control whether the logger is enabled.
 * If set to false, all logging methods will do nothing.
 * @type {boolean}
 */
let isEnabled = true;

/**
 * Styles for different log levels using chalk.
 * @type {Readonly<Record<keyof typeof LOG_LEVELS, import('chalk').Chalk>>}
 */
const levelStyles = Object.freeze({
  debug: chalk.gray,
  info: chalk.cyan,
  warn: chalk.yellow,
  error: chalk.red.bold,
  silent: chalk.white, // No-op style
});

/**
 * Sets the global logging level.
 * Only messages with a level equal to or higher than the set level will be logged.
 *
 * @param {keyof typeof LOG_LEVELS} newLevel - The new logging level to set.
 *        Can be 'debug', 'info', 'warn', 'error', or 'silent'.
 *        If an invalid level is provided, it defaults to 'info'.
 */
function setLevel(newLevel) {
  if (Object.keys(LOG_LEVELS).includes(newLevel)) {
    currentLevel = newLevel;
  } else {
    // Fallback to a sensible default if an invalid level is provided.
    currentLevel = 'info';
    // Log a warning about the invalid level, but only if the current level isn't 'silent'.
    if (LOG_LEVELS[currentLevel] < LOG_LEVELS.error) {
      console.warn(
        levelStyles.warn(
          `[Logger] Invalid log level "${newLevel}". Defaulting to "${currentLevel}".`
        )
      );
    }
  }
}

/**
 * Enables or disables the logger entirely.
 * When disabled, no messages will be printed, regardless of the log level.
 *
 * @param {boolean} enabled - `true` to enable logging, `false` to disable.
 */
function setEnabled(enabled) {
  isEnabled = !!enabled;
}

/**
 * The core logging function. It formats and outputs a message if the
 * specified level meets the current threshold.
 *
 * @param {keyof typeof LOG_LEVELS} level - The level of the message.
 * @param {Console} stream - The console stream to write to (e.g., console.log, console.error).
 * @param {any[]} messages - The content to log. Can be multiple arguments.
 */
function log(level, stream, ...messages) {
  if (!isEnabled || LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const style = levelStyles[level] || chalk.white;
  const formattedMessages = messages.map(msg => {
    // If the message is an Error object, format it for better readability.
    if (msg instanceof Error) {
      return `\n${style(msg.stack || msg.message)}\n`;
    }
    // If the message is an object, stringify it.
    if (typeof msg === 'object' && msg !== null) {
      try {
        return JSON.stringify(msg, null, 2);
      } catch {
        return '[Unserializable Object]';
      }
    }
    return msg;
  });

  stream(style(...formattedMessages));
}

/**
 * A logger object with methods for each log level.
 * This provides a clean, consistent interface for logging throughout the application.
 */
const logger = {
  /**
   * Logs a debug message. Typically used for verbose, developer-specific information.
   * @param {...any} messages - The content to log.
   */
  debug: (...messages) => log('debug', console.debug, ...messages),

  /**
   * Logs an informational message. Used for general application flow and status updates.
   * @param {...any} messages - The content to log.
   */
  info: (...messages) => log('info', console.info, ...messages),

  /**
   * Logs a warning message. Indicates a potential problem that doesn't prevent
   * the application from continuing.
   * @param {...any} messages - The content to log.
   */
  warn: (...messages) => log('warn', console.warn, ...messages),

  /**
   * Logs an error message. Indicates a failure or critical issue that may
   * prevent the application from completing its task.
   * @param {...any} messages - The content to log.
   */
  error: (...messages) => log('error', console.error, ...messages),

  /**
   * Sets the active log level.
   * @type {typeof setLevel}
   */
  setLevel,

  /**
   * Enables or disables logging globally.
   * @type {typeof setEnabled}
   */
  setEnabled,
};

export default logger;