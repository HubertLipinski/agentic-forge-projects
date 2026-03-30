/**
 * @file src/state/manager.js
 * @description Manages a local state file to track applied migrations and prevent drift.
 *
 * This module provides functions to read from and write to a state file (e.g.,
 * `.schema-sync.state.json`). The state file's primary purpose is to store a
 * hash of the last successfully applied schema. This allows the tool to quickly
 * determine if the desired schema configuration has changed since the last run,
 * avoiding unnecessary database introspection if nothing has changed.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

/**
 * Represents the structure of the state file.
 * @typedef {object} SchemaState
 * @property {string | null} schemaHash - A SHA-256 hash of the last successfully applied schema definition.
 * @property {string} lastApplied - An ISO 8601 timestamp of when the last migration was applied.
 * @property {string} version - The version of the schema-diff-sync tool that wrote the state.
 */

const STATE_FILE_VERSION = '1.0.0';

/**
 * Custom error class for state management issues.
 */
class StateManagerError extends Error {
  /**
   * @param {string} message The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'StateManagerError';
  }
}

/**
 * Generates a stable SHA-256 hash for a given schema object.
 * The schema object is canonicalized by sorting keys to ensure that semantically
 * identical schemas produce the same hash, regardless of key order in the source file.
 *
 * @param {object} schema - The normalized schema object.
 * @returns {string} The SHA-256 hash as a hex string.
 */
export function generateSchemaHash(schema) {
  if (!schema || typeof schema !== 'object') {
    throw new StateManagerError('A valid schema object is required to generate a hash.');
  }

  // Canonicalize the object by sorting keys at all levels.
  const canonicalString = JSON.stringify(schema, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted, innerKey) => {
          sorted[innerKey] = value[innerKey];
          return sorted;
        }, {});
    }
    return value;
  });

  return createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Loads and parses the state file from a given path.
 * If the file does not exist, it returns a default, "empty" state object.
 *
 * @param {string} stateFilePath - The absolute path to the state file.
 * @returns {Promise<SchemaState>} A promise that resolves to the parsed state object.
 * @throws {StateManagerError} If the file exists but cannot be read or is malformed.
 */
export async function loadState(stateFilePath) {
  try {
    const rawContent = await readFile(stateFilePath, 'utf8');
    const state = JSON.parse(rawContent);

    // Basic validation of the loaded state
    if (typeof state !== 'object' || state === null || !state.schemaHash) {
      throw new StateManagerError(`State file at '${stateFilePath}' is corrupted or has an invalid format.`);
    }

    return {
      schemaHash: state.schemaHash ?? null,
      lastApplied: state.lastApplied ?? new Date(0).toISOString(),
      version: state.version ?? '0.0.0',
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File not found is a normal condition for the first run.
      // Return a default initial state.
      return {
        schemaHash: null,
        lastApplied: new Date(0).toISOString(),
        version: STATE_FILE_VERSION,
      };
    }
    if (error instanceof SyntaxError) {
      throw new StateManagerError(`Failed to parse state file at '${stateFilePath}'. It may be invalid JSON.`, { cause: error });
    }
    // Re-throw other unexpected errors, wrapping them for context.
    throw new StateManagerError(`Failed to load state from '${stateFilePath}': ${error.message}`, { cause: error });
  }
}

/**
 * Saves a new state object to the specified file path.
 * The state is JSON-stringified with formatting for human readability.
 * This function will create the file if it doesn't exist.
 *
 * @param {string} stateFilePath - The absolute path to the state file.
 * @param {object} newState - The state object to save, typically containing the new schema hash.
 * @returns {Promise<void>} A promise that resolves when the file has been written.
 * @throws {StateManagerError} If the file cannot be written.
 */
export async function saveState(stateFilePath, { schemaHash }) {
  if (typeof schemaHash !== 'string' || schemaHash.length !== 64) {
    throw new StateManagerError('Invalid schema hash provided for saving state.');
  }

  const stateToSave = {
    schemaHash,
    lastApplied: new Date().toISOString(),
    version: STATE_FILE_VERSION,
  };

  try {
    // Stringify with indentation for readability
    const fileContent = JSON.stringify(stateToSave, null, 2);
    await writeFile(stateFilePath, fileContent, 'utf8');
  } catch (error) {
    // Provide a more helpful error message for common issues like permissions.
    const dir = path.dirname(stateFilePath);
    throw new StateManagerError(`Failed to save state to '${stateFilePath}'. Please check file and directory permissions for '${dir}'.`, { cause: error });
  }
}