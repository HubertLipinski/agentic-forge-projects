/**
 * @file src/sources/stdin-source.js
 * @description Implements a log source that reads from the standard input stream.
 *
 * This class reads data line-by-line from `process.stdin`, making it possible
 * to pipe log data directly into the aggregator from other processes. It is a
 * singleton-like source, as there is only one standard input for a process.
 * It handles the stream lifecycle and ensures clean processing of input.
 */

import { createInterface } from 'node:readline';
import { BaseSource } from './base-source.js';

/**
 * @class StdinSource
 * @extends BaseSource
 * @description A log source that reads from `process.stdin`.
 */
export class StdinSource extends BaseSource {
  /**
   * The readline interface for process.stdin.
   * @type {import('readline').Interface | null}
   * @private
   */
  _readlineInterface = null;

  /**
   * Creates an instance of StdinSource.
   * @param {import('pino').Logger} logger - The pino logger instance for internal logging.
   */
  constructor(logger) {
    // Stdin is a unique, singular source.
    super('stdin', logger);
  }

  /**
   * Starts reading from the standard input stream.
   * It sets up a readline interface to process the input line by line.
   * @override
   * @returns {Promise<void>}
   */
  async start() {
    if (this._state !== 'idle') {
      this._logger.warn(`Attempted to start source in non-idle state: ${this._state}`);
      return;
    }

    // Check if stdin is a TTY. If it is, it means the user is likely running the
    // aggregator interactively without piping data. We can still listen, but
    // it's good to inform them.
    if (process.stdin.isTTY) {
      this._logger.info('Listening on stdin. The terminal is interactive. Type log lines and press Enter.');
    } else {
      this._logger.info('Listening for log data piped to stdin.');
    }

    this._state = 'opening';

    try {
      this._readlineInterface = createInterface({
        input: process.stdin,
        crlfDelay: Infinity, // Handles various newline characters gracefully.
      });

      this._readlineInterface.on('line', (line) => {
        this._processLine(line);
      });

      this._readlineInterface.on('close', () => {
        // This event fires when the stdin stream ends (e.g., EOF from a pipe).
        // We log this and transition to a closed state, as no more data will arrive.
        this._logger.info('Stdin stream has ended (EOF). Closing source.');
        // We don't call `this.close()` to avoid a potential loop. We just update the state.
        if (this._state !== 'closed') {
          this._state = 'closed';
          this.emit('close');
        }
      });

      // Unlike server or file watchers, stdin is "open" for reading immediately.
      this._state = 'open';
      this.emit('open');
    } catch (error) {
      this._state = 'idle';
      this._handleError(error, 'initializing stdin reader');
      // This is a critical failure during startup.
      throw new Error(`Failed to start stdin source: ${error.message}`, { cause: error });
    }
  }

  /**
   * Stops reading from the standard input stream.
   * In practice, we can't truly "close" stdin without terminating the process.
   * This method primarily cleans up the readline interface and updates the state.
   * @override
   * @returns {Promise<void>}
   */
  async close() {
    if (this._state !== 'open') {
      this._logger.warn(`Attempted to close source in non-open state: ${this._state}`);
      return;
    }

    this._state = 'closing';
    this._logger.info('Closing stdin source.');

    if (this._readlineInterface) {
      // Closing the readline interface removes its listeners from stdin.
      this._readlineInterface.close();
      this._readlineInterface = null;
    }

    // We pause stdin to signal that we are no longer consuming data from it.
    // This can help prevent the process from hanging if data is still being piped.
    if (!process.stdin.isPaused()) {
      process.stdin.pause();
    }

    this._state = 'closed';
    this.emit('close');
    this._logger.info('Stdin source closed.');
  }
}