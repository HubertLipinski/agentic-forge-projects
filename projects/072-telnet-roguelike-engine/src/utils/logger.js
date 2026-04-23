import chalk from 'chalk';

/**
 * @fileoverview A simple logging utility with timestamp and level support.
 * This module provides a singleton logger instance configured with different
 * logging levels, each with a distinct color for easy readability in the console.
 * The log level is determined by the `LOG_LEVEL` environment variable, defaulting to 'info'.
 */

/**
 * Defines the available logging levels and their severity.
 * A lower number indicates a higher priority.
 * @enum {number}
 */
const LogLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

/**
 * Maps logging levels to chalk functions for colored console output.
 * @type {Object.<string, import('chalk').Chalk>}
 */
const LevelColors = {
    error: chalk.red.bold,
    warn: chalk.yellow.bold,
    info: chalk.cyan.bold,
    debug: chalk.magenta.bold,
};

/**
 * Maps logging levels to chalk functions for the message part of the log.
 * @type {Object.<string, import('chalk').Chalk>}
 */
const MessageColors = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.white,
    debug: chalk.gray,
};

/**
 * A simple, configurable logger class.
 *
 * This class provides leveled logging to the console. The log level can be set
 * during instantiation or via the `LOG_LEVEL` environment variable. Messages
 * are timestamped and color-coded based on their level.
 */
class Logger {
    /**
     * The current logging level. Only messages with a level at or above
     * this will be displayed.
     * @type {number}
     */
    #level;

    /**
     * Creates an instance of Logger.
     * @param {string} [level='info'] - The maximum log level to display.
     *        Can be 'error', 'warn', 'info', or 'debug'.
     */
    constructor(level = 'info') {
        this.setLevel(level);
    }

    /**
     * Sets the maximum log level to display.
     * @param {string} newLevel - The new log level.
     */
    setLevel(newLevel) {
        const normalizedLevel = newLevel.toLowerCase();
        if (Object.keys(LogLevels).includes(normalizedLevel)) {
            this.#level = LogLevels[normalizedLevel];
        } else {
            this.#level = LogLevels.info;
            this.warn(`Invalid log level '${newLevel}'. Defaulting to 'info'.`);
        }
    }

    /**
     * Generates a formatted timestamp string (e.g., "HH:MM:SS.ms").
     * @returns {string} The formatted timestamp.
     */
    #getTimestamp() {
        const now = new Date();
        const time = now.toTimeString().split(' ')[0];
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        return `${time}.${milliseconds}`;
    }

    /**
     * The core logging method.
     * @param {keyof typeof LogLevels} level - The level of the message.
     * @param {...any} args - The message parts to log.
     */
    #log(level, ...args) {
        if (LogLevels[level] > this.#level) {
            return;
        }

        const timestamp = chalk.gray(this.#getTimestamp());
        const levelTag = LevelColors[level](level.toUpperCase().padStart(5));
        const messageColor = MessageColors[level];

        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
        ).join(' ');

        // Using console[level] or console.log ensures proper handling by Node.js/PM2
        const logMethod = console[level] || console.log;
        logMethod(`${timestamp} ${levelTag} ${messageColor(message)}`);
    }

    /**
     * Logs an error message.
     * @param {...any} args - The message parts to log.
     */
    error(...args) {
        this.#log('error', ...args);
    }

    /**
     * Logs a warning message.
     * @param {...any} args - The message parts to log.
     */
    warn(...args) {
        this.#log('warn', ...args);
    }

    /**
     * Logs an informational message.
     * @param {...any} args - The message parts to log.
     */
    info(...args) {
        this.#log('info', ...args);
    }

    /**
     * Logs a debug message.
     * @param {...any} args - The message parts to log.
     */
    debug(...args) {
        this.#log('debug', ...args);
    }
}

/**
 * A singleton instance of the Logger.
 * The log level is determined by the `LOG_LEVEL` environment variable,
 * defaulting to 'info'. This allows for easy configuration of log verbosity
 * without code changes (e.g., `LOG_LEVEL=debug node src/index.js`).
 *
 * @type {Logger}
 */
const logger = new Logger(process.env.LOG_LEVEL ?? 'info');

export default logger;