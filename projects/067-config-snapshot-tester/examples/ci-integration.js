/**
 * @fileoverview Example of CI Integration with a Test Runner (Vitest/Jest).
 *
 * This file demonstrates how to use the programmatic API of `config-snapshot-tester`
 * within a standard testing framework. This approach is ideal for integrating
 * configuration snapshot testing into your CI/CD pipeline.
 *
 * When a pull request changes a configuration file, this test will fail if the
 * structure or types of the configuration have been altered unexpectedly,
 * preventing breaking changes from being merged.
 *
 * HOW TO RUN THIS EXAMPLE:
 * 1. Ensure you have a test runner like Vitest or Jest installed.
 *    (e.g., `npm install -D vitest`)
 * 2. Create the example config files:
 *    - `examples/configs/production.json`
 *    - `examples/configs/staging.env`
 *    - `examples/configs/local.yml`
 * 3. Generate initial snapshots for these files:
 *    - `npx config-snap generate examples/configs/production.json`
 *    - `npx config-snap generate examples/configs/staging.env`
 *    - `npx config-snap generate examples/configs/local.yml`
 * 4. Run your test runner:
 *    - `npx vitest examples/ci-integration.js`
 *
 * To see a test fail, try modifying one of the config files (e.g., add a key,
 * remove a key, or change a value's type) and re-run the tests.
 */

// In a real project, you would use your test runner's globals.
// For this example, we'll mock them to make the file runnable standalone for demonstration.
const describe = global.describe || ((name, fn) => fn());
const test = global.test || ((name, fn) => fn());
const expect = global.expect || ((v) => ({
    toBe: (expected) => {
        if (v !== expected) throw new Error(`Assertion failed: expected ${v} to be ${expected}`);
    },
    toEqual: (expected) => {
        // A simple deep equal for demonstration purposes.
        if (JSON.stringify(v) !== JSON.stringify(expected)) {
            throw new Error(`Assertion failed: objects are not equal.`);
        }
    },
    toHaveLength: (len) => {
        if (v.length !== len) {
            throw new Error(`Assertion failed: expected length ${len}, got ${v.length}`);
        }
    }
}));

// Import the programmatic API from the main entry point.
// In your own project, you'd import from 'config-snapshot-tester'.
import { testSnapshot } from '../src/api.js';

describe('Configuration Snapshot Tests', () => {

    test('production.json config structure should match its snapshot', async () => {
        const configPath = 'examples/configs/production.json';

        try {
            const result = await testSnapshot(configPath);

            // The most crucial assertion: the configuration must match the snapshot.
            expect(result.areEqual).toBe(true);

            // Additional assertions can be made for clarity in test output.
            expect(result.snapshotExists).toBe(true);
            expect(result.diffs).toHaveLength(0);

        } catch (error) {
            // Fail the test if the API call itself throws an error (e.g., file not found, parse error).
            // This ensures that a broken config file also causes a CI failure.
            throw new Error(`Snapshot test for "${configPath}" failed unexpectedly: ${error.message}`);
        }
    });

    test('staging.env config structure should match its snapshot', async () => {
        const configPath = 'examples/configs/staging.env';

        try {
            const result = await testSnapshot(configPath);
            expect(result.areEqual).toBe(true);
        } catch (error) {
            throw new Error(`Snapshot test for "${configPath}" failed unexpectedly: ${error.message}`);
        }
    });

    test('local.yml config structure should match its snapshot, ignoring transient keys', async () => {
        const configPath = 'examples/configs/local.yml';

        // Example: The `server.port` might be overridden by developers locally,
        // and the `debug.logFile` path might change per machine. We can ignore these
        // to avoid test failures for benign local modifications.
        const options = {
            ignore: ['server.port', 'debug.logFile'],
        };

        try {
            const result = await testSnapshot(configPath, options);
            expect(result.areEqual).toBe(true);
        } catch (error) {
            throw new Error(`Snapshot test for "${configPath}" failed unexpectedly: ${error.message}`);
        }
    });

    test('should fail gracefully if a snapshot does not exist', async () => {
        // This test ensures the API behaves as expected for new, un-snapshotted files.
        // In a real CI setup, you might want this to be a failing case.
        const configPath = 'examples/configs/new_config.json'; // A file that doesn't have a snapshot

        try {
            const result = await testSnapshot(configPath);

            // A non-existent snapshot means the structures are not "equal".
            expect(result.areEqual).toBe(false);
            expect(result.snapshotExists).toBe(false);
            expect(result.diffs).toEqual([]); // No diffs because there was no comparison.

        } catch (error) {
            // This test should only fail if the config file itself is unreadable,
            // which we simulate by expecting a "File not found" error.
            // If you created `new_config.json`, this catch block wouldn't be hit.
            if (!error.message.includes('File not found')) {
                throw new Error(`Test failed for an unexpected reason: ${error.message}`);
            }
            // This is an expected failure for this specific test case.
        }
    });
});