# Flaky Test Detector

A CLI tool that repeatedly runs a test suite to identify and report flaky tests. It executes the test command multiple times, captures output, and analyzes results to pinpoint tests that pass and fail intermittently. Ideal for CI/CD pipelines to improve test suite reliability before merging code.

## Features

-   **Repeated Execution**: Runs a user-defined test command 'N' times.
-   **Output Parsing**: Parses test output to identify individual test case results.
-   **Test Runner Support**: Supports common test runners (Jest, Mocha) through configurable regex parsers.
-   **Status Tracking**: Tracks the pass/fail status of each test across all runs.
-   **Summary Report**: Generates a final summary report of flaky tests, including success rates.
-   **Parallel Execution**: Speeds up detection by running tests in parallel.
-   **Graceful Shutdown**: Handles `Ctrl+C` (SIGINT) to provide an intermediate report.
-   **Flexible Configuration**: Configure via CLI arguments or a `flaky-detector.config.js` file.

## Installation

You can install the tool globally via npm to use it in any project:

```bash
npm install -g flaky-test-detector
```

Alternatively, you can clone the repository and install dependencies for development:

```bash
git clone https://github.com/your-username/flaky-test-detector.git
cd flaky-test-detector
npm install
```

## Usage

The primary way to use the tool is via the `flaky-test-detector` command. The only required argument is `--command`, which specifies how to run your test suite.

### CLI Options

| Option                 | Alias | Description                                                        | Default  |
| ---------------------- | ----- | ------------------------------------------------------------------ | -------- |
| `--command`            | `-c`  | The test command to execute (e.g., `"npm test"`).                  | `null`   |
| `--runs`               | `-r`  | The total number of times to run the test suite.                   | `10`     |
| `--parallel`           | `-p`  | The number of test runs to execute in parallel.                    | `1`      |
| `--parser`             |       | The test output parser to use.                                     | `jest`   |
| `--cwd`                |       | The working directory to run the command from.                     | `.`      |
| `--exitOnFirstFailure` |       | Stop all runs immediately after the first test suite failure.      | `false`  |
| `--showStable`         |       | Include stable tests in the final report.                          | `false`  |
| `--help`               | `-h`  | Show help.                                                         |          |
| `--version`            | `-v`  | Show version number.                                               |          |

### Configuration File

For more complex projects, you can create a `flaky-detector.config.js` file in your project root. CLI arguments will override settings in the configuration file.

**Example `flaky-detector.config.js`:**

```javascript
// flaky-detector.config.js
/** @type {import('flaky-test-detector').Config} */
export default {
  command: 'npm run test:ci',
  runs: 20,
  parallel: 4,
  parser: 'jest',
  exitOnFirstFailure: false,
};
```

With this file in place, you can simply run:

```bash
flaky-test-detector
```

## Examples

### 1. Basic Jest Project

Run the default `npm test` command 10 times and report any flaky tests.

```bash
flaky-test-detector --command "npm test" --runs 10
```

**Expected Output:**

```
Starting flaky test detection with the following configuration:
  - Command:   npm test
  - Runs:      10
  - Parallel:  1
  - Parser:    jest

⠏ Running tests... (0/10 completed)
...
✔ All test runs completed.

==================================================
 Flaky Test Detector Report 
==================================================

Analysis complete. Found 4 unique tests across 10 runs.

Flaky Tests (2)
  - should fail randomly, demonstrating flakiness - 50.00% success (5 passed, 5 failed)
  - should sometimes fail due to a simulated race condition - 60.00% success (6 passed, 4 failed)

Consistently Failing Tests (1)
  - should fail consistently - 0.00% success (0 passed, 10 failed)

==================================================

💡 Tip: Investigate the tests listed above to improve your suite's reliability.
```

### 2. Mocha Project with Parallel Execution

Run a Mocha test suite 50 times, using 4 parallel workers to speed up the process.

```bash
flaky-test-detector --command "npm run test:mocha" --parser mocha --runs 50 --parallel 4
```

### 3. Usage in CI/CD

In a CI pipeline, you can use the exit code to determine if the build should fail. The tool exits with code `1` if flaky or failing tests are found, and `0` otherwise.

```yaml
# Example for GitHub Actions
- name: Detect Flaky Tests
  run: flaky-test-detector --command "npm test" --runs 20 --parallel 2
```

If flaky tests are detected, the command will fail, and the CI pipeline will stop, preventing unstable code from being merged.

## License

This project is licensed under the MIT License.