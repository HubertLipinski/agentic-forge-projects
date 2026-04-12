/**
 * @file src/index.js
 * @description Main library entry point for the Concurrent Task Runner.
 * This file exports the primary 'run' function, which serves as the public API
 * for programmatically executing a task graph. It encapsulates the entire
 * process of validation, graph construction, and orchestration.
 */

import { TaskGraph } from './graph/task-graph.js';
import { run as runOrchestration } from './orchestrator/dag-orchestrator.js';
import { cpus } from 'node:os';

/**
 * @typedef {import('./orchestrator/dag-orchestrator.js').ExecutionResult} ExecutionResult
 */

/**
 * @typedef {object} RunOptions
 * @property {number} [concurrency=os.cpus().length] - The maximum number of tasks to run in parallel.
 *   Defaults to the number of logical CPU cores on the machine.
 * @property {boolean} [bail=true] - If true, the orchestrator will stop scheduling new tasks
 *   as soon as the first task failure occurs. Tasks already in progress will complete, but
 *   no new tasks will start, and dependent tasks will be skipped. If false, the runner will
 *   attempt to execute all tasks that don't have failed dependencies.
 */

/**
 * The main public function to execute a task graph.
 *
 * This function orchestrates the entire lifecycle of a task run:
 * 1.  It takes a raw task definition object and a set of options.
 * 2.  It constructs and validates a `TaskGraph` instance from the definition.
 * 3.  It invokes the `dag-orchestrator` to execute the graph based on the provided options.
 * 4.  It returns a promise that resolves with a detailed summary of the execution results.
 *
 * This function is designed to be the single entry point for all programmatic uses of the library.
 *
 * @param {object} taskDefinition - The raw task graph definition object, conforming to the schema.
 *   Example: `{ tasks: { 'build': { run: () => console.log('Building...') } } }`
 * @param {RunOptions} [options={}] - Configuration options for the execution.
 * @returns {Promise<ExecutionResult>} A promise that resolves with the final execution result,
 *   including success status, task statuses, and a performance summary.
 * @throws {Error} Throws an error if the `taskDefinition` is invalid (e.g., malformed,
 *   contains dependency cycles, or has other integrity issues).
 */
export async function run(taskDefinition, options = {}) {
  // Step 1: Validate and construct the graph.
  // The TaskGraph constructor handles all initial validation (schema, dependency integrity).
  // This will throw an error on invalid input, which is the desired behavior for a public API.
  const graph = new TaskGraph(taskDefinition);

  // Step 2: Prepare and default the orchestrator options.
  const runOptions = {
    // Use nullish coalescing to safely default options.
    concurrency: options.concurrency ?? cpus().length,
    bail: options.bail ?? true,
  };

  // Step 3: Pass the constructed graph and options to the orchestrator.
  // The orchestrator contains the core logic for execution, concurrency, and state management.
  // By separating graph construction from orchestration, we maintain a clear separation of concerns.
  const result = await runOrchestration(graph, runOptions);

  // Step 4: Return the final result to the caller.
  return result;
}