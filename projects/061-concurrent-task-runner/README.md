# Concurrent Task Runner

A dependency-aware task runner for Node.js that executes tasks in parallel based on a directed acyclic graph (DAG).

## Description

This project provides a powerful, dependency-aware task runner for Node.js. It's designed to optimize build scripts, data processing pipelines, or any multi-step workflow by maximizing concurrency while respecting task dependencies.

By defining your tasks and their relationships in a simple JavaScript object, the runner automatically determines the optimal execution order, runs independent tasks in parallel, and ensures that no task runs before its dependencies are met. It's ideal for orchestrating complex builds in a monorepo or managing intricate ETL jobs defined in code.

## Features

-   **Dependency-Aware Execution**: Defines tasks and dependencies as a Directed Acyclic Graph (DAG).
-   **Maximized Parallelism**: Automatically determines execution order via topological sort and runs independent tasks concurrently.
-   **Configurable Concurrency**: Limits the number of parallel tasks to prevent resource exhaustion.
-   **Cycle Detection**: Automatically detects and reports cycles in the dependency graph with clear error messages.
-   **Async Task Support**: Natively handles asynchronous, Promise-based tasks.
-   **Schema Validation**: Validates task graph definitions against a JSON Schema to catch errors early.
-   **Verbose Logging**: Provides structured, event-based logging for task lifecycle events (start, success, fail, skip).
-   **CLI & Programmatic API**: Use it from the command line or as a library in your own scripts.

## Installation

You can use the project by cloning the repository and installing its dependencies.

```bash
git clone https://github.com/your-username/concurrent-task-runner.git
cd concurrent-task-runner
npm install
```

To make the CLI available globally or in other projects, you can use `npm link`:

```bash
npm link
```

## Usage

You can use the Concurrent Task Runner either through its Command-Line Interface (CLI) or programmatically within your own Node.js scripts.

### Defining a Task Graph

First, create a task definition file (e.g., `tasks.js`). This file should have a default export of an object that defines your tasks.

Each task is an object with a `run` function and an optional `dependencies` array.

**`tasks.js`**
```javascript
const simulateWork = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default {
  tasks: {
    'install-deps': {
      run: async () => {
        console.log('Installing dependencies...');
        await simulateWork(1000);
      },
    },
    'build-api': {
      run: async () => {
        console.log('Building API...');
        await simulateWork(1500);
      },
      dependencies: ['install-deps'],
    },
    'build-ui': {
      run: async () => {
        console.log('Building UI...');
        await simulateWork(2000);
      },
      dependencies: ['install-deps'],
    },
    'deploy': {
      run: async () => {
        console.log('Deploying...');
        await simulateWork(500);
      },
      dependencies: ['build-api', 'build-ui'],
    },
  },
};
```

### CLI Usage

The `run-tasks` command executes a task graph from a specified file.

```bash
run-tasks <file> [options]
```

**Arguments:**
- `<file>`: Path to the task definition file.

**Options:**
- `-c, --concurrency <number>`: Set the maximum number of parallel tasks (default: number of CPU cores).
- `--no-bail`: Continue running other tasks even if one fails.
- `-v, --verbose`: Enable detailed verbose logging.
- `-h, --help`: Show the help message.

**Example Command:**

```bash
run-tasks ./tasks.js --concurrency 4
```

### Programmatic API

You can also import and use the runner directly in your code. This is useful for integrating into larger applications or for more complex scripting scenarios.

**`run.js`**
```javascript
import { run } from 'concurrent-task-runner'; // Assuming it's in node_modules
import myTaskGraph from './tasks.js';
import logger, { LogEvents } from 'concurrent-task-runner/src/utils/logger';

// Optional: Set up a custom console logger for rich output
logger.on(LogEvents.TASK_SUCCESS, ({ taskId, durationMs }) => {
  console.log(`✅ ${taskId} finished in ${durationMs}ms`);
});
// ... add listeners for other events ...

async function main() {
  try {
    const { success, summary } = await run(myTaskGraph, {
      concurrency: 4,
      bail: true, // Stop on first failure
    });

    console.log('--- Execution Summary ---');
    console.log(`Result: ${success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`Succeeded: ${summary.succeededTasks}`);
    console.log(`Failed: ${summary.failedTasks}`);
    console.log(`Total Time: ${(summary.totalDurationMs / 1000).toFixed(2)}s`);

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('A critical error occurred:', error);
    process.exit(1);
  }
}

