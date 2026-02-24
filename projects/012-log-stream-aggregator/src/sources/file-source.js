/**
 * @file src/sources/file-source.js
 * @description Implements a log source for tailing files using `chokidar`.
 *
 * This class watches a specified file for changes, specifically for appends.
 * When new data is added to the file, it reads the new lines, processes them,
 * and emits them as structured log events. It handles file creation, truncation,
* and ensures that only new data is processed.
 */

import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import chokidar from 'chokidar';
import { BaseSource } from './base-source.js';

/**
 * @class FileSource
 * @extends BaseSource
 * @description A log source that tails a file for new log entries.
 */
export class FileSource extends BaseSource {
  /**
   * The chokidar file watcher instance.
   * @type {import('chokidar').FSWatcher | null}
   * @private
   */
  _watcher = null;

  /**
   * The last known size of the file, used to detect appends and truncations.
   * @type {number}
   * @private
   */
  _lastKnownSize = 0;

  /**
   * The absolute path to the file being watched.
   * @type {string}
   * @private
   */
  _filePath;

  /**
   * Creates an instance of FileSource.
   * @param {string} filePath - The path to the log file to tail.
   * @param {import('pino').Logger} logger - The pino logger instance for internal logging.
   */
  constructor(filePath, logger) {
    // We use the file path as the source identifier.
    super(filePath, logger);
    this._filePath = filePath;
  }

  /**
   * Starts watching the file for changes.
   * It initializes the file size and sets up the chokidar watcher to handle
   * 'add' and 'change' events.
   * @override
   * @returns {Promise<void>}
   */
  async start() {
    if (this._state !== 'idle') {
      this._logger.warn(`Attempted to start source in non-idle state: ${this._state}`);
      return;
    }

    this._state = 'opening';
    this._logger.info(`Starting to watch file: ${this._filePath}`);

    try {
      // Get initial file size. If file doesn't exist, stat will throw.
      // We'll handle non-existent files gracefully; chokidar will emit 'add' when it appears.
      const stats = await fs.stat(this._filePath);
      this._lastKnownSize = stats.size;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this._logger.info(`File does not exist yet. Waiting for it to be created: ${this._filePath}`);
        this._lastKnownSize = 0;
      } else {
        this._state = 'idle';
        this._handleError(error, 'getting initial file stats');
        // Re-throw as a fatal startup error
        throw new Error(`Failed to start file source for ${this._filePath}: ${error.message}`, { cause: error });
      }
    }

    this._watcher = chokidar.watch(this._filePath, {
      // We don't need to know the initial state, as we've already handled it.
      ignoreInitial: true,
      // Use polling if native events are not available or problematic (e.g., in some containers).
      // A reasonable interval balances responsiveness and resource usage.
      usePolling: true,
      interval: 250,
      // Ensure we get stat objects to check file size.
      alwaysStat: true,
      // Wait for the file to be fully written before firing events.
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this._watcher
      .on('add', this._handleFileChange.bind(this))
      .on('change', this._handleFileChange.bind(this))
      .on('error', (error) => this._handleError(error, 'watching file'))
      .on('ready', () => {
        this._state = 'open';
        this.emit('open');
        this._logger.info(`Successfully watching file: ${this._filePath}`);
      });
  }

  /**
   * Stops watching the file and closes the source.
   * @override
   * @returns {Promise<void>}
   */
  async close() {
    if (this._state !== 'open') {
      this._logger.warn(`Attempted to close source in non-open state: ${this._state}`);
      return;
    }

    this._state = 'closing';
    this._logger.info(`Closing file source: ${this._filePath}`);

    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
    }

    this._state = 'closed';
    this.emit('close');
    this._logger.info(`File source closed: ${this._filePath}`);
  }

  /**
   * Handles 'add' and 'change' events from chokidar.
   * It determines if the file has grown or been truncated and processes new data accordingly.
   * @param {string} path - The path of the changed file.
   * @param {import('fs').Stats} stats - The stats object for the file.
   * @private
   */
  async _handleFileChange(path, stats) {
    if (!stats) {
      this._logger.warn(`Received file change event for ${path} without stats. Cannot process.`);
      return;
    }

    const newSize = stats.size;

    if (newSize > this._lastKnownSize) {
      // File has grown, read the new content.
      this._logger.debug(`File grew from ${this._lastKnownSize} to ${newSize} bytes. Reading new content.`);
      await this._readNewLines(this._lastKnownSize, newSize);
    } else if (newSize < this._lastKnownSize) {
      // File has been truncated or overwritten.
      this._logger.info(`File truncated from ${this._lastKnownSize} to ${newSize} bytes. Resetting and reading from start.`);
      await this._readNewLines(0, newSize);
    }
    // If newSize === this._lastKnownSize, it might be a metadata-only change, so we do nothing.

    this._lastKnownSize = newSize;
  }

  /**
   * Reads a specific byte range from the file, splits it into lines, and processes each line.
   * @param {number} start - The starting byte offset to read from.
   * @param {number} end - The ending byte offset.
   * @private
   * @returns {Promise<void>}
   */
  async _readNewLines(start, end) {
    if (start >= end) {
      return; // Nothing to read.
    }

    try {
      const stream = createReadStream(this._filePath, {
        encoding: 'utf8',
        start,
        end: end - 1, // `end` is inclusive, so subtract 1.
      });

      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity, // Handles both \r\n and \n line endings.
      });

      for await (const line of rl) {
        this._processLine(line);
      }
    } catch (error) {
      this._handleError(error, `reading file from offset ${start}`);
    }
  }
}