/**
 * @fileoverview The main entry point for the Assert Snapshot JS library.
 * This file exports the primary `assertSnapshot` function and provides
 * a mechanism for configuring the library's behavior. It acts as the public
 * API surface for consumers of the package.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

import { assertSnapshot as coreAssertSnapshot } from './asserter.js';
import { setConfig, getConfig, resetConfig } from './config.js';

/**
 * The primary snapshot assertion function.
 *
 * This function is the main export of the library. It's a wrapper around the
 * core assertion logic, providing a stable public interface. It compares a
 * given value against a stored snapshot, creating, updating, or failing based
 * on the comparison result and CLI flags.
 *
 * @async
 * @function assertSnapshot
 * @param {*} receivedValue - The value from the current test run to be snapshot-tested.
 * @param {string} testName - A unique name for the test, used to identify the snapshot file.
 * @throws {Error} Throws an `AssertionError` if the snapshot does not match the received value
 *                 (and update mode is not active). Also throws for I/O issues or invalid arguments.
 * @example
 * import { assertSnapshot } from 'assert-snapshot-js';
 *
 * test('should match the stored snapshot for a simple object', async () => {
 *   const user = { id: 1, name: 'John Doe', createdAt: new Date('2023-01-01T00:00:00.000Z') };
 *   await assertSnapshot(user, 'simple-user-object');
 * });
 */
export const assertSnapshot = coreAssertSnapshot;

/**
 * An object containing the configuration functions for the library.
 * This allows users to customize behavior such as the snapshot directory
 * and file extensions.
 *
 * @property {Function} set - A function to merge user-provided configuration with the defaults.
 * @property {Function} get - A function to retrieve the current configuration object.
 * @property {Function} reset - A function to reset the configuration back to its default state.
 * @example
 * import { configure } from 'assert-snapshot-js';
 *
 * // Set a custom snapshot directory before running tests
 * configure.set({
 *   snapshotDir: 'test/snapshots'
 * });
 *
 * // Get the current configuration
 * const currentConfig = configure.get();
 * console.log(currentConfig.snapshotDir); // 'test/snapshots'
 *
 * // Reset to defaults
 * configure.reset();
 */
export const configure = {
  set: setConfig,
  get: getConfig,
  reset: resetConfig,
};

/**
 * Default export providing the main assertion function.
 * This allows for a more concise import syntax for the most common use case.
 *
 * @example
 * import assertSnapshot from 'assert-snapshot-js';
 *
 * await assertSnapshot({ data: 'value' }, 'default-export-test');
 */
export default assertSnapshot;