# Mem-Leak Sentinel

A simple, embeddable memory leak detector for long-running Node.js applications. It periodically samples heap usage and triggers alerts if the memory grows consistently over several intervals, helping developers find potential memory leaks during development or in production without complex tooling.

## Features

- **Periodic Monitoring**: Automatically samples heap usage at a configurable interval.
- **Trend-Based Detection**: Uses a sliding window to track recent heap readings and detects consistent growth.
- **Configurable**: Easily set the sampling interval and the sensitivity (number of consecutive increases) for alerts.
- **Event-Driven**: Emits a `leak` event when a potential leak is detected, allowing for flexible integration with logging, alerting, or other systems.
- **Lightweight & Portable**: Zero external dependencies, making it easy to drop into any Node.js project.
- **Programmatic Control**: Simple `start()` and `stop()` API to manage the monitoring lifecycle.

## Installation

Install the package using npm:

```bash
npm install mem-leak-sentinel
```

Alternatively, you can clone the repository and install dependencies if you want to run the examples directly:

```bash
git clone https://github.com/your-username/mem-leak-sentinel.git
cd mem-leak-sentinel
npm install
```

## Usage

Import the `Sentinel` class, create an instance with your desired configuration, and listen for the `leak` event.

```javascript
import { Sentinel } from 'mem-leak-sentinel';

// 1. Configure the Sentinel
const sentinel = new Sentinel({
  sampleInterval: 10000, // Sample every 10 seconds
  alertThreshold: 5,     // Alert after 5 consecutive increases
});

// 2. Listen for potential leaks
sentinel.on('leak', (details) => {
  console.error('🚨 Potential Memory Leak Detected!', {
    heapUsed: `${(details.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    history: details.history.map(h => `${(h / 1024 / 1024).toFixed(2)} MB`),
    timestamp: details.timestamp,
  });
  
  // In a real application, you might:
  // - Send an alert to a monitoring service (e.g., PagerDuty, Slack).
  // - Trigger a graceful shutdown.
  // - Create a heap dump for later analysis.
});

// 3. Start monitoring
sentinel.start();

console.log('Memory leak monitoring has started.');

// To stop monitoring:
// sentinel.stop();
```

### API

#### `new Sentinel(options)`

Creates a new `Sentinel` instance.

- `options` `<Object>`:
  - `sampleInterval` `<number>`: The interval in milliseconds to sample heap usage. **Default:** `5000`. Must be `>= 1000`.
  - `alertThreshold` `<number>`: The number of consecutive heap size increases required to trigger an alert. **Default:** `3`. Must be `>= 2`.
  - `onLeak` `<Function>`: A callback function to execute when a leak is detected. This is a shorthand for `sentinel.on('leak', callback)`.
  - `autoStart` `<boolean>`: If `true`, starts monitoring immediately upon instantiation. **Default:** `false`.

#### `sentinel.start()`

Starts the memory monitoring process. Emits a `start` event.

#### `sentinel.stop()`

Stops the memory monitoring process. Emits a `stop` event.

#### `sentinel.isRunning()`

Returns `true` if the sentinel is currently monitoring, `false` otherwise.

#### Event: `'leak'`

- `details` `<Object>`:
  - `message`: A summary of the alert.
  - `heapUsed`: The current heap size in bytes.
  - `history`: An array of the last `alertThreshold` heap size readings.
  - `consecutiveIncreases`: The number of consecutive increases detected.
  - `sampleInterval`: The configured sample interval.
  - `alertThreshold`: The configured alert threshold.
  - `timestamp`: The ISO string timestamp of the alert.

## Examples

### 1. Basic Leak Simulation

This example simulates a memory leak by continuously adding data to an array. The sentinel detects the consistent growth and triggers an alert.

To run this example: `npm run example:basic`

```javascript
// examples/basic-usage.js

import { Sentinel } from '../src/index.js';

const leakyArray = [];

const sentinel = new Sentinel({
  sampleInterval: 2000, // Check every 2 seconds
  alertThreshold: 4,    // Alert after 4 consecutive increases
});

sentinel.on('leak', (details) => {
  console.error('\n🚨 POTENTIAL MEMORY LEAK DETECTED! 🚨\n');
  console.error(`Current Heap Size: ${(details.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.error(`Timestamp: ${details.timestamp}`);
  console.error('\nExiting application...');
  
  sentinel.stop();
  process.exit(1);
});

sentinel.start();
console.log('✅ Mem-Leak Sentinel started. Simulating a leak...');

// Simulate a leak by adding 1MB of data every second
setInterval(() => {
  leakyArray.push('x'.repeat(1024 * 1024));
  console.log(`Leaky array now contains ${leakyArray.length} items.`);
}, 1000);
```

**Expected Output:**

```
✅ Mem-Leak Sentinel started. Simulating a leak...
Leaky array now contains 1 items.
Leaky array now contains 2 items.
Leaky array now contains 3 items.
Leaky array now contains 4 items.
Leaky array now contains 5 items.
Leaky array now contains 6 items.
Leaky array now contains 7 items.

🚨 POTENTIAL MEMORY LEAK DETECTED! 🚨

Current Heap Size: 11.45 MB
Timestamp: 2023-10-27T10:30:00.123Z

Exiting application...
```

### 2. Express.js Server Integration

This example shows how to integrate the sentinel into a long-running Express server. A special `/leak` endpoint is created to simulate a memory leak when called.

To run this example:
1. `npm install express`
2. `npm run example:express`
3. In another terminal, call the leak endpoint several times: `curl http://localhost:3000/leak`

```javascript
// examples/express-server.js

import express from 'express';
import { Sentinel } from '../src/index.js';

const app = express();
const leakyDataStore = [];

// Configure and start the sentinel
const sentinel = new Sentinel({
  sampleInterval: 5000,
  alertThreshold: 4,
  autoStart: true, // Start monitoring with the server
});

sentinel.on('leak', (details) => {
  console.error('====================================================');
  console.error('🚨 POTENTIAL MEMORY LEAK DETECTED IN SERVER! 🚨');
  console.error(`Current Heap Size: ${(details.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.error('====================================================');
});

// A route that simulates a memory leak
app.get('/leak', (req, res) => {
  leakyDataStore.push('x'.repeat(10 * 1024 * 1024)); // Add 10MB
  res.send(`Leak simulated. Items in store: ${leakyDataStore.length}`);
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
  console.log('✅ Sentinel is active. Hit /leak to simulate memory growth.');
});
```

**Expected Output (in server console after hitting `/leak` multiple times):**

```
🚀 Server running on http://localhost:3000
✅ Sentinel is active. Hit /leak to simulate memory growth.
====================================================
🚨 POTENTIAL MEMORY LEAK DETECTED IN SERVER! 🚨
Current Heap Size: 48.21 MB
====================================================
```

## License

[MIT](LICENSE)