# Stream Router JS

A lightweight Node.js library for routing data from a single readable stream to multiple writable streams based on content-based rules. Ideal for data pipelines that need to split, filter, or categorize streaming data (like logs, events, or IoT telemetry) into different processing paths or storage destinations without buffering the entire dataset in memory.

## Features

*   **Content-Based Routing**: Direct data to different destinations based on its content.
*   **Multiple Rule Engines**:
    *   **JSONPath**: For routing object streams (e.g., JSON logs, API events).
    *   **RegExp**: For routing text-based streams (e.g., plain text logs, CSV).
*   **Backpressure Management**: Automatically handles backpressure from slow destinations to prevent memory overload.
*   **High Performance**: Operates on streams, processing data in chunks without loading entire datasets into memory.
*   **Flexible Configuration**:
    *   Route to one or many destinations per chunk.
    *   Option to stop routing after the first match.
    *   Set a default destination for unmatched data.
*   **Detailed Metrics**: Get insights into how many chunks are processed, dropped, and matched by each rule.
*   **Modern & Type-Safe**: Built with modern ES modules, custom errors for robust handling, and a clean, predictable API.

## Installation

Install the package using npm:

```bash
npm install stream-router-js
```

## Usage

The primary way to use the library is via the `createStreamRouter` factory function. You provide it with a set of rules, and it returns a Transform stream that you can pipe data through.

### API

`createStreamRouter(options)`

*   `options` `<Object>`:
    *   `rules` `<Array>`: An array of rule objects. **Required**.
        *   `name` `<string>`: A unique name for the rule (used for metrics).
        *   `type` `<string>`: The rule engine to use. Either `'jsonpath'` or `'regex'`.
        *   `expression` `<string>`: The expression to evaluate (a JSONPath string or a RegExp pattern).
        *   `destination` `<stream.Writable>`: The writable stream to send matching data to.
    *   `objectMode` `<boolean>`: Set to `true` if your source stream provides JavaScript objects. **Default**: `false`.
    *   `stopOnFirstMatch` `<boolean>`: If `true`, routing stops after the first matching rule. If `false` (default), a chunk can go to multiple destinations. **Default**: `false`.
    *   `defaultDestination` `<stream.Writable>`: A stream for chunks that don't match any rules. If not provided, unmatched chunks are dropped. **Default**: `null`.
    *   `passThrough` `<boolean>`: If `true`, all chunks are also passed through the router's readable side, allowing it to be used inline in a `pipeline`. **Default**: `false`.

### Basic Example

Here's how to set up a simple log router that separates error logs from info logs.

```javascript
import { createReadStream } from 'node:fs';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createStreamRouter } from 'stream-router-js';

// 1. Define your destination streams
const errorLogStream = new Writable({
  write(chunk, encoding, callback) {
    console.error(`[ERROR] ${chunk.toString().trim()}`);
    callback();
  },
});

const infoLogStream = new Writable({
  write(chunk, encoding, callback) {
    console.log(`[INFO] ${chunk.toString().trim()}`);
    callback();
  },
});

// 2. Create the router with your rules
const router = createStreamRouter({
  rules: [
    {
      name: 'error-rule',
      type: 'regex',
      expression: 'ERROR', // Matches any line containing "ERROR"
      destination: errorLogStream,
    },
    {
      name: 'info-rule',
      type: 'regex',
      expression: 'INFO', // Matches any line containing "INFO"
      destination: infoLogStream,
    },
  ],
});

// 3. Create a source stream (e.g., reading from a file)
const sourceLogStream = createReadStream('application.log');

// 4. Pipe the source through the router
await pipeline(sourceLogStream, router);

console.log('Routing complete.');
```

Assuming `application.log` contains:
```
INFO: Application started successfully.
DEBUG: Initializing cache.
ERROR: Failed to connect to database.
INFO: User 'admin' logged in.
```

The output would be:
```
[INFO] INFO: Application started successfully.
[ERROR] ERROR: Failed to connect to database.
[INFO] INFO: User 'admin' logged in.
Routing complete.
```
*(Note: `DEBUG` line is dropped as it matches no rule and no `defaultDestination` is set.)*

