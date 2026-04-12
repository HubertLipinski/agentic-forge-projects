/**
 * @file src/executor/task-executor.js
 * @description Executes a single task function, handling promise resolution, error catching, and emitting lifecycle events.
 * This module isolates the logic for running a user-defined task function,
 * ensuring that its execution is timed, its outcome (success or failure) is
 * captured, and the appropriate events are emitted to the logger.
 */

import {
  emitTaskStart,
  emitTaskSuccess,
  emitTaskFail,
} from '../utils/logger.js';

/**
 * Executes a single, user-defined task function.
 *
 * This function wraps the execution of a task's `run` method. It handles the
 * following concerns:
 * 1.  Emits a `task:start` event before execution.
 * 2.  Records the execution start time to calculate the total duration.
 * 3.  Invokes the `run` function, which can be synchronous or asynchronous (return a Promise).
 * 4.  Awaits the promise if the `run` function is async.
 * 5.  Catches any errors thrown during execution.
 * 6.  Emits either a `task:success` or `task:fail` event upon completion,
 *     including the execution duration.
 * 7.  Returns a result object indicating the outcome and providing the error if one occurred.
 *
 * @param {string} taskId - The unique identifier of the task to execute.
 * @param {{ run: Function }} task - The task object containing the `run` function.
 * @returns {Promise<{ success: boolean, error: Error | null }>} A promise that resolves
 *   with an object indicating the success or failure of the task. The `error` property
 *   is populated if the task failed.
 */
export async function executeTask(taskId, task) {
  // Defensive check: Ensure the task object and its run method are valid.
  // This should be guaranteed by the TaskGraph class, but it's good practice
  // to validate inputs at the function boundary.
  if (!task || typeof task.run !== 'function') {
    const error = new TypeError(
      `Task "${taskId}" is invalid or missing a 'run' function.`
    );
    // We don't emit a standard fail event here because this is a system-level
    // programming error, not a user-task failure. The orchestrator should handle this.
    return { success: false, error };
  }

  emitTaskStart(taskId);
  const startTime = performance.now();

  try {
    // The `run` function can be sync or async. `await` handles both cases gracefully.
    // If it's sync, the value is wrapped in a resolved promise.
    // If it's async, `await` waits for the promise to settle.
    await task.run();

    const durationMs = performance.now() - startTime;
    emitTaskSuccess(taskId, durationMs);

    return { success: true, error: null };
  } catch (error) {
    const durationMs = performance.now() - startTime;

    // Ensure the caught value is a proper Error object for consistent error handling.
    const executionError =
      error instanceof Error
        ? error
        : new Error(
            `Task "${taskId}" failed with a non-error value: ${String(error)}`
          );

    emitTaskFail(taskId, executionError, durationMs);

    return { success: false, error: executionError };
  }
}