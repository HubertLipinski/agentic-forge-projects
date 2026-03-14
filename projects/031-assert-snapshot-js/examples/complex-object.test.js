/**
 * @fileoverview This example demonstrates using `assertSnapshot` with a complex,
 * nested JavaScript object that includes various data types. It's designed to be
 * run with Node.js's built-in test runner (`node --test`).
 *
 * This test showcases the library's ability to handle:
 * - Nested objects and arrays.
 * - Special types like `Date`, `RegExp`, `Set`, `Map`, `BigInt`, and `undefined`.
 * - Stable serialization, ensuring property order changes don't cause failures.
 *
 * To run this example:
 * 1. From the project root, run: `node --test examples/complex-object.test.js`
 *    This will create a new snapshot in `__snapshots__/complex-api-response.snap`.
 *
 * 2. Modify the `apiResponse` object below.
 *    Run the test again. It will fail, showing a colorized diff of the changes.
 *
 * 3. To accept the changes, run: `node --test -u examples/complex-object.test.js`
 *    The `-u` flag will update the snapshot file to match the new object.
 */

import { test, describe } from 'node:test';
import assertSnapshot from '../src/index.js';

describe('assertSnapshot with Complex Objects', () => {
  test('should correctly snapshot a complex, nested API response', async () => {
    // This object simulates a complex API response with various data types
    // and nested structures. Our snapshot utility should handle all of these
    // gracefully, creating a stable and readable snapshot file.
    const apiResponse = {
      status: 'success',
      timestamp: new Date('2024-01-01T12:30:00.000Z'),
      transactionId: 'txn_123abc456def',
      data: {
        user: {
          id: 9876543210987654321n, // BigInt for a large user ID
          profile: {
            name: 'Alice',
            // Note the property order is different from what might be sorted
            // The formatter will sort keys alphabetically for a stable snapshot.
            bio: 'A software engineer & avid reader.',
            avatarUrl: 'https://example.com/avatars/alice.png',
            lastLogin: undefined, // Should be preserved as 'undefined'
          },
          roles: new Set(['contributor', 'beta-tester']), // Set for unique roles
          preferences: {
            theme: 'dark',
            notifications: {
              email: true,
              push: false,
            },
          },
        },
        posts: [
          {
            id: 'post_001',
            title: 'Exploring Modern JavaScript',
            tags: ['js', 'es2023', 'node'],
            // Map to store metadata with varying key types
            metadata: new Map([
              ['views', 1024],
              ['published', true],
              ['validation', /^[a-z0-9-]+$/], // RegExp object
            ]),
          },
          {
            id: 'post_002',
            title: 'A Guide to Snapshot Testing',
            tags: ['testing', 'jest', 'snapshot'],
            metadata: new Map([
              ['views', 256],
              ['published', false],
              ['validation', /^[a-z0-9-]+$/],
            ]),
          },
        ],
        // An empty array should be snapshotted correctly.
        drafts: [],
      },
      // A circular reference to test our formatter's safety.
      // This will be replaced with '[Circular]' in the snapshot.
      get self() {
        return this;
      },
    };

    try {
      // The test name 'complex-api-response' will generate the corresponding
      // snapshot file: `complex-api-response.snap`.
      await assertSnapshot(apiResponse, 'complex-api-response');
    } catch (error) {
      // Re-throw the error to make the test fail and display the diff.
      // In a real test suite, this try/catch is often unnecessary as the
      // test runner will handle the uncaught assertion error.
      throw error;
    }
  });
});