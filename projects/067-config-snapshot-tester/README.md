# Config Snapshot Tester

A CLI tool and library for creating and testing snapshots of configuration files (JSON, YAML, .env). It helps prevent unintended breaking changes in application configuration by asserting that the structure and types of configuration data remain consistent across versions. Ideal for teams maintaining complex services where config drift can cause silent failures.

## Features

-   **Snapshot Testing:** Generate and compare snapshots of your config files.
-   **Multiple Formats:** First-class support for JSON, YAML/YML, and .env files.
-   **Powerful CLI:** Easy-to-use commands for `test`, `generate`, and `update` workflows.
-   **Programmatic API:** Integrate snapshot testing directly into your CI/CD pipeline with Vitest, Jest, or any Node.js test runner.
-   **Detailed Diffs:** Get clear, color-coded output highlighting additions, removals, and type changes.
-   **Ignore Keys:** Option to ignore specific keys (e.g., secrets, transient values) using dot-notation.

## Installation

You can install the tool globally to use the CLI anywhere, or as a dev dependency in your project for CI integration.

**Global Installation (for CLI):**

```bash
npm install -g config-snapshot-tester
```

**Local Installation (for API/CI):**

```bash
npm install --save-dev config-snapshot-tester
```

## Usage

### CLI

The `config-snap` command is your entry point. It supports three main actions: `generate`, `update`, and `test`.

-   **`generate <filePath>`**: Creates a new snapshot for a config file. Snapshots are stored in a `__snapshots__` directory next to the original file.
-   **`test <filePath>`**: Compares a config file against its existing snapshot and reports any differences.
-   **`update <filePath>`**: Updates an existing snapshot to match the current state of the config file.

#### CLI Options

-   `--ignore <path>` or `-i <path>`: Specify a dot-notation key to ignore during comparison. Can be used multiple times. (e.g., `config-snap test config.json -i db.password -i server.host`)

### Programmatic API

For CI/CD integration, you can use the programmatic API within your test suite.

```javascript
import { test, expect } from 'vitest';
// In your project, you'd use: import { testSnapshot } from 'config-snapshot-tester';
import { testSnapshot } from './src/api.js';

test('production config structure should not change', async () => {
  // Throws if the file can't be parsed; returns a result object otherwise.
  const result = await testSnapshot('./config/production.json', {
    ignore: ['app.secretKey'] // Optional: ignore specific keys
  });

  // Assert that the structure and types match the snapshot.
  expect(result.areEqual).toBe(true, 'Configuration snapshot test failed!');
});
```

## Examples

### Example 1: Generating a Snapshot

First, create a snapshot of your production configuration.

**Command:**

```bash
config-snap generate examples/configs/production.json
```

**Output:**

```
Snapshot created: examples/configs/__snapshots__/production.json.snap
```

This creates a `production.json.snap` file in `examples/configs/__snapshots__/` containing a type map of your configuration.

### Example 2: Testing for Changes

Now, imagine a developer accidentally removes the `port` key from `production.json`. Running the test command will immediately catch this structural change.

**Command:**

```bash
config-snap test examples/configs/production.json
```

**Output:**

```
FAIL examples/configs/production.json
  › Snapshot test failed.
    - Removed: 'server.port' (expected type: number)

  Run `config-snap update examples/configs/production.json` to accept the changes.
```

### Example 3: Integrating with Jest/Vitest

Here’s how to set up a test in your CI pipeline to automatically validate configuration on every pull request.

**File: `config.test.js`**

```javascript
import { testSnapshot } from 'config-snapshot-tester';
import { describe, test, expect } from 'vitest';

describe('Application Configuration', () => {
  const configs = [
    './config/production.json',
    './config/staging.yml',
    './config/.env.production',
  ];

  for (const configFile of configs) {
    test(`structure of ${configFile} should not change`, async () => {
      const result = await testSnapshot(configFile);

      if (!result.snapshotExists) {
        throw new Error(`Snapshot for ${configFile} not found. Please run 'config-snap generate ${configFile}'.`);
      }

      expect(result.areEqual, `Snapshot for ${configFile} is out of date.`).toBe(true);
    });
  }
});
```

When you run your test suite (`npm test` or `npx vitest`), these tests will execute, failing the build if any configuration structure has drifted.

## License

[MIT](LICENSE)