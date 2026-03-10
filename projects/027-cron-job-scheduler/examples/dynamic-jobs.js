/**
 * @file examples/dynamic-jobs.js
 * @description An example demonstrating how to dynamically add and remove jobs at runtime.
 *
 * This script showcases the dynamic capabilities of the scheduler. It starts with
 * an initial job, then uses `setTimeout` to simulate events that trigger the
 * addition of a new job and the removal of an existing one. This pattern is useful
 * in applications where tasks need to be scheduled or unscheduled based on user
 * actions, system events, or other runtime conditions.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScheduler } from '../src/index.js';

// Helper to get the directory name in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Task Definitions ---
// A simple task for our initial, long-running job.
async function initialTask() {
  console.log(`[${new Date().toISOString()}] Job 'initial-job' is running. This job will be removed soon.`);
}

// A task for the job we will add dynamically.
async function dynamicTask() {
  console.log(`[${new Date().toISOString()}] ---> Dynamically added job 'dynamic-job' is running!`);
}

// The main function to set up and run the scheduler.
async function main() {
  console.log('Initializing the cron scheduler for dynamic job demonstration...');

  const storagePath = path.resolve(__dirname, 'dynamic-scheduler-state.json');

  // Create a scheduler instance, starting with one job.
  const scheduler = createScheduler({
    storagePath,
    jobs: [
      {
        id: 'initial-job',
        cronTime: '*/5 * * * * *', // A non-standard but common cron pattern for every 5 seconds.
        task: initialTask,
      },
    ],
    // Use a short tick interval for responsive demonstration.
    tickInterval: 1000,
  });

  // --- Event Listeners for Monitoring ---
  scheduler.on('start', () => console.log('Scheduler started.'));
  scheduler.on('stop', () => console.log('Scheduler stopped.'));
  scheduler.on('job:add', (job) => console.log(`EVENT: Job '${job.id}' was added.`));
  scheduler.on('job:remove', (job) => console.log(`EVENT: Job '${job.id}' was removed.`));
  scheduler.on('error', (error) => console.error('A scheduler-level error occurred:', error));

  // --- Graceful Shutdown Logic ---
  const shutdown = async () => {
    console.log('\nGracefully shutting down. Stopping scheduler...');
    try {
      // Clear any pending timeouts to prevent them from running during shutdown.
      clearTimeout(addJobTimeout);
      clearTimeout(removeJobTimeout);
      clearTimeout(stopSchedulerTimeout);

      await scheduler.stop();
      console.log('Scheduler has been stopped. Final state saved.');
      process.exit(0);
    } catch (error) {
      console.error('Error during scheduler shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // --- Main Execution Logic ---
  try {
    // Start the scheduler.
    await scheduler.start();
    console.log(`Scheduler is running. State file is at: ${storagePath}`);
    console.log('Current jobs:', scheduler.listJobs().map(j => j.id));

    // --- Simulate Dynamic Operations ---

    // 1. After 12 seconds, add a new job.
    const addJobTimeout = setTimeout(async () => {
      console.log('\n>>> Adding a new job dynamically...');
      try {
        const newJob = await scheduler.addJob({
          id: 'dynamic-job',
          cronTime: '*/3 * * * * *', // Every 3 seconds
          task: dynamicTask,
        });
        console.log(`Successfully added job '${newJob.id}' with schedule '${newJob.cronTime}'.`);
        console.log('Current jobs:', scheduler.listJobs().map(j => j.id));
      } catch (error) {
        console.error('Failed to add job:', error);
      }
    }, 12000);

    // 2. After 25 seconds, remove the initial job.
    const removeJobTimeout = setTimeout(async () => {
      console.log("\n>>> Removing the 'initial-job'...");
      try {
        const wasRemoved = await scheduler.removeJob('initial-job');
        if (wasRemoved) {
          console.log("Successfully removed 'initial-job'.");
        } else {
          console.log("'initial-job' was not found for removal (perhaps already removed).");
        }
        console.log('Current jobs:', scheduler.listJobs().map(j => j.id));
      } catch (error) {
        console.error('Failed to remove job:', error);
      }
    }, 25000);

    // 3. After 40 seconds, stop the scheduler gracefully.
    const stopSchedulerTimeout = setTimeout(() => {
      console.log('\n>>> Example finished. Initiating shutdown.');
      shutdown();
    }, 40000);

    console.log('\nThis example will run for 40 seconds to demonstrate dynamic job management.');
    console.log('Press Ctrl+C to exit early.');

  } catch (error) {
    console.error('Failed to start the scheduler:', error);
    process.exit(1);
  }
}

// Run the main function.
main();