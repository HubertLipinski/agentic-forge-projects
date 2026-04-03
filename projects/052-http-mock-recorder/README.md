# HTTP Mock Recorder

[![npm version](https://img.shields.io/npm/v/http-mock-recorder.svg)](https://www.npmjs.com/package/http-mock-recorder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/your-username/http-mock-recorder)

A zero-configuration CLI and programmatic tool that records real HTTP interactions from your Node.js test suite into easily editable JSON files. It then replays these mocks on subsequent runs, enabling fast, deterministic, and offline-capable unit and integration tests. Ideal for developers testing services that rely on external APIs.

## Features

-   ✅ **Automatic Recording**: Captures outgoing HTTP requests from your tests into human-readable JSON fixtures.
-   ✅ **Automatic Replay**: Intercepts test requests and serves responses from fixtures on subsequent runs.
-   ✅ **Zero Configuration**: Works out of the box with popular test runners like Jest, Mocha, and Ava.
-   ✅ **Deterministic Tests**: Ensures your tests always receive the same API responses, eliminating flakiness from network or third-party API issues.
-   ✅ **Offline-Capable**: Run your integration tests anywhere, even without an internet connection.
-   ✅ **Watch Mode**: Automatically re-records fixtures when your source files change, speeding up your development workflow.
-   ✅ **Smart Matching**: Matches requests by method, URL (including query parameters), and body to ensure the correct mock is used.

## Installation

You can install the package locally as a development dependency in your project.

```bash
npm install http-mock-recorder --save-dev
```

This makes the `http-mock-recorder` command available to your npm scripts and via `npx`.

## Usage

`http-mock-recorder` acts as a wrapper around your existing test command. You simply prefix your command with `http-mock-recorder` and add the appropriate flags.

### CLI Commands

#### 1. Record Mode

On your first run, use the `--record` flag. This will execute your test command, allow all HTTP requests to go through to the real servers, and save each request/response pair as a JSON file in the `__http_mocks__` directory.

```bash
# Record all HTTP interactions made by `jest`
npx http-mock-recorder --record -- jest

# Record interactions from a specific mocha test file
npx http-mock-recorder --record -- mocha "tests/api.test.js"
```

Use the `--clear` (or `-c`) flag to delete all existing fixtures before recording.

```bash
# Clear old mocks and record a fresh set
npx http-mock-recorder --record --clear -- npm test
```

#### 2. Replay Mode (Default)

For all subsequent runs, omit the `--record` flag. The tool will run in replay mode by default, intercepting any outgoing HTTP requests and serving the corresponding response from your saved fixtures. No real network calls are made.

```bash
# Run jest in replay mode
npx http-mock-recorder jest

# Run your npm test script in replay mode
npx http-mock-recorder npm test
```

If a request is made that does not have a matching fixture, the test will fail with an error. This prevents unexpected network calls.

#### 3. Watch Mode

Use the `--watch` flag with a file glob to automatically re-record fixtures whenever your application code changes. This is perfect for rapid TDD workflows.

```bash
# Watch for changes in any .js file in the src/ directory
# On change, it will re-run `jest` in record mode.
npx http-mock-recorder --watch "src/**/*.js" -- jest
```

### Configuration Options

-   `--record`, `-r`: Activates record mode.
-   `--watch <glob>`, `-w <glob>`: Activates watch mode for the given file pattern. Can be used multiple times.
-   `--fixtures-dir <path>`, `-d <path>`: Specifies a custom directory for fixtures (default: `__http_mocks__`).
-   `--clear`, `-c`: In record mode, deletes existing fixtures before recording.
-   `--allow-unmocked`, `-u`: In replay mode, allows requests without a matching fixture to connect to the network. Use with caution.

## Examples

Let's say you have a test file `api.test.js` that tests a function making a `fetch` call to `https://api.example.com/users/1`.

**`api.test.js`**
```javascript
// A simple test using Jest and fetch
describe('API client', () => {
  test('should fetch user data correctly', async () => {
    const response = await fetch('https://api.example.com/users/1');
    const user = await response.json();
    expect(user.id).toBe(1);
    expect(user.name).toBe('John Doe');
  });
});
```

---

### Example 1: First Run (Recording)

You run the recorder for the first time to capture the live API interaction.

**Command:**
```bash
npx http-mock-recorder --record -- jest api.test.js
```

**Output:**
```
[Recorder] Starting in record mode...
[Recorder] Nock recorder is active. Capturing outgoing HTTP requests.
[Orchestrator] Spawning test process: jest api.test.js
PASS  ./api.test.js
 ✓ should fetch user data correctly (58ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        1.24s
[Orchestrator] Test process finished with exit code: 0
[Recorder] Recorded: GET https://api.example.com/users/1 -> __http_mocks__/a1b2c3d4...json
[Recorder] Recording stopped. Total requests recorded: 1
[Orchestrator] Exiting with code 0.
```
A new file `__http_mocks__/a1b2c3d4...json` is created containing the response from the server.

---

### Example 2: Second Run (Replaying)

Now, you run the same command without the `--record` flag.

**Command:**
```bash
npx http-mock-recorder jest api.test.js
```

**Output:**
```
[Replayer] Starting in replay mode...
[Replayer] Loading fixtures from: /path/to/your/project/__http_mocks__
[Replayer] Activated 1 mock definition(s).
[Replayer] Unmocked requests will be blocked.
[Orchestrator] Spawning test process: jest api.test.js
PASS  ./api.test.js
 ✓ should fetch user data correctly (4ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.78s
[Orchestrator] Test process finished with exit code: 0
[Replayer] Replay mode stopped. Mocks have been deactivated.
[Orchestrator] Exiting with code 0.
```
The test passes instantly without hitting the network, using the mock file instead. Notice the test execution time is significantly faster.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.