# stream-fork-join

[![NPM version](https://img.shields.io/npm/v/stream-fork-join.svg)](https://www.npmjs.com/package/stream-fork-join)
[![License](https://img.shields.io/npm/l/stream-fork-join.svg)](https://github.com/your-username/stream-fork-join/blob/main/LICENSE)
[![Node.js CI](https://github.com/your-username/stream-fork-join/actions/workflows/node.js.yml/badge.svg)](https://github.com/your-username/stream-fork-join/actions/workflows/node.js.yml)

A Node.js utility for forking a readable stream into multiple, independent writable streams and optionally joining them back into a single readable stream after all forks have completed. It's designed for scenarios where you need to process a single data source in parallel (e.g., writing to different files, sending to multiple APIs, performing different transformations) without reading the source multiple times.

## Features

-   **Forking**: Pipe a single `Readable` stream to N `Writable` stream targets.
-   **Backpressure**: Automatically propagates backpressure from the slowest fork back to the source stream, preventing memory bloat.
-   **Joining**: Optionally create a new `Readable` stream that emits data only after all forked processing streams have finished.
-   **Error Handling**: Configurable strategies to either halt all forks on an error (`abortOnError: true`) or allow healthy forks to continue (`abortOnError: false`).
-   **Object & Buffer Modes**: Works seamlessly with both standard buffer/string streams and `objectMode` streams.
-   **Asynchronous & Non-Blocking**: Built on native Node.js streams for maximum performance and efficiency.
-   **Data Integrity**: In `objectMode`, `structuredClone()` is used to ensure each fork receives an independent copy of the data, preventing side-effects.

## Installation

Install the package using npm:

```bash
npm install stream-fork-join
```

Or, clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/stream-fork-join.git
cd stream-fork-join
npm install
```

## Usage

The library exports two primary functions: `fork()` and `join()`.

### `fork(targets, [options])`

Creates a `Writable` stream that multiplexes its input to an array of target streams.

-   `targets` `<Array<Writable>>`: An array of `Writable` streams to which data will be forked.
-   `options` `<Object>`: (Optional)
    -   `objectMode` `<boolean>`: Set to `true` if streams operate in object mode. **Default:** `false`.
    -   `abortOnError` `<boolean>`: If `true`, an error in one fork destroys all others. **Default:** `true`.
    -   `highWaterMark` `<number>`: Buffer size for the internal multiplexer stream.

**Returns:** `<Writable>` - A multiplexer stream that you can pipe a source stream into.

```javascript
import { fork } from 'stream-fork-join';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const source = createReadStream('source.txt');
const targetA = createWriteStream('copy-a.log');
const targetB = createWriteStream('copy-b.log');

// Create a multiplexer that writes to both files
const multiplexer = fork([targetA, targetB]);

// Pipe the source to the multiplexer
await pipeline(source, multiplexer);

console.log('Data has been forked to both files.');
```

### `join(source, forks, [options])`

Creates a full fork-join pipeline. It forks a `source` stream to multiple `forks` (Transform/Duplex streams) and returns a new `Readable` stream that aggregates the results.

-   `source` `<Readable>`: The source `Readable` stream.
-   `forks` `<Array<Duplex|Transform>>`: An array of streams for parallel processing.
-   `options` `<Object>`: Same options as `fork()`. `objectMode` is inferred from the source stream if not set.

**Returns:** `<Readable>` - A stream that will emit the combined results from all forks.

```javascript
import { join } from 'stream-fork-join';
import { Readable, Transform } from 'node:stream';

const source = Readable.from([{ val: 1 }, { val: 2 }], { objectMode: true });

const double = new Transform({
  objectMode: true,
  transform(chunk, enc, cb) { cb(null, { doubled: chunk.val * 2 }); }
});

const addTen = new Transform({
  objectMode: true,
  transform(chunk, enc, cb) { cb(null, { added: chunk.val + 10 }); }
});

// Create the full pipeline
const joinedStream = join(source, [double, addTen]);

for await (const result of joinedStream) {
  console.log(result);
}
// { doubled: 2 }
// { added: 11 }
// { doubled: 4 }
// { added: 12 }
// (Order is not guaranteed)
```

## Examples

### 1. Simple Fork to Multiple Files

This example reads `source.log` and writes its content to both `archive.log` and `error-monitor.log` simultaneously.

```javascript
// examples/simple-fork-example.js
import { fork } from 'stream-fork-join';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

console.log('Forking source.log to archive.log and error-monitor.log...');

const sourceStream = createReadStream('source.log');
const archiveStream = createWriteStream('archive.log');
const monitorStream = createWriteStream('error-monitor.log');

const multiplexer = fork([archiveStream, monitorStream]);

try {
  await pipeline(sourceStream, multiplexer);
  console.log('✅ Forking complete.');
} catch (error) {
  console.error('❌ Pipeline failed:', error);
}
```

To run this, first create a `source.log` file, then execute: `node examples/simple-fork-example.js`.

### 2. Fork, Transform, and Join

This example processes a stream of objects in parallel. One fork converts a message to uppercase, while the other adds a timestamp. The results are joined into a final stream.

```javascript
// examples/fork-and-join-example.js
import { join } from 'stream-fork-join';
import { Readable, Transform } from 'node:stream';

// 1. Source stream of objects
const source = Readable.from([
  { id: 1, msg: 'first message' },
  { id: 2, msg: 'second message' },
], { objectMode: true });

// 2. Parallel transform streams (forks)
const toUpper = new Transform({
  objectMode: true,
  transform(chunk, enc, cb) {
    chunk.msg = chunk.msg.toUpperCase();
    chunk.transformedBy = 'toUpper';
    cb(null, chunk);
  },
});

const addTimestamp = new Transform({
  objectMode: true,
  transform(chunk, enc, cb) {
    chunk.processedAt = new Date().toISOString();
    chunk.transformedBy = 'addTimestamp';
    cb(null, chunk);
  },
});

// 3. Create the join pipeline
const finalStream = join(source, [toUpper, addTimestamp]);

// 4. Consume the results
console.log('--- Joined Results ---');
for await (const data of finalStream) {
  console.log(data);
}
console.log('✅ Join complete.');
```

**Expected Output:** (Order of objects is non-deterministic)

```
--- Joined Results ---
{ id: 1, msg: 'FIRST MESSAGE', transformedBy: 'toUpper' }
{ id: 1, msg: 'first message', processedAt: '...', transformedBy: 'addTimestamp' }
{ id: 2, msg: 'SECOND MESSAGE', transformedBy: 'toUpper' }
{ id: 2, msg: 'second message', processedAt: '...', transformedBy: 'addTimestamp' }
✅ Join complete.
```

## License

[MIT](LICENSE)