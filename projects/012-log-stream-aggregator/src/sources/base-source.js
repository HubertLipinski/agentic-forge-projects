/**
 * @file src/sources/base-source.js
 * @description A base class for creating different log sources, managing state,
 * and emitting standardized events.
 *
 * This abstract class provides a common interface and shared functionality for all
 * log source implementations (e.g., File, TCP, Stdin). It leverages Node.js's
 * `EventEmitter` to signal log data, errors, and state changes.
 *
 * Subclasses are expected to implement the `start()` and `close()` methods to
 * handle the specific logic for their source type.
 */

import { EventEmitter } from 'node:events';
import { parseAndEnrich } from '../utils/log-parser.js';

/**
 * @class BaseSource
 * @extends EventEmitter
 * @description Abstract base class for all log sources.
 *
 * Emits the following events:
 * - `log`: (logObject: object) - When a new log entry has been parsed and enriched.
 * - `error`: (error: Error) - When a non-fatal error occurs within the source.
 * - `open`: () - When the source has successfully started listening.
 * - `close`: () - When the source has been successfully closed.
 */
export class BaseSource extends EventEmitter {
  /**
   * The identifier for this log source (e.g., file path, 'stdin', 'tcp:3000').
   * @type {string}
   * @protected
   */
  _sourceIdentifier;

  /**
   * The internal logger instance for the source.
   * @type {import('pino').Logger}
   * @protected
   */
  _logger;

  /**
   * The current state of the source.
   * @type {'idle' | 'opening' | 'open' | 'closing' | 'closed'}
   * @private
   */
  _state = 'idle';

  /**
   * Creates an instance of BaseSource.
   * @param {string} sourceIdentifier - A unique string identifying the source.
   * @param {import('pino').Logger} logger - The pino logger instance for internal logging.
   * @throws {Error} if sourceIdentifier or logger is not provided.
   */
  constructor(sourceIdentifier, logger) {
    super();

    if (!sourceIdentifier || typeof sourceIdentifier !== 'string') {
      throw new Error('BaseSource requires a valid sourceIdentifier string.');
    }
    if (!logger || typeof logger.info !== 'function') {
      throw new Error('BaseSource requires a valid pino logger instance.');
    }

    this._sourceIdentifier = sourceIdentifier;
    this._logger = logger.child({ source: this.identifier });
    this._state = 'idle';
  }

  /**
   * Gets the source identifier.
   * @returns {string} The identifier for this source.
   */
  get identifier() {
    return this._sourceIdentifier;
  }

  /**
   * Gets the current state of the source.
   * @returns {string} The current state.
   */
  get state() {
    return this._state;
  }

  /**
   * Abstract method to start the log source.
   * Subclasses must implement this to begin listening for or reading log data.
   * This method should transition the state to 'open' upon success and emit the 'open' event.
   * @abstract
   * @returns {Promise<void>}
   */
  async start() {
    throw new Error('The "start" method must be implemented by subclasses.');
  }

  /**
   * Abstract method to close the log source.
   * Subclasses must implement this to release resources (e.g., close file handles, servers).
   * This method should transition the state to 'closed' upon success and emit the 'close' event.
   * @abstract
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('The "close" method must be implemented by subclasses.');
  }

  /**
   * Processes a raw log line, enriches it, and emits it as a 'log' event.
   * This is a utility method for subclasses to use.
   * @param {string} line - The raw log line string.
   * @protected
   */
  _processLine(line) {
    if (typeof line !== 'string' || line.trim() === '') {
      return; // Ignore empty or non-string lines
    }
    const structuredLog = parseAndEnrich(line, this.identifier);
    this.emit('log', structuredLog);
  }

  /**
   * Emits a standardized 'error' event and logs it internally.
   * This is a utility method for subclasses to report non-fatal errors.
   * @param {Error} error - The error object.
   * @param {string} context - A string describing the context where the error occurred.
   * @protected
   */
  _handleError(error, context) {
    const errorMessage = `Error in ${this.identifier} source during ${context}: ${error.message}`;
    this._logger.error({ err: error }, errorMessage);
    this.emit('error', new Error(errorMessage, { cause: error }));
  }
}