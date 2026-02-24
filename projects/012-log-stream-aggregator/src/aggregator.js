/**
 * @file src/aggregator.js
 * @description The core class that manages multiple log sources, aggregates their
 * events, and pipes the structured data to a single output stream.
 *
 * This class is the heart of the log-stream-aggregator. It instantiates and
 * manages the lifecycle of various log sources (File, TCP, Stdin), listens for
 * their 'log' and 'error' events, and writes the resulting structured JSON
 * data to a specified output stream (typically `process.stdout`). It also
 * handles graceful shutdown of all sources.
 */

import { Writable } from 'node:stream';
import { FileSource } from './sources/file-source.js';
import { TcpSource } from './sources/tcp-source.js';
import { StdinSource } from './sources/stdin-source.js';

/**
 * @class LogAggregator
 * @description Manages multiple log sources and aggregates their output.
 */
export class LogAggregator {
  /**
   * Internal logger for the aggregator itself.
   * @type {import('pino').Logger}
   * @private
   */
  _logger;

  /**
   * The stream to which aggregated JSON logs are written.
   * @type {Writable}
   * @private
   */
  _outputStream;

  /**
   * An array holding all active source instances.
   * @type {import('./sources/base-source.js').BaseSource[]}
   * @private
   */
  _sources = [];

  /**
   * The overall state of the aggregator.
   * @type {'idle' | 'starting' | 'running' | 'stopping' | 'stopped'}
   * @private
   */
  _state = 'idle';

  /**
   * Creates an instance of LogAggregator.
   * @param {object} options - Configuration options for the aggregator.
   * @param {string[]} [options.files=[]] - An array of file paths to tail.
   * @param {number[]} [options.tcpPorts=[]] - An array of TCP ports to listen on.
   * @param {boolean} [options.stdin=false] - Whether to read from stdin.
   * @param {import('pino').Logger} options.logger - The pino logger instance for internal logging.
   * @param {Writable} [options.outputStream=process.stdout] - The stream to write aggregated logs to.
   */
  constructor({
    files = [],
    tcpPorts = [],
    stdin = false,
    logger,
    outputStream = process.stdout,
  }) {
    if (!logger || typeof logger.info !== 'function') {
      throw new Error('LogAggregator requires a valid pino logger instance.');
    }
    this._logger = logger.child({ component: 'aggregator' });
    this._outputStream = outputStream;

    this._initializeSources({ files, tcpPorts, stdin });
  }

  /**
   * Initializes all configured log sources based on the provided options.
   * @param {object} options - Source configuration.
   * @param {string[]} options.files - File paths.
   * @param {number[]} options.tcpPorts - TCP ports.
   * @param {boolean} options.stdin - Stdin flag.
   * @private
   */
  _initializeSources({ files, tcpPorts, stdin }) {
    this._logger.info('Initializing log sources...');

    files.forEach(file => {
      try {
        const fileSource = new FileSource(file, this._logger);
        this._sources.push(fileSource);
        this._logger.info(`Initialized file source for: ${file}`);
      } catch (error) {
        this._logger.error({ err: error, file }, 'Failed to initialize file source.');
      }
    });

    tcpPorts.forEach(port => {
      try {
        const tcpSource = new TcpSource(port, this._logger);
        this._sources.push(tcpSource);
        this._logger.info(`Initialized TCP source on port: ${port}`);
      } catch (error) {
        this._logger.error({ err: error, port }, 'Failed to initialize TCP source.');
      }
    });

    if (stdin) {
      try {
        const stdinSource = new StdinSource(this._logger);
        this._sources.push(stdinSource);
        this._logger.info('Initialized stdin source.');
      } catch (error) {
        this._logger.error({ err: error }, 'Failed to initialize stdin source.');
      }
    }

    if (this._sources.length === 0) {
      this._logger.warn('No log sources were configured. The aggregator will be idle.');
    }
  }

  /**
   * Starts all configured log sources and begins aggregation.
   * @returns {Promise<void>} A promise that resolves when all sources have started.
   */
  async start() {
    if (this._state !== 'idle') {
      this._logger.warn(`Cannot start aggregator in state: ${this._state}`);
      return;
    }

    this._state = 'starting';
    this._logger.info('Starting log aggregator...');

    if (this._sources.length === 0) {
      this._state = 'running'; // Technically running, but doing nothing.
      this._logger.info('Aggregator is running but has no sources to monitor.');
      return;
    }

    this._sources.forEach(source => {
      source.on('log', this._handleLog.bind(this));
      source.on('error', this._handleSourceError.bind(this));
    });

    const startPromises = this._sources.map(source =>
      source.start().catch(err => {
        // Log the startup failure but don't let it stop other sources from starting.
        this._logger.fatal(
          { err, source: source.identifier },
          'A critical error occurred while starting a source. This source will be inactive.'
        );
      })
    );

    await Promise.all(startPromises);

    this._state = 'running';
    this._logger.info('Log aggregator is now running and monitoring all active sources.');
  }

  /**
   * Gracefully stops all log sources and shuts down the aggregator.
   * @returns {Promise<void>} A promise that resolves when all sources are closed.
   */
  async stop() {
    if (this._state !== 'running' && this._state !== 'starting') {
      this._logger.warn(`Cannot stop aggregator in state: ${this._state}`);
      return;
    }

    this._state = 'stopping';
    this._logger.info('Stopping log aggregator...');

    const closePromises = this._sources.map(source =>
      source.close().catch(err => {
        // Log errors during shutdown but continue the process.
        this._logger.error(
          { err, source: source.identifier },
          'An error occurred while closing a source.'
        );
      })
    );

    await Promise.all(closePromises);

    this._state = 'stopped';
    this._logger.info('Log aggregator has been stopped successfully.');
  }

  /**
   * Handles a 'log' event from a source.
   * It formats the structured log object as a JSON string and writes it to the output stream.
   * @param {object} logObject - The structured log object from a source.
   * @private
   */
  _handleLog(logObject) {
    try {
      const jsonLine = JSON.stringify(logObject);
      this._outputStream.write(`${jsonLine}\n`);
    } catch (error) {
      // This might happen if the logObject contains circular references, though unlikely
      // with the current parsing logic.
      this._logger.error({ err: error, logId: logObject?.id }, 'Failed to serialize log object to JSON.');
    }
  }

  /**
   * Handles a non-fatal 'error' event from a source.
   * This is primarily for logging purposes, as the source itself is responsible for
   * managing its state after an error.
   * @param {Error} error - The error object emitted by the source.
   * @private
   */
  _handleSourceError(error) {
    // The source itself already logs the detailed error. This is a higher-level
    // log from the aggregator's perspective.
    this._logger.warn({ err: error }, 'A non-fatal error was reported by a source.');
  }
}