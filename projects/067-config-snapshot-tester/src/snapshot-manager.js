/**
 * @fileoverview Manages the lifecycle of configuration snapshots.
 *
 * This module provides a high-level abstraction for creating, loading, and saving
 * configuration snapshots. It orchestrates file I/O, type mapping, and stable
 * serialization to ensure that snapshots are consistent, readable, and reliable.
 * It is a central component used by both the CLI and the programmatic API.
 */

import path from 'node:path';
import stringify from 'fast-json-stable-stringify';
import { readFileContent, writeFileContent, pathExists } from '../utils/file-utils.js';
import { mapObjectToTypes } from '../utils/type-mapper.js';

const SNAPSHOT_EXTENSION = '.snap';
const SNAPSHOT_DIR = '__snapshots__';

/**
 * Generates the conventional path for a snapshot file based on the original config file's path.
 * The snapshot will be placed in a `__snapshots__` directory adjacent to the config file.
 *
 * Example:
 *   - Input: `/path/to/project/config.json`
 *   - Output: `/path/to/project/__snapshots__/config.json.snap`
 *
 * @param {string} configFilePath - The absolute or relative path to the configuration file.
 * @returns {string} The calculated path for the corresponding snapshot file.
 * @throws {Error} If the configFilePath is invalid.
 */
export function getSnapshotPath(configFilePath) {
  if (!configFilePath || typeof configFilePath !== 'string') {
    throw new Error('Invalid config file path provided. Expected a non-empty string.');
  }

  const resolvedPath = path.resolve(configFilePath);
  const dirName = path.dirname(resolvedPath);
  const baseName = path.basename(resolvedPath);

  return path.join(dirName, SNAPSHOT_DIR, `${baseName}${SNAPSHOT_EXTENSION}`);
}

/**
 * Generates a type-based snapshot object from a raw configuration object.
 *
 * This function takes a parsed configuration object, maps it to its type structure,
 * and then wraps it in a standard snapshot format that includes metadata.
 *
 * @param {object} configObject - The raw JavaScript object parsed from a config file.
 * @param {string} configFilePath - The path to the original config file, stored as metadata.
 * @returns {{metadata: {version: string, generatedAt: string, sourceFile: string}, typeMap: object}} The structured snapshot object.
 * @throws {Error} If the input is not a valid object.
 */
export function generateSnapshot(configObject, configFilePath) {
  if (!configObject || typeof configObject !== 'object' || Array.isArray(configObject)) {
    throw new Error('Cannot generate snapshot from non-object data.');
  }
  if (!configFilePath || typeof configFilePath !== 'string') {
    throw new Error('A valid source file path is required to generate a snapshot.');
  }

  const typeMap = mapObjectToTypes(configObject);

  const snapshot = {
    metadata: {
      version: '1.0.0', // Version of the snapshot format itself
      generatedAt: new Date().toISOString(),
      sourceFile: path.basename(configFilePath),
    },
    typeMap: typeMap,
  };

  return snapshot;
}

/**
 * Asynchronously loads and parses a snapshot file from disk.
 *
 * @param {string} snapshotPath - The path to the snapshot file.
 * @returns {Promise<object | null>} A promise that resolves with the parsed snapshot
 *   object, or `null` if the snapshot file does not exist.
 * @throws {Error} If the file exists but cannot be read or is not valid JSON.
 */
export async function loadSnapshot(snapshotPath) {
  if (!(await pathExists(snapshotPath))) {
    return null;
  }

  try {
    const content = await readFileContent(snapshotPath);
    const snapshot = JSON.parse(content);

    // Basic validation to ensure it looks like one of our snapshots
    if (!snapshot.metadata || !snapshot.typeMap || typeof snapshot.typeMap !== 'object') {
      throw new Error('The file does not appear to be a valid config snapshot. Missing `metadata` or `typeMap`.');
    }

    return snapshot;
  } catch (error) {
    // Augment JSON parsing errors or file read errors with more context.
    throw new Error(`Failed to load snapshot from "${snapshotPath}". Reason: ${error.message}`);
  }
}

/**
 * Asynchronously saves a snapshot object to disk.
 *
 * The object is serialized to a stable JSON string to prevent meaningless diffs
 * due to key order changes. The output is pretty-printed for human readability.
 *
 * @param {string} snapshotPath - The file path where the snapshot should be saved.
 * @param {object} snapshotObject - The snapshot object to save.
 * @returns {Promise<void>} A promise that resolves when the file has been written.
 * @throws {Error} If the file cannot be written.
 */
export async function saveSnapshot(snapshotPath, snapshotObject) {
  if (!snapshotObject || typeof snapshotObject !== 'object') {
    throw new Error('Cannot save invalid snapshot data. Expected an object.');
  }

  // Use a stable stringify to ensure key order is consistent across saves.
  // The `space: 2` argument ensures the output is pretty-printed and human-readable.
  const stableJsonString = stringify(snapshotObject, { space: 2 });

  // The writeFileContent utility handles directory creation and write permissions.
  await writeFileContent(snapshotPath, stableJsonString);
}