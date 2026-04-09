/**
 * Mem-Leak Sentinel: Express.js Integration Example
 *
 * This script demonstrates how to integrate the Mem-Leak Sentinel into a
 * long-running Express.js web server to monitor for potential memory leaks
 * during its operation.
 *
 * The server has two endpoints:
 * 1. `/`: A simple health check endpoint.
 * 2. `/leak`: An endpoint that intentionally allocates memory that is never
 *    released, simulating a memory leak.
 *
 * The Sentinel is configured to monitor heap usage and will log a detailed
 * alert to the console if it detects a consistent increase in memory, which
 * would be triggered by repeatedly calling the `/leak` endpoint.
 *
 * To run this example:
 * 1. Install Express: `npm install express` (it's a dev dependency for this example)
 * 2. Run the server: `node examples/express-server.js`
 * 3. In another terminal, repeatedly hit the leak endpoint: `curl http://localhost:3000/leak`
 *    After a few requests, you should see the leak alert in the server's console.
 */

import express from 'express';
import { Sentinel } from '../src/index.js';

// --- Helper Function ---

// A simple function to format bytes into a more human-readable string (KB, MB, GB).
const formatBytes = (bytes, decimals = 2) => {
  if (!Number.isFinite(bytes) || bytes < 0) return 'N/A';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// --- Sentinel Setup ---

// This array will be used to simulate a memory leak.
const leakyDataStore = [];

// Configure the Sentinel. For a real production server, you might use a longer
// sampleInterval (e.g., 60000ms) and a higher alertThreshold (e.g., 5-10).
const sentinel = new Sentinel({
  sampleInterval: 5000, // Check memory every 5 seconds
  alertThreshold: 4,    // Alert after 4 consecutive increases
});

// Set up event listeners for the Sentinel.
sentinel.on('start', () => {
  console.log('✅ Mem-Leak Sentinel started. Monitoring server memory...');
});

sentinel.on('stop', () => {
  console.log('🛑 Mem-Leak Sentinel stopped.');
});

sentinel.on('leak', (details) => {
  // In a production environment, this is where you would integrate with your
  // alerting system (e.g., PagerDuty, Slack, DataDog) or trigger a graceful
  // shutdown and restart of the process.
  console.error('\n====================================================');
  console.error('🚨 POTENTIAL MEMORY LEAK DETECTED IN SERVER! 🚨');
  console.error('====================================================');
  console.error(`Message: ${details.message}`);
  console.error(`Timestamp: ${details.timestamp}`);
  console.error(`Current Heap Size: ${formatBytes(details.heapUsed)}`);
  console.error(`Heap Size History: ${details.history.map(formatBytes).join(' -> ')}`);
  console.error('---');
  console.error('This alert was triggered because the heap size has increased');
  console.error(`consistently over ${details.alertThreshold} samples (sampled every ${details.sampleInterval}ms).`);
  console.error('Consider investigating the application for memory leaks.');
  console.error('====================================================\n');

  // For this example, we'll just log the alert. In a real app, you might
  // trigger a heapdump or a graceful shutdown.
});

// --- Express Server Setup ---

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to log each request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// A standard, non-leaky route for health checks.
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running.',
    memory: formatBytes(process.memoryUsage().heapUsed),
  });
});

// A route designed to simulate a memory leak.
// Each request to this endpoint allocates a large object and stores it in an
// array that is never cleared, causing the process memory to grow over time.
app.get('/leak', (req, res) => {
  try {
    const largeObject = {
      id: leakyDataStore.length + 1,
      data: 'x'.repeat(10 * 1024 * 1024), // Allocate a 10MB string
      createdAt: new Date().toISOString(),
    };
    leakyDataStore.push(largeObject);

    const currentHeap = process.memoryUsage().heapUsed;
    res.status(200).json({
      status: 'leak_simulated',
      items_in_store: leakyDataStore.length,
      current_heap_size: formatBytes(currentHeap),
    });
  } catch (error) {
    console.error('Error simulating leak:', error);
    res.status(500).json({ error: 'Failed to simulate leak.' });
  }
});

// --- Application Start and Shutdown ---

let server;

const startServer = async () => {
  try {
    server = app.listen(PORT, () => {
      console.log(`🚀 Express server listening on http://localhost:${PORT}`);
      console.log('Endpoints:');
      console.log('  - GET /          (Health check)');
      console.log('  - GET /leak      (Simulates a memory leak)');
      console.log('\nTo test, run `curl http://localhost:3000/leak` multiple times.');

      // Start the memory sentinel after the server is successfully running.
      sentinel.start();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  // Stop the sentinel from taking new samples.
  if (sentinel.isRunning()) {
    sentinel.stop();
  }

  // Close the server.
  server.close(() => {
    console.log('✅ HTTP server closed.');
    process.exit(0);
  });

  // Force shutdown if server doesn't close in time.
  setTimeout(() => {
    console.error('Could not close connections in time, forcing shutdown.');
    process.exit(1);
  }, 10000).unref();
};

// Listen for termination signals to gracefully shut down.
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the application.
startServer();