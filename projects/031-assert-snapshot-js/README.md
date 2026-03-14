# Assert Snapshot JS

A lightweight, zero-dependency snapshot testing utility for Node.js. It allows developers to test complex data structures and objects by comparing them against a stored 'snapshot' file. If the snapshot doesn't exist, it's created. If it exists and the output differs, the test fails, highlighting the changes. Ideal for unit and integration tests where object outputs are complex and change frequently.

[![NPM version](https://img.shields.io/npm/v/assert-snapshot-js.svg)](https://www.npmjs.com/package/assert-snapshot-js)
[![License](https://img.shields.io/npm/l/assert-snapshot-js.svg)](https://opensource.org/licenses/MIT)

## Features

-   **Zero-Dependency Core:** The core assertion logic has no external dependencies, ensuring maximum compatibility and a tiny footprint.
-   **Automatic Snapshot Creation:** Snapshot files are automatically created on the first run, making setup effortless.
-   **Deep Object Comparison:** Compares nested objects and arrays with a deep equality check, ignoring insignificant differences like object property order.
-   **Easy Updates:** A simple CLI flag (`--update-snapshots` or `-u`) lets you explicitly accept changes and update snapshots.
-   **Colorized Diffs:** Get beautiful, easy-to-read diffs in your terminal when a mismatch is found, showing you exactly what changed.
-   **Configurable:** Easily configure the snapshot directory and file extension to fit your project's structure.
-   **Modern JS Support:** Handles modern JavaScript types like `BigInt`, `Date`, `Set`, `Map`, and `undefined` correctly during serialization.

## Installation

Install the package as a development dependency in your project:

```bash
npm install --save-dev assert-snapshot-js
```

## Usage

`assert-snapshot-js` is designed to be used within a test runner like Node.js's built-in test module, Jest, or Mocha.

### API

The primary API is a single asynchronous function: `assertSnapshot(value, testName)`.

-   `value` (`any`): The value (e.g., object, array, primitive) from your code that you want to test.
-   `testName` (`string`): A unique, file-safe name for this snapshot. This name is used to create the snapshot file (e.g., `my-test.snap`).

### Basic Test File

Here's how you would use it with Node.js's native test runner (`node --test`).

```javascript
// my-feature.test.js
import { test } from 'node:test';
import assertSnapshot from 'assert-snapshot-js';

test('should return the correct user object', async () => {
  const user = {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  // On the first run, this creates __snapshots__/user-object.snap
  // On subsequent runs, it compares `user` against the snapshot.
  await assertSnapshot(user, 'user-object');
});
```

### Running Tests

1.  **First Run (Create Snapshots):**
    Run your tests normally. New snapshots will be created in the `__snapshots__` directory.

    ```bash
    node --test
    ```

2.  **Subsequent Runs (Compare Snapshots):**
    Run the tests again. They will pass if the output matches the snapshots. If there's a mismatch, the test will fail and print a colorized diff.

    ```bash
    node --test
    ```

3.  **Updating Snapshots:**
    If a change is intentional, run your tests with the `-u` or `--update-snapshots` flag to overwrite the existing snapshots with the new output.

    ```bash
    node --test --update-snapshots
    # or
    node --test -u
    ```

### Configuration

You can customize the snapshot directory and file extension. Create a setup file or add this to the top of your test entry point.

```javascript
// test/setup.js
import { configure } from 'assert-snapshot-js';

configure.set({
  snapshotDir: 'test/snapshots', // Default is '__snapshots__'
  snapshotFileExtension: '.snapshot', // Default is '.snap'
});
```

## Examples

### Example 1: Basic Object Snapshot

This test will create a snapshot of a simple user object.

**Test Code (`examples/basic-usage.test.js`):**
```javascript
import { test } from 'node:test';
import assertSnapshot from 'assert-snapshot-js';

test('should match the stored snapshot for a simple user object', async () => {
  const user = {
    id: 1,
    username: 'johndoe',
    email: 'john.doe@example.com',
    registeredAt: new Date('2023-10-27T10:00:00.000Z'),
    isActive: true,
  };

  await assertSnapshot(user, 'simple-user-object');
});
```

**Generated Snapshot (`__snapshots__/simple-user-object.snap`):**
```json
{
  "email": "john.doe@example.com",
  "id": 1,
  "isActive": true,
  "registeredAt": "2023-10-27T10:00:00.000Z",
  "username": "johndoe"
}
```
*Note: Object keys are sorted alphabetically to ensure stable snapshots.*

### Example 2: Mismatch and Diff Output

If we change the `username` in the test above from `'johndoe'` to `'john.doe'`, the test will fail with the following output:

```
Snapshot mismatch for test: "simple-user-object"

- Snapshot + Received

{
  "email": "john.doe@example.com",
  "id": 1,
  "isActive": true,
  "registeredAt": "2023-10-27T10:00:00.000Z",
  "username": - "johndoe"
+ "john.doe"
}

Run with the '--update-snapshots' or '-u' flag to update the snapshot.
```

### Example 3: Complex Data Structure

The formatter handles various JavaScript types, ensuring they are stored consistently.

**Test Code (`examples/complex-object.test.js`):**
```javascript
import { test } from 'node:test';
import assertSnapshot from 'assert-snapshot-js';

test('should correctly snapshot a complex API response', async () => {
  const apiResponse = {
    userId: 9876543210987654321n, // BigInt
    roles: new Set(['contributor', 'beta-tester']), // Set
    metadata: new Map([['views', 1024]]), // Map
    lastLogin: undefined, // undefined
    validation: /^[a-z0-9-]+$/, // RegExp
  };

  await assertSnapshot(apiResponse, 'complex-api-response');
});
```

**Generated Snapshot (`__snapshots__/complex-api-response.snap`):**
```json
{
  "lastLogin": undefined,
  "metadata": [
    [
      "views",
      1024
    ]
  ],
  "roles": [
    "beta-tester",
    "contributor"
  ],
  "userId": "9876543210987654321n",
  "validation": "/^[a-z0-9-]+$/"
}
```

## Contributing

Contributions are welcome! Please open an issue to discuss a new feature or bug fix. Pull requests should be well-documented and include tests.

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b feature/my-new-feature`).
3.  Make your changes.
4.  Run tests (`npm test`).
5.  Commit your changes (`git commit -am 'Add some feature'`).
6.  Push to the branch (`git push origin feature/my-new-feature`).
7.  Create a new Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.