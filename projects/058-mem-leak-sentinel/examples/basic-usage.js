/**
 * Mem-Leak Sentinel: Basic Usage Example
 *
 * This script demonstrates the basic functionality of the Mem-Leak Sentinel.
 * It sets up a Sentinel instance to monitor memory usage and then intentionally
 * creates a memory leak by pushing data into an array without ever clearing it.
 *
 * The Sentinel is configured to sample memory every 2 seconds and to trigger an
 * alert after 4 consecutive increases in heap size. When a leak is detected,
 * a detailed message is printed to the console, and the process exits.
 *
 * To run this example:
 * `node examples/basic-usage.js`
 */

import { Sentinel } from '../src/index.js';

// A simple function to format bytes into a more human-readable string (KB, MB, GB).
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// This array will be used to simulate a memory leak.
const leakyArray = [];

// --- Sentinel Configuration ---
// We'll use a short sample interval for this demonstration.
// In a real application, a longer interval (e.g., 30-60 seconds) is often more appropriate.
const sentinel = new Sentinel({
  sampleInterval: 2000, // Check memory every 2 seconds
  alertThreshold: 4,    // Alert after 4 consecutive increases
});

// --- Event Handling ---
// Listen for the 'leak' event. This is the primary way to get notified.
sentinel.on('leak', (details) => {
  console.error('\n🚨 POTENTIAL MEMORY LEAK DETECTED! 🚨\n');
  console.error('The application\'s heap memory has been growing consistently.');
  console.error('----------------------------------------------------');
  console.error(`- Current Heap Size: ${formatBytes(details.heapUsed)}`);
  console.error(`- Consecutive Increases: ${details.consecutiveIncreases} samples`);
  console.error(`- Sample Interval: ${details.sampleInterval}ms`);
  console.error(`- Alert Threshold: ${details.alertThreshold} samples`);
  console.error(`- Timestamp: ${details.timestamp}`);
  console.error('\n- Heap Size History (last few samples):');
  details.history.forEach((size, index) => {
    console.error(`  - Sample ${index + 1}: ${formatBytes(size)}`);
  });
  console.error('----------------------------------------------------\n');
  console.error('Exiting application to prevent further issues.');

  // In a real-world scenario, you might:
  // - Send an alert to a monitoring service (DataDog, Prometheus, etc.).
  // - Gracefully shut down the process.
  // - Trigger a heap dump for later analysis.

  // For this example, we stop the sentinel and exit the process.
  sentinel.stop();
  process.exit(1);
});

sentinel.on('start', () => {
  console.log('✅ Mem-Leak Sentinel started. Monitoring for memory leaks...');
});

sentinel.on('stop', () => {
  console.log('🛑 Mem-Leak Sentinel stopped.');
});

// --- Main Application Logic ---
const main = async () => {
  console.log('Starting basic usage example...');
  console.log(`Sentinel will alert after ${sentinel.alertThreshold} consecutive memory increases.`);

  // Start the sentinel's monitoring.
  sentinel.start();

  console.log('\nSimulating a memory leak by pushing data into an array every second...');
  console.log('Watch the console for the leak detection alert.');

  // This interval function simulates a memory leak by continuously adding data.
  // The data is a large string to ensure a noticeable increase in heap usage.
  const leakInterval = setInterval(() => {
    try {
      // Each push adds about 1MB of data to the heap.
      const largeObject = {
        data: 'x'.repeat(1024 * 1024), // 1MB string
        timestamp: Date.now(),
      };
      leakyArray.push(largeObject);
      console.log(`Simulating work... Leaky array now contains ${leakyArray.length} items.`);
    } catch (error) {
      console.error('Error during leak simulation:', error);
      clearInterval(leakInterval);
      sentinel.stop();
      process.exit(1);
    }
  }, 1000); // Add data faster than the sentinel samples to ensure growth.

  // Keep the script running. The sentinel's 'leak' event handler will exit the process.
  // We'll add a safety timeout to exit gracefully if the leak isn't detected within a certain time.
  setTimeout(() => {
    console.log('\nExample finished without detecting a leak within the time limit. This is unexpected.');
    console.log('Something might be wrong with the simulation or the sentinel.');
    clearInterval(leakInterval);
    sentinel.stop();
    process.exit(0);
  }, 30000); // 30-second safety timeout.
};

// Run the main function.
main().catch(err => {
  console.error('An unexpected error occurred in the main function:', err);
  process.exit(1);
});