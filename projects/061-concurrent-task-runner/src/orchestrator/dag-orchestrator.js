/**
 * @file src/orchestrator/dag-orchestrator.js
 * @description The core logic engine for the concurrent task runner.
 * This module orchestrates the execution of a task graph by:
 * 1. Using a topological sort to determine execution layers.
 * 2. Managing concurrency with a configurable limit to prevent resource exhaustion.
 * 3. Feeding tasks to the executor as their dependencies are met.
 * 4. Tracking the state of all tasks (pending, running, succeeded, failed, skipped).
 * 5. Handling failures and skipping dependent tasks accordingly.
 * 6. Emitting high-level orchestration events and providing a final summary.
 */

import pLimit from 'p-limit';
import { topologicalSort } from '../graph/topological-sort.js';
import { executeTask } from '../executor/task-executor.js';
import {
  emitTaskSkip,
  emitVerbose,
  emitOrchestrationStart,
  emitOrchestrationEnd,
  emitOrchestrationError,
} from '../utils/logger.js';

/**
 * @typedef {import('../graph/task-graph.js').TaskGraph} TaskGraph
 */

/**
 * @typedef {object} OrchestratorOptions
 * @property {number} [concurrency=os.cpus().length] - The maximum number of tasks to run in parallel.
 * @property {boolean} [bail=true] - If true, stops execution immediately after the first task failure.
 */

/**
 * @typedef {object} ExecutionResult
 * @property {boolean} success - True if all executable tasks succeeded, false otherwise.
 * @property {Map<string, 'succeeded' | 'failed' | 'skipped'>} taskStatus - The final status of each task.
 * @property {object} summary - A summary of the execution results.
 * @property {number} summary.totalTasks - Total tasks defined in the graph.
 * @property {number} summary.executedTasks - Number of tasks that were executed (not skipped).
 * @property {number} summary.succeededTasks - Number of tasks that succeeded.
 * @property {number} summary.failedTasks - Number of tasks that failed.
 * @property {number} summary.skippedTasks - Number of tasks that were skipped.
 * @property {number} summary.totalDurationMs - Total orchestration time in milliseconds.
 */

/**
 * The main orchestration function that runs a task graph.
 * It takes a pre-built TaskGraph instance and orchestrates the execution of its tasks
 * according to their dependencies and the specified concurrency limit.
 *
 * @param {TaskGraph} graph - An instance of the TaskGraph class.
 * @param {OrchestratorOptions} options - Configuration options for the run.
 * @returns {Promise<ExecutionResult>} A promise that resolves with the results of the execution.
 */
export async function run(graph, options = {}) {
  const orchestratorStartTime = performance.now();
  const { concurrency = (await import('node:os')).cpus().length, bail = true } = options;

  emitOrchestrationStart(graph.size, concurrency);
  emitVerbose('Starting orchestration.', { concurrency, bail });

  // Step 1: Topologically sort the graph to get execution layers and detect cycles.
  const sortResult = topologicalSort(graph.getAdjacencyList());

  if (sortResult.hasCycle) {
    const cycleError = new Error(
      `Execution failed: A cycle was detected in the task graph involving tasks: ${sortResult.cycle.join(', ')}.`
    );
    emitOrchestrationError(cycleError);
    throw cycleError;
  }

  const executionLayers = sortResult.sorted;
  emitVerbose('Topological sort successful.', {
    layerCount: executionLayers.length,
  });

  // Step 2: Initialize state management.
  const limit = pLimit(concurrency);
  const taskStatus = new Map(); // Tracks the final state of each task: 'succeeded', 'failed', 'skipped'
  const runningPromises = new Map(); // Maps taskId to its running promise

  // Step 3: Define the core task execution logic.
  const processTask = async (taskId) => {
    // Check if dependencies have failed. If so, skip this task.
    const taskDefinition = graph.getTask(taskId);
    const dependencies = taskDefinition?.dependencies ?? [];
    const failedDependencies = dependencies.filter(
      (depId) => taskStatus.get(depId) === 'failed'
    );

    if (failedDependencies.length > 0) {
      taskStatus.set(taskId, 'skipped');
      emitTaskSkip(taskId, failedDependencies);
      return; // Do not execute the task.
    }

    // Wait for all direct dependencies to complete.
    // This is the core of dependency-aware execution.
    const dependencyPromises = dependencies.map((depId) => runningPromises.get(depId));
    await Promise.all(dependencyPromises);

    // If bail is true and any task has failed, skip this task.
    if (bail && taskStatus.has('failed')) {
        if (!taskStatus.has(taskId)) { // Avoid re-skipping if already skipped
            taskStatus.set(taskId, 'skipped');
            emitTaskSkip(taskId, ['An earlier task failed and bail is enabled']);
        }
        return;
    }

    // Execute the task using the executor and concurrency limiter.
    const { success } = await limit(() => executeTask(taskId, taskDefinition));
    taskStatus.set(taskId, success ? 'succeeded' : 'failed');
  };

  // Step 4: Schedule all tasks.
  // We create promises for all tasks immediately. The `await` inside `processTask`
  // and the `p-limit` queue will enforce the correct execution order and concurrency.
  for (const taskId of graph.getAllTaskIds()) {
    const taskPromise = processTask(taskId);
    runningPromises.set(taskId, taskPromise);
  }

  // Step 5: Wait for all scheduled tasks to complete.
  try {
    await Promise.all(runningPromises.values());
  } catch (error) {
    // This block catches unexpected errors from within the orchestration logic itself,
    // not from the user tasks (which are handled in `executeTask`).
    emitOrchestrationError(error);
    // Re-throw to indicate a critical failure in the orchestrator.
    throw error;
  }

  // Step 6: Finalize and report results.
  const orchestratorEndTime = performance.now();
  const summary = {
    totalTasks: graph.size,
    executedTasks: 0,
    succeededTasks: 0,
    failedTasks: 0,
    skippedTasks: 0,
    totalDurationMs: orchestratorEndTime - orchestratorStartTime,
  };

  for (const status of taskStatus.values()) {
    if (status === 'succeeded') {
      summary.succeededTasks++;
      summary.executedTasks++;
    } else if (status === 'failed') {
      summary.failedTasks++;
      summary.executedTasks++;
    } else if (status === 'skipped') {
      summary.skippedTasks++;
    }
  }

  emitOrchestrationEnd(summary);
  emitVerbose('Orchestration finished.');

  return {
    success: summary.failedTasks === 0,
    taskStatus,
    summary,
  };
}