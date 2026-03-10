/**
 * @file examples/basic-usage.js
 * @description A basic example demonstrating how to set up and run the cron scheduler.
 *
 * This script shows the fundamental steps to get the scheduler running:
 * 1. Import the `createScheduler` factory function.
 * 2. Define an asynchronous task function for a job.
 * 3. Create a scheduler instance, providing a path for the state file and defining one or more jobs.
 * 4. Start the scheduler to begin processing jobs.
 * 5. Set up a graceful shutdown mechanism to stop the scheduler when the process exits.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScheduler } from '../src/index.js';

// Helper to get the directory name in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define an asynchronous task. This could be anything from fetching data from an
// API, sending emails, or performing database maintenance.
async function myRecurringTask() {
  console.log(`[${new Date().toISOString()}] Job 'fetch-data' is running...`);
  try {
    // Simulate an I/O-bound operation, like a network request.
    // Using the modern fetch API available in Node.js 20.
    const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`[${new Date().toISOString()}] Job 'fetch-data' completed successfully. Fetched data for user: ${data.userId}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Job 'fetch-data' failed:`, error.message);
  }
}

// The main function to set up and run the scheduler.
async function main() {
  console.log('Initializing the cron scheduler...');

  // Use a file in the same directory as this script for storing state.
  const storagePath = path.resolve(__dirname, 'scheduler-state.json');

  // Create a scheduler instance.
  const scheduler = createScheduler({
    // The `storagePath` is mandatory. It's where the scheduler persists job
    // states, allowing it to recover after a restart.
    storagePath,

    // Define an array of jobs to be scheduled.
    jobs: [
      {
        // It's a best practice to provide a stable, unique ID for each job.
        // This helps the scheduler correctly identify the job across restarts.
        id: 'fetch-data',

        // This job will run every 10 seconds.
        // The cron syntax is: second(opt) minute hour day(month) month day(week)
        // Note: This library uses a standard 5-field cron syntax. Seconds are not supported by default.
        // To run every 10 seconds for this example, we'll use a non-standard but common syntax.
        // Let's stick to a standard cron pattern for clarity: every minute.
        cronTime: '*/1 * * * *', // Runs at the start of every minute.

        // The `task` is the async function to execute.
        task: myRecurringTask,
      },
    ],

    // Optional: How to handle jobs that were missed while the app was down.
    // 'skip' (default): Ignores missed runs and schedules the next one from now.
    // 'run': Tries to execute all missed runs, which can cause a burst of activity on startup.
    catchupPolicy: 'skip',
  });

  // --- Event Listeners (Optional) ---
  // You can listen to events to monitor the scheduler's activity.
  scheduler.on('start', () => console.log('Scheduler started. Waiting for jobs to run...'));
  scheduler.on('stop', () => console.log('Scheduler stopped.'));
  scheduler.on('job:run', (job) => console.log(`Job '${job.id}' is about to run.`));
  scheduler.on('job:success', (job) => console.log(`Job '${job.id}' finished successfully.`));
  scheduler.on('job:failure', (err, job) => console.error(`Job '${job.id}' failed with error:`, err));
  scheduler.on('error', (error) => console.error('A scheduler-level error occurred:', error));


  // --- Graceful Shutdown ---
  // It's crucial to stop the scheduler gracefully to ensure the final state is saved.
  const shutdown = async () => {
    console.log('\nGracefully shutting down. Stopping scheduler...');
    try {
      await scheduler.stop();
      console.log('Scheduler has been stopped. State saved.');
      process.exit(0);
    } catch (error) {
      console.error('Error during scheduler shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);  // Catches Ctrl+C
  process.on('SIGTERM', shutdown); // Catches kill signals

  try {
    // Start the scheduler. It will load state and begin its event loop.
    await scheduler.start();
    console.log(`Scheduler is running. State file is at: ${storagePath}`);
    console.log('Press Ctrl+C to exit.');

    // The application will now run indefinitely, with the scheduler
    // executing jobs in the background. We add a long timeout here
    // to keep the example script alive. In a real server application,
    // this would be where your server (e.g., Express, Fastify) starts listening.
    // setTimeout(() => {}, 2147483647); // Keep process alive

  } catch (error) {
    console.error('Failed to start the scheduler:', error);
    process.exit(1);
  }
}

// Run the main function.
main();