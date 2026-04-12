/**
 * @file examples/monorepo-build/tasks.js
 * @description Example task graph definition for a simulated monorepo build process.
 * This file demonstrates how to define a complex workflow with dependencies,
 * suitable for orchestrating tasks like linting, testing, and building packages
 * in a monorepo.
 */

/**
 * A helper function to simulate an asynchronous operation (like a build step).
 * It returns a promise that resolves after a specified duration.
 *
 * @param {string} taskName - The name of the task being simulated.
 * @param {number} durationMs - The duration of the simulated task in milliseconds.
 * @returns {Promise<void>} A promise that resolves when the task is "complete".
 */
const simulateAsyncTask = (taskName, durationMs) => {
  console.log(`  [${taskName}] Starting... (will take ${durationMs}ms)`);
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`  [${taskName}] Finished.`);
      resolve();
    }, durationMs);
  });
};

/**
 * The main task graph definition.
 *
 * This object is the default export and will be imported by the runner.
 * It defines a `tasks` object where each key is a unique task ID and the value
 * is a task configuration object.
 *
 * The dependency structure is as follows:
 *
 *                               +----------------+
 *                               |      lint      |
 *                               +----------------+
 *                                       |
 *              +------------------------+------------------------+
 *              |                        |                        |
 *              v                        v                        v
 *      +---------------+      +---------------+      +---------------+
 *      |  test:utils   |      |   test:ui     |      |  test:api     |
 *      +---------------+      +---------------+      +---------------+
 *              |                        |                        |
 *              |         +--------------+--------------+         |
 *              |         |                             |         |
 *              v         v                             v         v
 *      +---------------+                     +---------------+
 *      | build:utils   |                     |   build:api   |
 *      +---------------+                     +---------------+
 *              |                                       |
 *              |                                       |
 *              v                                       v
 *      +---------------+                     +---------------+
 *      |  build:ui     |                     | build:server  |
 *      +---------------+                     +---------------+
 *
 */
const taskGraph = {
  tasks: {
    // --- Global Tasks ---
    lint: {
      run: () => simulateAsyncTask('Linting entire codebase', 800),
      // No dependencies, can run immediately.
    },

    // --- Testing Layer ---
    // All test tasks depend on the global lint task.
    'test:utils': {
      run: () => simulateAsyncTask('Testing @shared/utils package', 500),
      dependencies: ['lint'],
    },
    'test:ui': {
      run: () => simulateAsyncTask('Testing @app/ui package', 1200),
      dependencies: ['lint'],
    },
    'test:api': {
      run: () => simulateAsyncTask('Testing @app/api package', 900),
      dependencies: ['lint'],
    },

    // --- Build Layer ---
    // 'build:utils' can start after 'test:utils' is done.
    'build:utils': {
      run: () => simulateAsyncTask('Building @shared/utils package', 400),
      dependencies: ['test:utils'],
    },

    // 'build:ui' depends on both its own tests and the 'build:utils' package it consumes.
    'build:ui': {
      run: () => simulateAsyncTask('Building @app/ui package', 1500),
      dependencies: ['test:ui', 'build:utils'],
    },

    // 'build:api' depends on its own tests.
    'build:api': {
      run: () => simulateAsyncTask('Building @app/api package', 700),
      dependencies: ['test:api'],
    },

    // The final server build depends on the API and UI packages being built.
    'build:server': {
      run: () => simulateAsyncTask('Building main server application', 600),
      dependencies: ['build:api', 'build:ui'],
    },

    // Example of a failing task to demonstrate error handling.
    // Uncomment this task and its dependencies to see the 'bail' feature in action.
    /*
    'test:failing': {
      run: async () => {
        await simulateAsyncTask('Running a failing test', 300);
        throw new Error('This test is designed to fail!');
      },
      dependencies: ['lint'],
    },
    'build:dependent-on-fail': {
        run: () => simulateAsyncTask('This task should be skipped', 100),
        dependencies: ['test:failing'],
    }
    */
  },
};

export default taskGraph;