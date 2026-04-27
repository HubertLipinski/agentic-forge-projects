/**
 * @file src/core/watcher.js
 * @description Implements the file watching logic using `chokidar` to trigger
 * regeneration on file add/change/unlink events. This module provides a robust
 * way to keep the generated crontab synchronized with the source files in real-time.
 */

import chokidar from 'chokidar';
import { performance } from 'node:perf_hooks';

/**
 * A custom error class for watcher-related failures.
 */
class WatcherError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Additional options.
   * @param {Error} [options.cause] The original error that was caught.
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'WatcherError';
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Implements a debounced function.
 * The function will only be executed after it has not been called for `delay` milliseconds.
 *
 * @private
 * @param {Function} func The function to debounce.
 * @param {number} delay The debounce delay in milliseconds.
 * @returns {(...args: any[]) => void} The debounced function.
 */
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Creates and manages a file watcher that triggers a regeneration callback on file system events.
 * It debounces the regeneration callback to handle bursts of file changes efficiently.
 *
 * @param {object} options - The configuration for the watcher.
 * @param {string[]} options.patterns - An array of glob patterns to watch.
 * @param {string[]} [options.ignore=[]] - An array of glob patterns to ignore.
 * @param {Function} options.onRegenerate - The asynchronous callback function to execute when a file change is detected. This function should perform the crontab regeneration.
 * @param {Function} [options.onError] - An optional callback for handling errors that occur during watching.
 * @param {number} [options.debounceMs=500] - The time in milliseconds to wait for more file changes before triggering regeneration.
 * @returns {Promise<{close: () => Promise<void>}>} A promise that resolves with an object containing a `close` method to stop the watcher.
 * @throws {WatcherError} if the configuration is invalid.
 */
export async function startWatcher(options) {
  const {
    patterns,
    ignore = [],
    onRegenerate,
    onError = (err) => console.error(err),
    debounceMs = 500,
  } = options ?? {};

  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    throw new WatcherError('Watcher requires at least one glob pattern.');
  }
  if (typeof onRegenerate !== 'function') {
    throw new WatcherError('The `onRegenerate` callback must be a function.');
  }

  const watcher = chokidar.watch(patterns, {
    ignored: ignore,
    persistent: true,
    ignoreInitial: true, // Don't fire 'add' events on initial scan
    atomic: true, // Use atomic writes to avoid issues with editors
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  const debouncedRegenerate = debounce(async (event, path) => {
    console.log(`\n[${new Date().toLocaleTimeString()}] File ${event}: ${path}`);
    console.log('Change detected. Regenerating crontab...');
    const startTime = performance.now();
    try {
      await onRegenerate();
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      console.log(`Crontab regenerated successfully in ${duration}ms. Watching for next change...`);
    } catch (error) {
      // The orchestrator's run function should handle logging its own errors.
      // We log a generic failure message here.
      console.error('Crontab regeneration failed. See error details above.');
      // Pass the error to the optional error handler
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  }, debounceMs);

  return new Promise((resolve, reject) => {
    watcher
      .on('add', (path) => debouncedRegenerate('added', path))
      .on('change', (path) => debouncedRegenerate('changed', path))
      .on('unlink', (path) => debouncedRegenerate('removed', path))
      .on('error', (error) => {
        const watcherError = new WatcherError('An error occurred in the file watcher.', { cause: error });
        if (typeof onError === 'function') {
          onError(watcherError);
        } else {
          console.error(watcherError.message, watcherError.cause);
        }
        // Reject the promise if the error occurs during initialization
        reject(watcherError);
      })
      .on('ready', () => {
        console.log('Initial file scan complete. Watcher is now active.');
        // Resolve the promise with the close function once the watcher is ready.
        resolve({
          close: async () => {
            console.log('Stopping file watcher...');
            await watcher.close();
            console.log('Watcher stopped.');
          },
        });
      });
  });
}