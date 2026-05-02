# Network Chaos Injector

A programmatic network chaos testing tool for Node.js applications. It intercepts and manipulates `http` and `https` requests at the module level without needing a proxy server. Ideal for developers and QA engineers who want to test their application's resilience to network failures like latency, packet loss, and HTTP errors directly within their integration or end-to-end test suites.

## Features

-   **Proxy-less Interception**: Intercepts outgoing `http.request` and `https.request` calls using module patching.
-   **Latency Injection**: Injects artificial latency (fixed or random range) into requests.
-   **Packet Loss Simulation**: Simulates network failure by prematurely terminating requests with an error.
-   **HTTP Error Forging**: Forces specific HTTP error responses (e.g., 503 Service Unavailable, 429 Too Many Requests).
-   **Targeted Rules**: Apply chaos only to specific hostnames, paths, or methods using a flexible rule engine.
-   **Programmatic API**: A clean, chainable API for composing complex chaos scenarios in your test suites.
-   **CLI Tool**: Apply chaos scenarios to any Node.js application script without code changes.
-   **Graceful Cleanup**: Automatically restores original module functionality after tests.

## Installation

Install the package using npm:

```bash
npm install network-chaos-injector --save-dev
```

## Usage

There are two ways to use Network Chaos Injector: programmatically within your code (e.g., in a test suite) or via the CLI to wrap an existing Node.js script.

### Programmatic API

Use the `Injector` class to define rules and control when chaos is active. This is perfect for integration tests with frameworks like Jest or Mocha.

```javascript
// examples/programmatic-jest.js
import { Injector, latency, errorResponse } from 'network-chaos-injector';

// Initialize the injector
const injector = new Injector();

// Define chaos rules
injector
  .addRule({
    target: { host: 'api.flaky-service.com', path: '/data' },
    scenario: latency({ minDelay: 500, maxDelay: 1500 }),
    probability: 0.5 // Apply this rule 50% of the time
  })
  .addRule({
    target: { host: 'api.overloaded-service.com', method: 'POST' },
    scenario: errorResponse({ statusCode: 503, body: '{"error": "Service Unavailable"}' })
  });

// Use with a test runner like Jest
describe('My Application Resilience', () => {
  beforeAll(() => {
    injector.start(); // Start injecting chaos
  });

  afterAll(() => {
    injector.stop(); // Stop and clean up
  });

  test('should handle latency when fetching data', async () => {
    // Your test logic that calls 'api.flaky-service.com'
    // Assert that your application handles the delay gracefully (e.g., shows a loading state)
  });

  test('should retry on 503 errors from overloaded service', async () => {
    // Your test logic that POSTs to 'api.overloaded-service.com'
    // Assert that your SDK or client correctly retries the request
  });
});
```

### Command-Line Interface (CLI)

The `chaos-run` CLI allows you to apply chaos to any Node.js application without modifying its source code.

1.  **Create a configuration file:**

    ```javascript
    // chaos.config.js
    import { latency, packetLoss } from 'network-chaos-injector';

    export default {
      rules: [
        {
          target: { host: 'api.github.com' },
          scenario: latency({ delay: 1000 }),
          probability: 0.75,
        },
        {
          target: { host: 'some-other-api.com' },
          scenario: packetLoss(),
        },
      ],
    };
    ```

2.  **Run your application with chaos:**

    Use the `chaos-run` command, passing your config file and the script you want to run.

    ```bash
    chaos-run --config ./chaos.config.js -- node your-app.js
    ```

    All `http`/`https` requests made by `your-app.js` will now be subject to the chaos rules defined in `chaos.config.js`.

## Examples

### 1. Simulating a Slow API

Imagine you want to test how your application behaves when a critical API is slow.

**Chaos Configuration (`chaos.config.js`):**

```javascript
import { latency } from 'network-chaos-injector';

export default {
  rules: [
    {
      target: { host: 'jsonplaceholder.typicode.com', path: /^\/todos\/\d+$/ },
      scenario: latency({ delay: 2000 }), // Add a 2-second delay
    },
  ],
};
```

**Application (`app.js`):**

```javascript
// app.js
console.log('Fetching user data...');
const start = Date.now();
fetch('https://jsonplaceholder.typicode.com/todos/1')
  .then(res => res.json())
  .then(data => {
    const duration = Date.now() - start;
    console.log(`Success! Fetched data in ${duration}ms:`, data);
  })
  .catch(err => console.error('Request failed:', err));
```

**Run with Chaos:**

```bash
$ chaos-run --config ./chaos.config.js -- node app.js

(chaos-run) › Loading chaos configuration...
(chaos-run) › Chaos configuration loaded
(chaos-run) › Initializing chaos injector...
(chaos-run) › Chaos injector is active
(chaos-run) › Running target script: app.js with chaos enabled...
--------------------------------------------------
Fetching user data...
Success! Fetched data in 2087ms: { userId: 1, id: 1, title: 'delectus aut autem', completed: false }
--------------------------------------------------
(chaos-run) › Target script finished successfully (exit code 0).
(chaos-run) › Stopping chaos injector...
(chaos-run) › Chaos injector stopped.
```

### 2. Testing Retry Logic for Server Errors

Verify that your client-side SDK correctly retries a failed request.

**Chaos Configuration:**

```javascript
// In your Jest test file
import { Injector, errorResponse } from 'network-chaos-injector';

const injector = new Injector();
injector.addRule({
  target: { host: 'api.example.com' },
  scenario: errorResponse({ statusCode: 503 }),
});
```

**Test Implementation (`my-sdk.test.js`):**

```javascript
// my-sdk.test.js
import { mySdk } from './my-sdk'; // Your SDK with retry logic

describe('My SDK', () => {
  beforeAll(() => injector.start());
  afterAll(() => injector.stop());

  test('should retry up to 3 times on a 503 error', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    // Expect the call to fail after all retries are exhausted
    await expect(mySdk.getData()).rejects.toThrow('Service Unavailable');

    // The first call + 2 retries = 3 total calls
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
```

This test deterministically simulates the exact network condition needed to validate the retry mechanism without relying on a real, unstable network.

## License

[MIT](LICENSE)