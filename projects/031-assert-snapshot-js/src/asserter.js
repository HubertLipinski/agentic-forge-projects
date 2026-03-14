/**
 * @fileoverview This module contains the core snapshot assertion logic. It
 * orchestrates the process of reading existing snapshots, comparing them with
 * new values, and creating or updating snapshot files as needed. It serves as
 * the primary user-facing API for the snapshot testing utility.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import path from 'node:path';
import { fileExists, readSnapshotFile, writeSnapshotFile } from './utils/fs.js';
import { formatSnapshot } from './utils/formatter.js';
import { generateDiff } from './utils/diff.js';
import { isUpdateMode } from './utils/cli-parser.js';
import { getConfig } from './config.js';

/**
 * Validates the test name provided by the user.
 * A valid name is a non-empty string that does not contain characters that
 * would be problematic in a file path.
 *
 * @param {string} testName - The name of the test, used to generate the snapshot filename.
 * @throws {Error} If the test name is invalid.
 */
function validateTestName(testName) {
  if (typeof testName !== 'string' || testName.trim() === '') {
    throw new Error('assertSnapshot requires a non-empty string for the test name.');
  }
  // Disallow path traversal characters and other invalid filename characters.
  // This is a security and stability measure.
  const invalidChars = /[<>:"/\\|?*]/g;
  if (invalidChars.test(testName)) {
    throw new Error(`Invalid characters found in test name: "${testName}". Please use a valid filename-safe string.`);
  }
}

/**
 * Constructs the full, absolute path for a snapshot file based on the test name
 * and the current configuration.
 *
 * @param {string} testName - The sanitized name of the test.
 * @returns {string} The absolute path to the snapshot file.
 */
function getSnapshotPath(testName) {
  const { snapshotDir, snapshotFileExtension } = getConfig();
  const filename = `${testName}${snapshotFileExtension}`;
  // Using `path.resolve` ensures an absolute path, which is more robust
  // for file system operations.
  return path.resolve(process.cwd(), snapshotDir, filename);
}

/**
 * The core snapshot assertion function.
 *
 * It compares a given JavaScript value against a stored snapshot.
 * - If the snapshot file does not exist, it creates one with the current value.
 * - If the snapshot exists, it compares the current value with the snapshot's content.
 * - If they match, the assertion passes silently.
 * - If they differ, it throws an `AssertionError` with a colorized diff.
 * - If the `--update-snapshots` or `-u` flag is used, it overwrites the existing
 *   snapshot with the new value if they differ.
 *
 * @async
 * @param {*} receivedValue - The value from the current test run to be snapshot-tested.
 * @param {string} testName - A unique name for the test, used to identify the snapshot file.
 * @throws {Error} Throws an `AssertionError` if the snapshot does not match the received value.
 *                 Also throws standard errors for I/O issues or invalid arguments.
 */
export async function assertSnapshot(receivedValue, testName) {
  validateTestName(testName);

  const snapshotPath = getSnapshotPath(testName);
  const updateSnapshots = isUpdateMode();
  const snapshotExists = await fileExists(snapshotPath);

  // Case 1: Snapshot file does not exist.
  if (!snapshotExists) {
    const newSnapshotContent = formatSnapshot(receivedValue);
    await writeSnapshotFile(snapshotPath, newSnapshotContent);
    // In a typical test runner context, we might want to signal that a new
    // snapshot was created. For this simple asserter, we'll just log it.
    console.log(`📸 New snapshot created for "${testName}" at ${path.relative(process.cwd(), snapshotPath)}`);
    return; // Assertion passes by creating the snapshot.
  }

  // Case 2: Snapshot file exists. Read and compare.
  const snapshotContent = await readSnapshotFile(snapshotPath);
  const expectedValue = JSON.parse(snapshotContent); // Assuming snapshots are valid JSON.

  // Using structuredClone for a deep, safe comparison.
  // This prevents accidental mutation and handles complex types.
  const deepEquals = JSON.stringify(formatSnapshot(receivedValue)) === JSON.stringify(formatSnapshot(expectedValue));

  if (deepEquals) {
    // Assertion passes, do nothing.
    return;
  }

  // Case 3: Mismatch found, and update mode is enabled.
  if (updateSnapshots) {
    const updatedSnapshotContent = formatSnapshot(receivedValue);
    await writeSnapshotFile(snapshotPath, updatedSnapshotContent);
    console.log(`🔄 Snapshot updated for "${testName}" at ${path.relative(process.cwd(), snapshotPath)}`);
    return; // Assertion passes by updating the snapshot.
  }

  // Case 4: Mismatch found, and update mode is disabled. Throw an error.
  const diff = generateDiff(receivedValue, expectedValue);
  const errorMessage = `Snapshot mismatch for test: "${testName}"\n\n${diff}\n\n` +
    `Run with the '--update-snapshots' or '-u' flag to update the snapshot.`;

  // Create an error object that behaves like a standard assertion error.
  const error = new Error(errorMessage);
  error.name = 'AssertionError';
  error.code = 'ERR_ASSERTION';
  error.actual = receivedValue;
  error.expected = expectedValue;

  throw error;
}