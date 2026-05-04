/**
 * @file src/state/state-persister.js
 * @description Handles loading and saving the world state to/from JSON files for persistence.
 * This module provides an abstraction over the file system, allowing the game engine
 * to periodically save snapshots of the world state and to resume from the last
 * saved state upon startup.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { WorldState } from './world-state.js';

const SNAPSHOT_FILENAME = 'world-state.json';

/**
 * Provides methods for persisting and loading the game's world state.
 */
export class StatePersister {
  /**
   * The full path to the directory where snapshots will be stored.
   * @private
   * @type {string}
   */
  #snapshotDir;

  /**
   * The full path to the snapshot file.
   * @private
   * @type {string}
   */
  #snapshotPath;

  /**
   * Creates a new StatePersister instance.
   *
   * @param {object} options - Configuration options.
   * @param {string} options.snapshotDir - The directory path to store state snapshots.
   */
  constructor({ snapshotDir }) {
    if (!snapshotDir || typeof snapshotDir !== 'string') {
      throw new Error('StatePersister requires a valid snapshot directory path.');
    }
    this.#snapshotDir = snapshotDir;
    this.#snapshotPath = path.join(this.#snapshotDir, SNAPSHOT_FILENAME);
  }

  /**
   * Saves the current world state to a JSON file.
   * The process is atomic: it writes to a temporary file first, then renames it
   * to the final snapshot file. This prevents data corruption if the server
   * crashes during the write operation.
   *
   * @param {WorldState} worldState - The WorldState instance to save.
   * @returns {Promise<void>} A promise that resolves when the save is complete.
   */
  async save(worldState) {
    if (!(worldState instanceof WorldState)) {
      throw new TypeError('Invalid argument: worldState must be an instance of WorldState.');
    }

    console.log(`[StatePersister] Saving world state to ${this.#snapshotPath}...`);

    const tempPath = `${this.#snapshotPath}.${Date.now()}.tmp`;

    try {
      // 1. Ensure the snapshot directory exists.
      await fs.mkdir(this.#snapshotDir, { recursive: true });

      // 2. Serialize the world state.
      const serializedState = worldState.serialize();
      const jsonData = JSON.stringify(serializedState, null, 2); // Pretty-print JSON for readability

      // 3. Write to a temporary file.
      await fs.writeFile(tempPath, jsonData, 'utf8');

      // 4. Atomically rename the temporary file to the final snapshot file.
      await fs.rename(tempPath, this.#snapshotPath);

      console.log('[StatePersister] World state saved successfully.');
    } catch (error) {
      console.error('[StatePersister] Error saving world state:', error);
      // Clean up the temporary file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Log cleanup error but don't re-throw, the original error is more important.
        console.error(`[StatePersister] Failed to clean up temporary file ${tempPath}:`, cleanupError);
      }
      // Re-throw the original error to be handled by the caller.
      throw new Error(`Failed to save world state: ${error.message}`);
    }
  }

  /**
   * Loads the world state from a JSON file.
   * If the snapshot file does not exist, it returns null, indicating that
   * a new world should be generated.
   *
   * @param {import('../game/event-bus.js').EventBus} eventBus - The game's event bus, required for deserialization.
   * @param {number} tickRate - The game engine's tick rate, required for deserialization.
   * @returns {Promise<WorldState | null>} A promise that resolves with the loaded WorldState instance, or null if no snapshot exists.
   */
  async load(eventBus, tickRate) {
    console.log(`[StatePersister] Attempting to load world state from ${this.#snapshotPath}...`);

    try {
      // Check if the file exists before trying to read it.
      await fs.access(this.#snapshotPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[StatePersister] No existing world state file found. A new world will be generated.');
        return null;
      }
      // For other errors (e.g., permissions), re-throw.
      console.error(`[StatePersister] Error accessing snapshot file at ${this.#snapshotPath}:`, error);
      throw new Error(`Could not access snapshot file: ${error.message}`);
    }

    try {
      const jsonData = await fs.readFile(this.#snapshotPath, 'utf8');
      const serializedState = JSON.parse(jsonData);

      if (!serializedState || typeof serializedState !== 'object') {
        throw new Error('Snapshot file is empty or malformed.');
      }

      const worldState = WorldState.deserialize(serializedState, eventBus, tickRate);
      console.log('[StatePersister] World state loaded successfully.');
      return worldState;
    } catch (error) {
      console.error('[StatePersister] Error loading or parsing world state:', error);
      // If loading fails, it's safer to start with a fresh world than to risk
      // running with a corrupted state. We'll return null and let the engine handle it.
      // A more robust system might attempt to load from a backup.
      console.warn('[StatePersister] Proceeding with a new world due to load failure.');
      return null;
    }
  }
}