main();
```

## Examples

### 1. Monorepo Build

The included `examples/monorepo-build` directory demonstrates a realistic use case for orchestrating a build process in a monorepo.

To run the example:

```bash
npm run example:monorepo
```

This command executes the `examples/monorepo-build/run.js` script, which programmatically invokes the runner with the task graph defined in `examples/monorepo-build/tasks.js`.

**Expected Output:**
The runner will execute tasks in parallel based on their dependencies. `lint` runs first. Then, `test:utils`, `test:ui`, and `test:api` run in parallel. As tests finish, their corresponding build tasks (`build:utils`, `build:ui`, `build:api`) will start. Finally, `build:server` runs after its dependencies are met.

```
▶ Monorepo Build Orchestration Starting...
  Total tasks: 8 | Concurrency: 4

[10:30:00 AM] ▶ RUNNING lint
  [Linting entire codebase] Starting... (will take 800ms)
[10:30:00 AM] ▶ RUNNING test:utils
  [Linting entire codebase] Finished.
[10:30:00 AM] ✔ SUCCESS lint (801ms)
[10:30:00 AM] ▶ RUNNING test:ui
  [Testing @shared/utils package] Starting... (will take 500ms)
[10:30:00 AM] ▶ RUNNING test:api
  [Testing @app/ui package] Starting... (will take 1200ms)
  [Testing @app/api package] Starting... (will take 900ms)
  [Testing @shared/utils package] Finished.
[10:30:01 AM] ✔ SUCCESS test:utils (502ms)
[10:30:01 AM] ▶ RUNNING build:utils
  [Building @shared/utils package] Starting... (will take 400ms)
  [Testing @app/api package] Finished.
[10:30:01 AM] ✔ SUCCESS test:api (903ms)
[10:30:01 AM] ▶ RUNNING build:api
  [Building @app/api package] Starting... (will take 700ms)
  [Building @shared/utils package] Finished.
[10:30:02 AM] ✔ SUCCESS build:utils (401ms)
  [Testing @app/ui package] Finished.
[10:30:02 AM] ✔ SUCCESS test:ui (1204ms)
[10:30:02 AM] ▶ RUNNING build:ui
  [Building @app/ui package] Starting... (will take 1500ms)
  [Building @app/api package] Finished.
[10:30:02 AM] ✔ SUCCESS build:api (702ms)
  [Building @app/ui package] Finished.
[10:30:03 AM] ✔ SUCCESS build:ui (1503ms)
[10:30:03 AM] ▶ RUNNING build:server
  [Building main server application] Starting... (will take 600ms)
  [Building main server application] Finished.
[10:30:04 AM] ✔ SUCCESS build:server (601ms)

🏁 Orchestration finished in 4.02s.
   ✔ Succeeded: 8 | ✖ Failed: 0 | ─ Skipped: 0 | Total: 8
```

### 2. Handling Failures

The runner can gracefully handle task failures. With `bail: true` (the default), it will stop scheduling new tasks after a failure and skip all downstream dependents.

To see this in action, modify a task to throw an error:

**`tasks.js` (with a failing task)**
```javascript
// ...
'test-api': {
  run: async () => {
    await simulateWork(500);
    throw new Error('API tests failed!');
  },
  dependencies: ['install-deps'],
},
'deploy': {
  run: () => console.log('This will be skipped'),
  dependencies: ['test-api'],
}
// ...
```

**Expected Output:**
The `test-api` task will fail, and the `deploy` task, which depends on it, will be skipped.

```
[10:35:00 AM] ▶ RUNNING install-deps
...
[10:35:01 AM] ✔ SUCCESS install-deps (1001ms)
[10:35:01 AM] ▶ RUNNING test-api
[10:35:01 AM] ✖ FAILED  test-api (503ms)
  └─ Error: API tests failed!
[10:35:01 AM] ─ SKIPPED deploy (Skipped due to failed dependencies: test-api)

🏁 Orchestration finished in 1.51s.
   ✔ Succeeded: 1 | ✖ Failed: 1 | ─ Skipped: 1 | Total: 3
```

## License

[MIT](./LICENSE)