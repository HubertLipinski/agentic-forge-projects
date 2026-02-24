/**
 * @file tests/aggregator.integration.test.js
 * @description Integration tests for the LogAggregator, simulating multiple sources
 * and verifying the aggregated output.
 *
 * These tests cover the end-to-end functionality of the LogAggregator, from
 * starting sources to receiving and processing log lines from files and TCP sockets,
 * and finally verifying the structured JSON output.
 */

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import { Writable } from 'node:stream';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import pino from 'pino';
import { LogAggregator } from '../src/aggregator.js';

// --- Test Setup ---

// A simple in-memory writable stream to capture aggregator output.
class MemoryStream extends Writable {
  constructor(options) {
    super(options);
    this.chunks = [];
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    callback();
  }

  getOutput() {
    return Buffer.concat(this.chunks).toString('utf8');
  }

  getParsedLines() {
    const output = this.getOutput();
    if (!output) return [];
    return output.trim().split('\n').map(line => JSON.parse(line));
  }

  clear() {
    this.chunks = [];
  }
}

// A helper function to find an available TCP port.
const findFreePort = () => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
};

// A helper to introduce a small delay, useful for letting I/O operations complete.
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Test Suite ---

describe('LogAggregator Integration Tests', () => {
  let tempDir;
  let logFile1, logFile2;
  let tcpPort;
  let aggregator;
  let memoryStream;
  let logger;

  // `before` hook to set up the test environment.
  before(async () => {
    // Use a mock logger to suppress output during tests.
    logger = pino({ level: 'silent' });

    // Create a temporary directory for log files.
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-agg-test-'));

    // Define paths for temporary log files.
    logFile1 = path.join(tempDir, 'app1.log');
    logFile2 = path.join(tempDir, 'app2.log');

    // Find an available TCP port for the TCP source.
    tcpPort = await findFreePort();

    // Create an in-memory stream to capture the aggregator's output.
    memoryStream = new MemoryStream();
  });

  // `after` hook to clean up the test environment.
  after(async () => {
    // Ensure the aggregator is stopped.
    if (aggregator && aggregator._state !== 'stopped') {
      await aggregator.stop();
    }
    // Remove the temporary directory and its contents.
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should initialize, start, and stop cleanly with multiple sources', async () => {
    aggregator = new LogAggregator({
      files: [logFile1, logFile2],
      tcpPorts: [tcpPort],
      stdin: false,
      logger,
      outputStream: memoryStream,
    });

    assert.strictEqual(aggregator._state, 'idle', 'Aggregator should be in idle state initially');

    await aggregator.start();
    assert.strictEqual(aggregator._state, 'running', 'Aggregator should be in running state after start');

    await aggregator.stop();
    assert.strictEqual(aggregator._state, 'stopped', 'Aggregator should be in stopped state after stop');
  });

  it('should aggregate logs from a file and a TCP socket concurrently', async () => {
    memoryStream.clear();

    aggregator = new LogAggregator({
      files: [logFile1],
      tcpPorts: [tcpPort],
      logger,
      outputStream: memoryStream,
    });

    await aggregator.start();

    // --- Act ---
    // 1. Write a log to the file.
    await fs.writeFile(logFile1, 'file log 1\n');

    // 2. Send a log via TCP.
    const client = net.createConnection({ port: tcpPort }, async () => {
      client.write('tcp log 1\n');
      client.end();
    });

    // Wait for file watcher and network I/O to process.
    // Chokidar's `awaitWriteFinish` can take a moment.
    await delay(2500);

    // --- Assert ---
    const logs = memoryStream.getParsedLines();
    assert.strictEqual(logs.length, 2, 'Should have received two log entries');

    const fileLog = logs.find(log => log.source === logFile1);
    const tcpLog = logs.find(log => log.source === `tcp:${tcpPort}`);

    assert.ok(fileLog, 'File log should be present in the output');
    assert.strictEqual(fileLog.message, 'file log 1', 'File log message should be correct');

    assert.ok(tcpLog, 'TCP log should be present in the output');
    assert.strictEqual(tcpLog.message, 'tcp log 1', 'TCP log message should be correct');

    await aggregator.stop();
  });

  it('should handle multiple writes to multiple files and TCP connections', async () => {
    memoryStream.clear();

    aggregator = new LogAggregator({
      files: [logFile1, logFile2],
      tcpPorts: [tcpPort],
      logger,
      outputStream: memoryStream,
    });

    await aggregator.start();

    // --- Act ---
    // Write to files
    await fs.writeFile(logFile1, 'log from file 1\n');
    await fs.writeFile(logFile2, 'log from file 2\n');

    // Send via TCP
    const client = net.createConnection({ port: tcpPort }, () => {
      client.write('first tcp message\n');
      client.write('{"json": true, "value": 42}\n');
      client.end();
    });

    await delay(2500); // Wait for processing

    // Append to file 1
    await fs.appendFile(logFile1, 'another log from file 1\n');

    await delay(2500); // Wait for processing

    // --- Assert ---
    const logs = memoryStream.getParsedLines();
    assert.strictEqual(logs.length, 5, 'Should have aggregated 5 log entries in total');

    const file1Logs = logs.filter(log => log.source === logFile1);
    const file2Logs = logs.filter(log => log.source === logFile2);
    const tcpLogs = logs.filter(log => log.source === `tcp:${tcpPort}`);

    assert.strictEqual(file1Logs.length, 2, 'Should have 2 logs from file1');
    assert.strictEqual(file2Logs.length, 1, 'Should have 1 log from file2');
    assert.strictEqual(tcpLogs.length, 2, 'Should have 2 logs from TCP');

    assert.strictEqual(file1Logs[0].message, 'log from file 1');
    assert.strictEqual(file1Logs[1].message, 'another log from file 1');
    assert.strictEqual(file2Logs[0].message, 'log from file 2');
    assert.strictEqual(tcpLogs[0].message, 'first tcp message');

    const jsonLog = tcpLogs.find(log => log.json === true);
    assert.ok(jsonLog, 'JSON log from TCP should be present');
    assert.strictEqual(jsonLog.value, 42, 'Parsed JSON log should have correct value');

    await aggregator.stop();
  });

  it('should handle file truncation and continue logging', async () => {
    memoryStream.clear();

    aggregator = new LogAggregator({
      files: [logFile1],
      logger,
      outputStream: memoryStream,
    });

    await aggregator.start();

    // --- Act ---
    // 1. Initial write
    await fs.writeFile(logFile1, 'line 1\nline 2\n');
    await delay(2500);

    // 2. Truncate and write new content
    await fs.writeFile(logFile1, 'new line after truncate\n');
    await delay(2500);

    // --- Assert ---
    const logs = memoryStream.getParsedLines();
    assert.strictEqual(logs.length, 3, 'Should have 3 logs in total (2 before, 1 after truncate)');

    assert.strictEqual(logs[0].message, 'line 1');
    assert.strictEqual(logs[1].message, 'line 2');
    assert.strictEqual(logs[2].message, 'new line after truncate');
    assert.strictEqual(logs[2].source, logFile1);

    await aggregator.stop();
  });

  it('should handle a source file that is created after the aggregator starts', async () => {
    memoryStream.clear();
    const newFilePath = path.join(tempDir, 'new-file.log');

    aggregator = new LogAggregator({
      files: [newFilePath],
      logger,
      outputStream: memoryStream,
    });

    await aggregator.start();

    // File does not exist yet, so no logs
    assert.strictEqual(memoryStream.getParsedLines().length, 0);

    // --- Act ---
    // Create the file and write to it
    await fs.writeFile(newFilePath, 'hello from a new file\n');
    await delay(2500);

    // --- Assert ---
    const logs = memoryStream.getParsedLines();
    assert.strictEqual(logs.length, 1, 'Should have received one log entry');
    assert.strictEqual(logs[0].message, 'hello from a new file');
    assert.strictEqual(logs[0].source, newFilePath);

    await aggregator.stop();
  });
});