/**
 * @file src/graph/task-graph.js
 * @description Parses and validates the task graph definition, builds an internal
 * representation (adjacency list), and provides methods to query dependencies.
 * This class serves as the foundational data structure for the task orchestrator.
 */

import Ajv from 'ajv';
import taskGraphSchema from '../schemas/task-graph-schema.js';
import { emitVerbose } from '../utils/logger.js';

/**
 * Represents a dependency graph of tasks.
 *
 * This class is responsible for:
 * 1. Validating the raw task definition object against a JSON Schema.
 * 2. Building an adjacency list to represent the graph's structure, where each
 *    node is a task and edges represent dependencies.
 * 3. Performing integrity checks, such as ensuring all declared dependencies
 *    correspond to actual tasks defined in the graph.
 * 4. Providing methods to access graph properties, like the task definitions,
 *    the adjacency list, and individual tasks.
 */
export class TaskGraph {
  /**
   * A map where keys are task IDs and values are the full task definition objects.
   * @type {Map<string, { run: Function, dependencies?: string[] }>}
   * @private
   */
  #tasks = new Map();

  /**
   * The adjacency list representation of the graph.
   * Keys are task IDs, and values are Sets of their dependency task IDs.
   * Using a Set for dependencies provides efficient O(1) lookups and handles
   * deduplication automatically.
   * @type {Map<string, Set<string>>}
   * @private
   */
  #adjacencyList = new Map();

  /**
   * An Ajv instance for schema validation. Initialized once for efficiency.
   * @type {Ajv}
   * @private
   */
  #validator;

  /**
   * Constructs a TaskGraph instance.
   * The constructor validates the input `taskDefinition` and builds the internal
   * graph representation. It will throw an error if the definition is invalid.
   *
   * @param {object} taskDefinition - The raw task graph definition object,
   *   typically loaded from a user's `tasks.js` file.
   *   Example: `{ tasks: { 'task-a': { run: () => {}, dependencies: ['task-b'] }, 'task-b': { run: () => {} } } }`
   */
  constructor(taskDefinition) {
    if (!taskDefinition || typeof taskDefinition !== 'object') {
      throw new Error('Task graph definition must be a non-null object.');
    }

    this.#validator = new Ajv({ allErrors: true });
    this.#validateSchema(taskDefinition);
    this.#buildGraph(taskDefinition.tasks);

    emitVerbose('Task graph constructed and validated successfully.', {
      taskCount: this.#tasks.size,
    });
  }

  /**
   * Validates the provided task definition object against the JSON Schema.
   * Throws a detailed error if validation fails.
   *
   * @param {object} taskDefinition - The raw task definition object.
   * @private
   */
  #validateSchema(taskDefinition) {
    const validate = this.#validator.compile(taskGraphSchema);
    const isValid = validate(taskDefinition);

    if (!isValid) {
      const errorMessages =
        validate.errors
          ?.map((error) => `  - ${error.instancePath || 'root'}: ${error.message}`)
          .join('\n') ?? 'Unknown validation error.';
      throw new Error(`Task graph definition is invalid:\n${errorMessages}`);
    }
  }

  /**
   * Builds the internal graph structures (`#tasks` and `#adjacencyList`)
   * from the validated task definitions. Also performs runtime integrity checks.
   *
   * @param {object} tasks - The `tasks` object from the user's definition.
   * @private
   */
  #buildGraph(tasks) {
    const taskIds = Object.keys(tasks);

    // First pass: Populate the tasks map and adjacency list with empty dependency sets.
    // This ensures all nodes are known before processing edges (dependencies).
    for (const taskId of taskIds) {
      const task = tasks[taskId];

      // Runtime check for the `run` function, which JSON Schema cannot fully validate.
      if (typeof task.run !== 'function') {
        throw new Error(
          `Validation Error: Task "${taskId}" must have a 'run' property that is a function.`
        );
      }

      this.#tasks.set(taskId, task);
      this.#adjacencyList.set(taskId, new Set());
    }

    // Second pass: Populate the adjacency list with dependencies.
    // This pass also validates that all dependencies point to existing tasks.
    for (const taskId of taskIds) {
      const task = this.#tasks.get(taskId);
      const dependencies = task?.dependencies ?? [];

      for (const depId of dependencies) {
        // Integrity check: ensure every dependency is a defined task.
        if (!this.#tasks.has(depId)) {
          throw new Error(
            `Dependency Error: Task "${taskId}" lists a dependency on "${depId}", but task "${depId}" is not defined.`
          );
        }
        // Integrity check: ensure a task does not depend on itself.
        if (taskId === depId) {
          throw new Error(`Dependency Error: Task "${taskId}" cannot depend on itself.`);
        }
        this.#adjacencyList.get(taskId)?.add(depId);
      }
    }
  }

  /**
   * Returns the task definition object for a given task ID.
   *
   * @param {string} taskId - The unique identifier for the task.
   * @returns {{ run: Function, dependencies?: string[] } | undefined} The task object, or undefined if not found.
   */
  getTask(taskId) {
    return this.#tasks.get(taskId);
  }

  /**
   * Returns a list of all task IDs in the graph.
   *
   * @returns {string[]} An array of all task IDs.
   */
  getAllTaskIds() {
    return Array.from(this.#tasks.keys());
  }

  /**
   * Returns the total number of tasks in the graph.
   *
   * @returns {number} The number of tasks.
   */
  get size() {
    return this.#tasks.size;
  }

  /**
   * Returns the adjacency list of the graph.
   * This is the primary data structure used for topological sorting.
   *
   * @returns {Map<string, Set<string>>} The graph's adjacency list.
   */
  getAdjacencyList() {
    return this.#adjacencyList;
  }
}