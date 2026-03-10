/**
 * @file src/state/storage.js
 * @description Manages persistent state for the cron scheduler.
 *
 * This module is responsible for all file I/O related to the scheduler's state.
 * It ensures that access to the state file is atomic and safe for concurrent
 * processes by using file-level locking. It handles reading the state from a JSON
 * file, writing updates back to it, and gracefully creating the file if it
 * doesn't exist.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { lock, unlock } from 'proper-lockfile';

/**
 * A custom error class for storage-related issues.
 * This helps in distinguishing storage errors from other application errors.
 */
export class StorageError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Error} [cause] - The original error that caused this one.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

/**
 * Reads the scheduler's state from the specified JSON file.
 *
 * This function acquires a lock on the state file, reads its content, and then
 * releases the lock. If the file does not exist, it returns a default empty state.
 * If the file is empty or contains invalid JSON, it also returns a default state
 * and logs a warning.
 *
 * @param {string} storagePath - The absolute path to the state file.
 * @returns {Promise<object>} A promise that resolves to the parsed state object.
 *   The state object is expected to have a `jobs` property, which is a map of
 *   job IDs to job data.
 * @throws {StorageError} If there's an unrecoverable error reading the file (e.g., permissions).
 */
export async function readState(storagePath) {
  try {
    await lock(storagePath, { retries: 5, stale: 5000 });

    let fileContent;
    try {
      fileContent = await fs.readFile(storagePath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, which is a valid initial state.
        return { jobs: {} };
      }
      // Other read errors (e.g., permissions) are critical.
      throw new StorageError(`Failed to read state file at ${storagePath}`, error);
    }

    if (fileContent.trim() === '') {
      // File is empty, treat as a valid initial state.
      return { jobs: {} };
    }

    try {
      const state = JSON.parse(fileContent);
      // Ensure the state has the expected top-level structure.
      return state && typeof state.jobs === 'object' ? state : { jobs: {} };
    } catch (error) {
      // JSON parsing error indicates a corrupted file.
      console.warn(`[Scheduler] Warning: State file at ${storagePath} is corrupted or malformed. Starting with a fresh state.`);
      return { jobs: {} };
    }
  } catch (error) {
    // Re-throw our custom error, or wrap a new one.
    if (error instanceof StorageError) throw error;
    throw new StorageError(`Could not acquire lock or read state from ${storagePath}`, error);
  } finally {
    // Ensure the lock is always released, even if errors occur.
    try {
      await unlock(storagePath);
    } catch (unlockError) {
      // This is a serious issue, as it might leave the file locked.
      console.error(`[Scheduler] CRITICAL: Failed to release lock on ${storagePath}. Manual intervention may be required.`, unlockError);
    }
  }
}

/**
 * Writes the provided state object to the specified JSON file.
 *
 * This function acquires a lock, ensures the directory exists, stringifies the
 * state object, and writes it to the file atomically. The lock is released
 * after the write operation is complete.
 *
 * @param {string} storagePath - The absolute path to the state file.
 * @param {object} state - The state object to persist. It should be serializable to JSON.
 * @returns {Promise<void>} A promise that resolves when the write is complete.
 * @throws {StorageError} If the state cannot be serialized or the file cannot be written.
 */
export async function writeState(storagePath, state) {
  let serializedState;
  try {
    // Use a replacer to handle Map objects if they are used in the state.
    // In our case, `state.jobs` is a plain object, but this is good practice.
    serializedState = JSON.stringify(state, null, 2);
  } catch (error) {
    throw new StorageError('Failed to serialize scheduler state to JSON', error);
  }

  try {
    await lock(storagePath, { retries: 5, stale: 5000 });

    // Ensure the directory for the storage file exists.
    const dir = path.dirname(storagePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(storagePath, serializedState, 'utf-8');
  } catch (error) {
    throw new StorageError(`Could not acquire lock or write state to ${storagePath}`, error);
  } finally {
    // Ensure the lock is always released.
    try {
      await unlock(storagePath);
    } catch (unlockError) {
      console.error(`[Scheduler] CRITICAL: Failed to release lock on ${storagePath} after writing.`, unlockError);
    }
  }
}