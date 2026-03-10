# in-process-cron

A lightweight, in-process, persistent cron job scheduler for Node.js applications. It allows developers to define recurring tasks using cron syntax directly within their code, with state persisted to a JSON file to survive application restarts. Ideal for background tasks, data fetching, and maintenance routines in long-running services without external dependencies like a system cron or a separate database.

## Features

-   **Standard Cron Syntax**: Schedule jobs using familiar cron patterns (e.g., `'*/5 * * * *'`).
-   **Persistent State**: Job schedules and their next run times are saved to a JSON file, ensuring tasks resume correctly after an application restart.
-   **Graceful Recovery**: Configurable policy (`'run'` or `'skip'`) for handling jobs missed due to server downtime.
-   **Process Safe**: Uses file locking (`proper-lockfile`) to prevent race conditions when multiple processes might access the state file.
-   **Dynamic API**: Add, remove, and list jobs at runtime while your application is running.
-   **Async-First**: Jobs are asynchronous functions (`async/await`), perfect for I/O-bound tasks like API calls or database operations.
-   **Stable Job IDs**: Each job is assigned a unique, stable ID for reliable management and state reconciliation.
-   **Zero Dependencies**: No external services required. It runs entirely within your Node.js process.

## Installation

Install the package using npm:

```bash
npm install in-process-cron
```

## Usage

The primary entry point is the `createScheduler` factory function. You create a scheduler, define your jobs, and then start it.

### 1. Import and Create a Scheduler

Import `createScheduler` and define the path for the state file. It's best practice to use an absolute path.

```javascript
import { createScheduler } from 'in-process-cron';
import path from 'node:path';

const scheduler = createScheduler({
  storagePath: path.resolve('./scheduler-state.json'),
  // ... other options
});
```

### 2. Define Jobs

Jobs are defined as an array of objects, each with a `cronTime` and an `async task` function. Providing a stable `id` is highly recommended for reliable persistence.

```javascript
const scheduler = createScheduler({
  storagePath: path.resolve('./scheduler-state.json'),
  jobs: [
    {
      id: 'fetch-daily-report',
      cronTime: '0 5 * * *', // Every day at 5:00 AM
      async task() {
        console.log('Fetching the daily report...');
        // Your async logic here
        await fetch('https://api.example.com/reports');
        console.log('Daily report fetched successfully.');
      }
    }
  ]
});
```

### 3. Start and Stop the Scheduler

The scheduler must be started to begin processing jobs. It's crucial to stop it gracefully to save the final state.

```javascript
async function main() {
  // Start the scheduler
  await scheduler.start();
  console.log('Scheduler is running.');

  // Set up graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await scheduler.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);  // Catches Ctrl+C
  process.on('SIGTERM', shutdown); // Catches kill signals
}

main();
```

### API Reference

#### `createScheduler(options)`

-   `options` `<Object>`
    -   `storagePath` `<string>` **Required**. The file path for the persistent state JSON file.
    -   `jobs` `<Array<JobDefinition>>` An array of jobs to initialize the scheduler with.
        -   `id` `<string>` A stable, unique ID. Recommended.
        -   `cronTime` `<string>` The cron schedule pattern.
        -   `task` `<Function>` The `async` function to execute.
    -   `tickInterval` `<number>` Default: `1000`. The interval in milliseconds to check for due jobs.
    -   `catchupPolicy` `<string>` Default: `'skip'`. Policy for missed jobs.
        -   `'skip'`: Ignores missed runs and schedules the next run from the current time.
        -   `'run'`: Executes all missed runs sequentially.

#### Scheduler Instance Methods

-   `scheduler.start()`: `<Promise<void>>` Loads state and starts the scheduler's tick loop.
-   `scheduler.stop()`: `<Promise<void>>` Stops the tick loop and persists the final state of all jobs.
-   `scheduler.addJob(jobDefinition)`: `<Promise<Job>>` Dynamically adds a new job.
-   `scheduler.removeJob(jobId)`: `<Promise<boolean>>` Removes a job by its ID.
-   `scheduler.listJobs()`: `<Array<Job>>` Returns an array of all current `Job` instances.

#### Scheduler Events

-   `'start'`: Emitted when the scheduler starts.
-   `'stop'`: Emitted when the scheduler stops.
-   `'job:add' (job)`: Emitted when a job is added dynamically.
-   `'job:remove' (job)`: Emitted when a job is removed.
-   `'job:run' (job)`: Emitted just before a job's task is executed.
-   `'job:success' (job)`: Emitted after a job's task completes successfully.
-   `'job:failure' (error, job)`: Emitted if a job's task throws an error.
-   `'error' (error)`: Emitted for scheduler-level errors (e.g., state persistence failure).

## Examples

### Basic Usage

This example sets up a scheduler with a single job that runs every minute.

`examples/basic-usage.js`:
```javascript
import path from 'node:path';
import { createScheduler } from 'in-process-cron';

// Define an async task
async function myRecurringTask() {
  console.log(`[${new Date().toISOString()}] Job is running...`);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate async work
  console.log(`[${new Date().toISOString()}] Job finished.`);
}

// Create and configure the scheduler
const scheduler = createScheduler({
  storagePath: path.resolve('./scheduler-state.json'),
  jobs: [
    {
      id: 'my-first-job',
      cronTime: '* * * * *', // Every minute
      task: myRecurringTask,
    },
  ],
});

// Graceful shutdown handler
const shutdown = async () => {
  await scheduler.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the scheduler
await scheduler.start();
console.log('Scheduler started. Press Ctrl+C to exit.');
```

### Dynamic Job Management

This example shows how to add and remove jobs while the application is running.

`examples/dynamic-jobs.js`:
```javascript
import path from 'node:path';
import { createScheduler } from 'in-process-cron';

const scheduler = createScheduler({
  storagePath: path.resolve('./dynamic-jobs-state.json'),
});

async function main() {
  await scheduler.start();
  console.log('Scheduler started.');

  // Add a new job dynamically
  console.log('Adding a new job to run every 5 seconds...');
  const newJob = await scheduler.addJob({
    cronTime: '*/5 * * * * *', // Non-standard 6-field cron for every 5 seconds
    async task() {
      console.log(`Dynamically added job is running at ${new Date().toLocaleTimeString()}`);
    },
  });
  console.log(`Job '${newJob.id}' added.`);

  // List all current jobs
  console.log('Current jobs:', scheduler.listJobs().map(j => j.id));

  // After 12 seconds, remove the job
  setTimeout(async () => {
    console.log(`\nRemoving job '${newJob.id}'...`);
    const wasRemoved = await scheduler.removeJob(newJob.id);
    if (wasRemoved) {
      console.log('Job removed successfully.');
      console.log('Current jobs:', scheduler.listJobs().map(j => j.id));
    }
    await scheduler.stop();
    console.log('Scheduler stopped.');
    process.exit(0);
  }, 12000);
}

main();
```

## License

[MIT](LICENSE)