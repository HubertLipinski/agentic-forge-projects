/**
 * @fileoverview Programmatic API for Config Snapshot Tester.
 *
 * This module exports the core functionality of the library for direct use in
 * other Node.js scripts, such as test runners (e.g., Vitest, Jest) or custom
 * CI/CD automation. It provides a clean, high-level interface for generating,
 * updating, and testing configuration snapshots.
 *
 * @example
 * // In a Vitest test file:
 * import { test, expect } from 'vitest';
 * import { testSnapshot } from 'config-snapshot-tester';
 *
 * test('production config structure should not change', async () => {
 *   const result = await testSnapshot('./config/production.json');
 *   expect(result.areEqual).toBe(true);
 * });
 */

import { parseFile } from './parsers/index.js';
import { mapObjectToTypes } from './utils/type-mapper.js';
import { compareObjects } from './differ.js';
import {
  getSnapshotPath,
  loadSnapshot,
  generateSnapshot as createSnapshotObject,
  saveSnapshot,
} from './snapshot-manager.js';

/**
 * @typedef {object} TestResult
 * @property {boolean} areEqual - True if the current config matches the snapshot, false otherwise.
 * @property {string} configFilePath - The absolute path to the configuration file that was tested.
 * @property {string} snapshotPath - The absolute path to the snapshot file used for comparison.
 * @property {boolean} snapshotExists - True if a snapshot existed for comparison.
 * @property {import('./differ.js').DiffEntry[]} diffs - An array of differences found. Empty if `areEqual` is true.
 */

/**
 * @typedef {object} GenerateResult
 * @property {string} snapshotPath - The absolute path where the new snapshot was saved.
 * @property {boolean} isNew - True if a new snapshot was created, false if an existing one was updated.
 */

/**
 * @typedef {object} SnapshotOptions
 * @property {string[]} [ignore=[]] - An array of dot-notation paths to ignore during comparison (e.g., ['server.host', 'db.password']).
 */

/**
 * Validates the common inputs for the API functions.
 * @param {string} filePath - The path to the configuration file.
 * @param {SnapshotOptions} [options] - The options object.
 * @throws {Error} if inputs are invalid.
 */
function validateInputs(filePath, options) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('A valid file path (string) is required.');
  }
  if (options) {
    if (typeof options !== 'object' || options === null) {
      throw new Error('Options, if provided, must be an object.');
    }
    if (options.ignore && !Array.isArray(options.ignore)) {
      throw new Error('The `ignore` option, if provided, must be an array of strings.');
    }
  }
}

/**
 * Generates and saves a new snapshot for a given configuration file, or updates an existing one.
 *
 * This function reads a configuration file, creates a type-based snapshot of its structure,
 * and writes it to the conventional snapshot location (`__snapshots__/`). It will overwrite
 * any existing snapshot for that file.
 *
 * @param {string} configFilePath - The path to the configuration file (e.g., 'config/production.json').
 * @returns {Promise<GenerateResult>} A promise that resolves with an object containing the path to the
 *   generated snapshot and a flag indicating if it was a new creation.
 * @throws {Error} If the file cannot be read, parsed, or if the snapshot cannot be written.
 */
export async function generateSnapshot(configFilePath) {
  validateInputs(configFilePath);

  try {
    const configObject = await parseFile(configFilePath);
    const snapshotPath = getSnapshotPath(configFilePath);

    const existingSnapshot = await loadSnapshot(snapshotPath);
    const isNew = existingSnapshot === null;

    const newSnapshotObject = createSnapshotObject(configObject, configFilePath);
    await saveSnapshot(snapshotPath, newSnapshotObject);

    return {
      snapshotPath,
      isNew,
    };
  } catch (error) {
    // Augment error with context for better debugging in consuming applications.
    throw new Error(`Failed to generate snapshot for "${configFilePath}": ${error.message}`);
  }
}

/**
 * Tests a configuration file against its corresponding snapshot.
 *
 * This function reads a configuration file and its stored snapshot, then compares their
 * structural and type signatures. It returns a detailed result object indicating whether
 * they match and what the differences are.
 *
 * @param {string} configFilePath - The path to the configuration file to test.
 * @param {SnapshotOptions} [options={}] - Options for the test, such as keys to ignore.
 * @returns {Promise<TestResult>} A promise that resolves with the detailed comparison result.
 * @throws {Error} If the config file cannot be read/parsed, or if the snapshot is malformed.
 */
export async function testSnapshot(configFilePath, options = {}) {
  validateInputs(configFilePath, options);

  try {
    const snapshotPath = getSnapshotPath(configFilePath);
    const snapshotObject = await loadSnapshot(snapshotPath);

    if (!snapshotObject) {
      return {
        areEqual: false,
        configFilePath,
        snapshotPath,
        snapshotExists: false,
        diffs: [], // No diffs because there's nothing to compare against.
      };
    }

    const currentConfigObject = await parseFile(configFilePath);
    const currentTypeMap = mapObjectToTypes(currentConfigObject);
    const snapshotTypeMap = snapshotObject.typeMap;

    const { areEqual, diffs } = compareObjects(snapshotTypeMap, currentTypeMap, {
      ignore: options.ignore || [],
    });

    return {
      areEqual,
      configFilePath,
      snapshotPath,
      snapshotExists: true,
      diffs,
    };
  } catch (error) {
    // Provide clear context for failures during the test run.
    throw new Error(`Failed to test snapshot for "${configFilePath}": ${error.message}`);
  }
}