## Examples

### 1. Routing IoT Telemetry (JSON / Object Mode)

Route sensor data based on sensor type and value thresholds. This is a common use case in IoT data processing pipelines.

```javascript
// examples/iot-telemetry-router.js
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import createStreamRouter from 'stream-router-js';

// Mock destination for high-temp alerts
const highTempAlerts = new Writable({
  objectMode: true,
  write(chunk, _, cb) {
    console.log(`ALERT: High temperature detected! Sensor: ${chunk.sensorId}, Value: ${chunk.value}`);
    cb();
  },
});

// Mock destination for humidity data processing
const humidityProcessor = new Writable({
  objectMode: true,
  write(chunk, _, cb) {
    console.log(`HUMIDITY: Processing data for sensor ${chunk.sensorId}...`);
    cb();
  },
});

// A default destination for all other data
const defaultStorage = new Writable({
  objectMode: true,
  write(chunk, _, cb) {
    console.log(`STORAGE: Storing generic data from sensor ${chunk.sensorId}.`);
    cb();
  },
});

// Create the router
const router = createStreamRouter({
  objectMode: true, // Important for processing JSON objects
  rules: [
    {
      name: 'high-temp-warning',
      type: 'jsonpath',
      // Matches objects where type is 'temperature' AND value is over 30
      expression: '$[?(@.type === "temperature" && @.value > 30)]',
      destination: highTempAlerts,
    },
    {
      name: 'humidity-rule',
      type: 'jsonpath',
      expression: '$.[?(@.type === "humidity")]',
      destination: humidityProcessor,
    },
  ],
  defaultDestination: defaultStorage,
});

// Mock source stream of IoT data
const iotSource = Readable.from([
  { sensorId: 'A1', type: 'temperature', value: 25 },
  { sensorId: 'B2', type: 'humidity', value: 85 },
  { sensorId: 'A1', type: 'temperature', value: 35.5 }, // This will match the high-temp rule
  { sensorId: 'C3', type: 'pressure', value: 1012 }, // This will go to default
]);

// Run the pipeline
await pipeline(iotSource, router);
```

**Expected Output:**

```
STORAGE: Storing generic data from sensor A1.
HUMIDITY: Processing data for sensor B2...
ALERT: High temperature detected! Sensor: A1, Value: 35.5
STORAGE: Storing generic data from sensor C3.
```

### 2. Splitting Logs by Level (Text / RegExp)

This example demonstrates splitting a single log file into `errors.log`, `warnings.log`, and `info.log`.

```javascript
// examples/log-splitter.js
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import createStreamRouter from 'stream-router-js';

// Create writable streams for each log level
const errorLog = createWriteStream('errors.log');
const warnLog = createWriteStream('warnings.log');
const infoLog = createWriteStream('info.log');

// Create the router instance
const logRouter = createStreamRouter({
  rules: [
    { name: 'error', type: 'regex', expression: '^ERROR', destination: errorLog },
    { name: 'warn', type: 'regex', expression: '^WARN', destination: warnLog },
    { name: 'info', type: 'regex', expression: '^INFO', destination: infoLog },
  ],
});

// Add a 'finish' listener to know when files are written
logRouter.on('finish', () => {
  console.log('Log splitting complete. Check errors.log, warnings.log, and info.log');
});

// Mock a source stream (in a real app, this could be `process.stdin` or a file stream)
const sourceStream = Readable.from([
  'INFO: Service starting...\n',
  'WARN: Configuration value is deprecated.\n',
  'INFO: Listening on port 8080.\n',
  'ERROR: Database connection failed.\n',
  'DEBUG: Internal state check.\n', // This line will be dropped
]);

// Execute the pipeline
await pipeline(sourceStream, logRouter);
```

**Expected Output:**

The script will create three files with the following contents:

*   `errors.log`: `ERROR: Database connection failed.`
*   `warnings.log`: `WARN: Configuration value is deprecated.`
*   `info.log`: `INFO: Service starting...` and `INFO: Listening on port 8080.`

## License

[MIT](LICENSE)