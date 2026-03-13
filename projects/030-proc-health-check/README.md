# Process Health Checker

![npm version](https://img.shields.io/npm/v/process-health-checker)![Node.js Version](https://img.shields.io/node/v/process-health-checker)![License](https://img.shields.io/npm/l/process-health-checker)

A lightweight, zero-dependency Node.js library to monitor the health of a running process by its PID. It checks CPU usage, memory consumption, and uptime, providing a simple status object. Ideal for basic self-monitoring in background services or for simple orchestration scripts.

## Features

-   **Monitor Process Health**: Get key metrics for any running Node.js process.
-   **Memory Tracking**: Track Resident Set Size (RSS) and V8 Heap usage.
-   **CPU Usage**: Report user and system CPU time.
-   **Process Uptime**: Calculate how long the process has been running.
-   **CLI Tool**: A simple command-line interface for quick checks.
-   **Programmatic API**: Easy to integrate into any Node.js application.
-   **Zero Dependencies**: The core library has no production dependencies, keeping it lean and secure.

**Note**: Due to the limitations of Node.js's core `process` module, detailed memory and CPU metrics can only be retrieved for the *current* Node.js process. The library will throw an error if you attempt to monitor an external PID.

## Installation

You can install the package via npm:

```bash
npm install process-health-checker
```

Alternatively, you can clone the repository and install dependencies for local development:

```bash
git clone https://github.com/your-username/process-health-checker.git
cd process-health-checker
npm install
```

## Usage

This library can be used in two ways: through its Command-Line Interface (CLI) or programmatically within your Node.js code.

### 1. CLI Usage

The CLI provides a quick way to check the health of the current Node.js process. First, find the Process ID (PID) of your running Node.js application. Then, use the `health-check` command.

```bash
# Get the PID of your running Node.js app
pgrep -f "node your-app.js"
# 12345

# Run the health check on that PID
npx health-check 12345
```

**Example Output:**

```
--- Process Health Report for PID: 12345 ---
  Uptime     : 00:01:30
  Memory Usage:
    RSS        : 55.43 MB
    Heap Total : 7.34 MB
    Heap Used  : 4.51 MB
  CPU Time:
    User       : 156250 µs
    System     : 62500 µs
------------------------------------------
```

### 2. Programmatic API

Integrate health monitoring directly into your application. This is perfect for creating a `/health` endpoint in a web server or for a service that self-reports its status.

```javascript
import { checkProcessHealth, utils } from 'process-health-checker';

const currentPid = process.pid;

async function logHealth() {
  try {
    const health = await checkProcessHealth(currentPid);

    console.log(`--- Process ${health.pid} Health ---`);
    console.log(`Uptime: ${utils.formatUptime(health.uptime)}`);
    console.log(`RSS Memory: ${utils.formatMemory(health.memory.rss)}`);
    console.log(`CPU User Time: ${health.cpu.user} µs`);
  } catch (error) {
    console.error(`Failed to get health status: ${error.message}`);
  }
}

// Log health every 10 seconds
setInterval(logHealth, 10000);
```

## API Reference

### `checkProcessHealth(pid)`

-   `pid` `<number> | <string>`: The Process ID of the Node.js process to monitor. **Must be the current process PID (`process.pid`)**.
-   Returns: `<Promise<object>>` A promise that resolves to a health status object.

The resolved object has the following structure:

```javascript
{
  pid: 12345,
  memory: {
    rss: 58122240,        // Resident Set Size in bytes
    heapTotal: 7696384,   // Total size of the V8 heap in bytes
    heapUsed: 4728920     // Used size of the V8 heap in bytes
  },
  cpu: {
    user: 156250,         // CPU time in user code (microseconds)
    system: 62500         // CPU time in system code (microseconds)
  },
  uptime: 90.123456       // Process uptime in seconds
}
```

### `utils`

A collection of helper functions for formatting raw data.

-   `utils.formatUptime(seconds)`: Converts seconds into an `HH:MM:SS` string.
-   `utils.formatMemory(bytes)`: Converts bytes into a human-readable string (e.g., `"55.43 MB"`).

## Examples

### Example 1: Basic Self-Monitoring

This example shows how to monitor the current process and log its health status.

```javascript
// examples/basic-usage.js
import { checkProcessHealth, utils } from 'process-health-checker';

const currentPid = process.pid;

async function main() {
  console.log(`Monitoring current process with PID: ${currentPid}`);

  try {
    const health = await checkProcessHealth(currentPid);
    console.log(`Uptime: ${utils.formatUptime(health.uptime)}`);
    console.log(`RSS Memory: ${utils.formatMemory(health.memory.rss)}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();
```

### Example 2: Self-Monitoring HTTP Server

This example creates a simple HTTP server with a `/health` endpoint that reports the server's own process health.

```javascript
// examples/self-monitoring-server.js
import http from 'node:http';
import { checkProcessHealth } from 'process-health-checker';

const server = http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    try {
      const healthStatus = await checkProcessHealth(process.pid);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', data: healthStatus }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: error.message }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Check health at http://localhost:3000/health');
});
```

To test it, run the server and then use `curl`:

```bash
curl http://localhost:3000/health
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.