/**
 * @fileoverview This example demonstrates the basic usage of `assertSnapshot`
 * with a simple JavaScript object. It's designed to be run with Node.js's
 * built-in test runner (`node --test`).
 *
 * To run this example:
 * 1. From the project root, run: `node --test examples/basic-usage.test.js`
 *    This will create a new snapshot in `__snapshots__/simple-user-object.snap`.
 *
 * 2. Run the command again: `node --test examples/basic-usage.test.js`
 *    The test will pass because the object matches the created snapshot.
 *
 * 3. Modify the `user` object below (e.g., change the name or add a property).
 *    Run the test again. It will fail with a diff showing the changes.
 *
 * 4. To accept the changes, run: `node --test -u examples/basic-usage.test.js`
 *    The `-u` flag (or `--update-snapshots`) will update the snapshot file with
 *    the new object structure, and the test will pass.
 */

import { test, describe } from 'node:test';
import assertSnapshot from '../src/index.js';

describe('assertSnapshot Basic Usage', () => {
  test('should match the stored snapshot for a simple user object', async () => {
    // This is the object we want to test.
    // On the first run, its structure will be saved to a snapshot file.
    // On subsequent runs, it will be compared against that saved snapshot.
    const user = {
      id: 1,
      username: 'johndoe',
      email: 'john.doe@example.com',
      registeredAt: new Date('2023-10-27T10:00:00.000Z'),
      isActive: true,
    };

    try {
      // Call `assertSnapshot` with the value and a unique name for the test.
      // The name 'simple-user-object' will be used to create the filename
      // `simple-user-object.snap` inside the `__snapshots__` directory.
      await assertSnapshot(user, 'simple-user-object');
    } catch (error) {
      // In a real test suite, you would let the test runner handle the error.
      // Here, we re-throw to ensure the test fails as expected and the error
      // message (the diff) is displayed in the console.
      throw error;
    }
  });

  test('should correctly snapshot an array of primitives', async () => {
    const userRoles = ['admin', 'editor', 'viewer'];

    // The snapshot will store a formatted JSON array.
    await assertSnapshot(userRoles, 'user-roles-array');
  });

  test('should handle null and undefined values correctly', async () => {
    const dataWithNulls = {
      id: 101,
      name: 'Test Data',
      description: null, // null values are preserved
      endDate: undefined, // undefined values are also preserved
      tags: ['tag1', undefined, 'tag3'],
    };

    await assertSnapshot(dataWithNulls, 'data-with-nulls-and-undefined');
  });
});