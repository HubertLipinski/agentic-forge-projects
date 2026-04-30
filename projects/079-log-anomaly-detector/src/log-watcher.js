/**
 * @file src/log-watcher.js
 * @description Uses `chokidar` to watch specified log files or directories.
 * Reads new lines and passes them to the analysis pipeline.
 *
 * This module is the entry point for log data into the system. It handles the
 * complexities of file watching, including handling new files, file rotation
 * (by re-attaching to new files with the same name), and efficiently reading
 * only the new content from appended files.
 */

import chokidar from 'chokidar';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import readline from 'node:readline';

/**
 * A Map to keep track of the last known size of each watched file.
 * This allows us to read only the new content that has been appended.
 * The key is the absolute file path, and the value is the file size in bytes.
 * @type {Map<string, number>}
 */
const watchedFileSizes = new Map();

/**
 * A Set to track files currently being processed. This prevents race conditions
 * where a file is modified again while its previous changes are still being read.
 * @type {Set<string>}
 */
const processingFiles = new Set();

/**
 * Initializes the file watcher using `chokidar`.
 *
 * @param {string[]} paths - An array of file and/or directory paths to watch.
 * @param {Function} onLogLine - The callback function to be invoked for each new log line.
 *   This function will receive the log line as a string.
 * @param {Function} onWatcherError - A callback function to handle errors from the watcher itself.
 * @returns {chokidar.FSWatcher} The initialized watcher instance.
 */
export function initializeWatcher(paths, onLogLine, onWatcherError) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('LogWatcher: At least one path must be provided to watch.');
  }
  if (typeof onLogLine !== 'function') {
    throw new Error('LogWatcher: `onLogLine` must be a function.');
  }
  if (typeof onWatcherError !== 'function') {
    throw new Error('LogWatcher: `onWatcherError` must be a function.');
  }

  console.log(`Initializing watcher for paths: ${paths.join(', ')}`);

  const watcher = chokidar.watch(paths, {
    // `persistent: true` is the default and keeps the process running.
    // `ignoreInitial: false` means we process existing files on startup.
    // `awaitWriteFinish` helps prevent reading partially written files.
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    // This is crucial for log rotation. If a file is removed and a new one
    // with the same name is created, chokidar will continue to watch it.
    followSymlinks: true,
  });

  // Event for new files being added to a watched directory.
  watcher.on('add', async (path) => {
    console.log(`File added: ${path}. Starting to watch for changes.`);
    try {
      const stats = await fs.stat(path);
      // Process the entire file as new content.
      await processFileChange(path, 0, stats.size, onLogLine);
    } catch (error) {
      onWatcherError(new Error(`Error processing newly added file ${path}: ${error.message}`));
    }
  });

  // Event for when a file's content has changed.
  watcher.on('change', async (path, stats) => {
    if (!stats) {
      // It's possible for stats to be undefined in some edge cases.
      // We'll try to get them manually.
      try {
        stats = await fs.stat(path);
      } catch (error) {
        onWatcherError(new Error(`Error getting stats for changed file ${path}: ${error.message}`));
        return;
      }
    }

    const previousSize = watchedFileSizes.get(path) ?? 0;
    const currentSize = stats.size;

    if (currentSize < previousSize) {
      // This indicates log rotation (e.g., file was truncated or replaced).
      console.log(`Log rotation detected for ${path}. Reading from start.`);
      await processFileChange(path, 0, currentSize, onLogLine);
    } else if (currentSize > previousSize) {
      // This is the common case: content was appended.
      await processFileChange(path, previousSize, currentSize, onLogLine);
    }
    // If currentSize === previousSize, do nothing.
  });

  // Event for when a file is removed.
  watcher.on('unlink', (path) => {
    console.log(`File removed: ${path}. Removing from watch state.`);
    watchedFileSizes.delete(path);
    processingFiles.delete(path);
  });

  // Handle watcher-specific errors.
  watcher.on('error', (error) => {
    onWatcherError(new Error(`Watcher error: ${error.message}`));
  });

  return watcher;
}

/**
 * Processes a change in a single file by reading the new content.
 *
 * @param {string} path - The path to the file.
 * @param {number} start - The byte offset to start reading from.
 * @param {number} end - The byte offset to end reading at.
 * @param {Function} onLogLine - The callback for each new line.
 * @returns {Promise<void>}
 * @private
 */
async function processFileChange(path, start, end, onLogLine) {
  if (processingFiles.has(path)) {
    // Already processing this file, skip to avoid race conditions.
    // The next 'change' event will catch any further modifications.
    return;
  }

  processingFiles.add(path);

  try {
    const stream = createReadStream(path, {
      encoding: 'utf8',
      start,
      end: end - 1, // `end` is inclusive, so subtract 1.
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity, // Handles both \n and \r\n line endings.
    });

    // Using `for await...of` is a clean, modern way to handle stream lines.
    for await (const line of rl) {
      if (line.trim() !== '') {
        onLogLine(line);
      }
    }

    // Update the file size map after successfully processing.
    watchedFileSizes.set(path, end);
  } catch (error) {
    // We don't use the onWatcherError callback here because this is a file-specific
    // read error, not a watcher-level problem. We log it and move on.
    console.error(`Error reading file ${path}: ${error.message}`);
    // If we failed to read, we should not update the size, so it will be retried.
  } finally {
    processingFiles.delete(path);
  }
}