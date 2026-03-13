/**
 * @file examples/basic-usage.js
 * @description Demonstrates how to use the process-health-checker library programmatically.
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

// Import the main function and utilities from the library.
// In a real project, you would use: import { checkProcessHealth, utils } from 'process-health-checker';
import { checkProcessHealth, utils } from '../src/index.js';

// Get the PID of the current running Node.js process.
const currentPid = process.pid;

/**
 * A simple function to simulate some work by keeping the event loop busy.
 * This will cause CPU usage to increase, which can be observed in the health check.
 */
function performIntensiveTask() {
  console.log('\nSimulating a CPU-intensive task for 1 second...');
  const endTime = Date.now() + 1000; // Run for 1 second
  while (Date.now() < endTime) {
    // This busy-loop will consume CPU.
  }
  console.log('Task finished.');
}

/**
 * An asynchronous main function to demonstrate the library's usage.
 */
async function main() {
  console.log(`🚀 Starting basic usage example for Process Health Checker.`);
  console.log(`Monitoring current process with PID: ${currentPid}`);

  try {
    // --- First Check: Baseline ---
    console.log('\n--- Performing initial health check ---');
    let healthStatus = await checkProcessHealth(currentPid);

    // Use the exported utility functions to format the raw data.
    console.log(`Uptime: ${utils.formatUptime(healthStatus.uptime)}`);
    console.log(`RSS Memory: ${utils.formatMemory(healthStatus.memory.rss)}`);
    console.log(`Heap Used: ${utils.formatMemory(healthStatus.memory.heapUsed)}`);
    console.log(`CPU (User): ${healthStatus.cpu.user} µs`);

    // --- Second Check: After some work ---
    // Wait a moment and perform some work to see the metrics change.
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
    performIntensiveTask();
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait another 500ms

    console.log('\n--- Performing second health check after activity ---');
    healthStatus = await checkProcessHealth(currentPid);

    console.log(`Uptime: ${utils.formatUptime(healthStatus.uptime)}`);
    console.log(`RSS Memory: ${utils.formatMemory(healthStatus.memory.rss)}`);
    console.log(`Heap Used: ${utils.formatMemory(healthStatus.memory.heapUsed)}`);
    console.log(`CPU (User): ${healthStatus.cpu.user} µs (Note the increase!)`);

    // --- Error Handling Example ---
    console.log('\n--- Testing error handling with an invalid PID ---');
    const invalidPid = 999999;
    try {
      await checkProcessHealth(invalidPid);
    } catch (error) {
      // The library throws a descriptive error for invalid or non-existent PIDs.
      console.error(`Successfully caught expected error: ${error.message}`);
    }

  } catch (error) {
    // Handle any unexpected errors during the process monitoring.
    console.error(`\nAn unexpected error occurred: ${error.message}`);
    process.exit(1);
  }

  console.log('\n✅ Example finished successfully.');
}

// Run the main function.
main();