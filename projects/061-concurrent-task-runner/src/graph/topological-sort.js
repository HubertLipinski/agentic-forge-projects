/**
 * @file src/graph/topological-sort.js
 * @description Implements Kahn's algorithm for topological sorting of a task graph.
 * This algorithm is essential for determining a valid execution order for tasks
 * in a dependency graph. It also inherently detects cycles, which are illegal
 * in a Directed Acyclic Graph (DAG), and reports them clearly.
 */

/**
 * Performs a topological sort on a given task graph.
 *
 * This implementation uses Kahn's algorithm. It works by iteratively finding nodes
 * with no incoming edges, adding them to the sorted list, and then "removing" them
 * and their outgoing edges from the graph. This process is repeated until no nodes
 * are left.
 *
 * If, at the end of the process, the number of sorted nodes is less than the total
 * number of nodes in the graph, it indicates a cycle. The algorithm is designed
 * to identify and report the nodes involved in the cycle.
 *
 * @param {Map<string, Set<string>>} adjacencyList - A map representing the graph's
 *   adjacency list, where keys are task IDs and values are sets of their dependencies.
 * @returns {{ sorted: string[][], hasCycle: false } | { sorted: null, hasCycle: true, cycle: string[] }}
 *   An object containing the result.
 *   - If successful (no cycle), it returns `{ sorted, hasCycle: false }`, where `sorted`
 *     is an array of arrays (layers) of task IDs that can be executed in parallel.
 *   - If a cycle is detected, it returns `{ sorted: null, hasCycle: true, cycle }`,
 *     where `cycle` is an array of task IDs forming the detected cycle.
 */
export function topologicalSort(adjacencyList) {
  // Use structuredClone to avoid mutating the original adjacencyList passed by the caller.
  // This is a defensive practice ensuring the function is a pure operation on the input.
  const graph = structuredClone(adjacencyList);
  const inDegree = new Map();
  const allNodes = new Set(graph.keys());

  // Step 1: Compute in-degrees for all nodes.
  // The in-degree of a node is the number of incoming edges (i.e., how many tasks depend on it).
  // We initialize all known nodes with an in-degree of 0.
  for (const taskId of allNodes) {
    inDegree.set(taskId, 0);
  }

  // Iterate through the graph to calculate the actual in-degrees.
  // The adjacency list represents `task -> dependencies`. We need to build the reverse:
  // `dependency -> tasks that depend on it`. The in-degree is the count of these.
  for (const dependencies of graph.values()) {
    for (const dependencyId of dependencies) {
      if (!allNodes.has(dependencyId)) {
        // This case should be prevented by schema validation and TaskGraph construction,
        // but as a defensive measure, we handle it.
        throw new Error(
          `Invalid dependency: Task "${dependencyId}" is listed as a dependency but is not defined in the task graph.`
        );
      }
      inDegree.set(dependencyId, inDegree.get(dependencyId) + 1);
    }
  }

  // Step 2: Initialize the queue with all nodes having an in-degree of 0.
  // These are the "root" nodes of the graph (or subgraphs) that have no dependencies.
  const queue = [];
  for (const [taskId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(taskId);
    }
  }

  const sortedLayers = [];
  let sortedCount = 0;

  // Step 3: Process the queue layer by layer.
  while (queue.length > 0) {
    const currentLayerSize = queue.length;
    const currentLayer = [];

    // Process all nodes currently in the queue. This constitutes one parallel execution layer.
    for (let i = 0; i < currentLayerSize; i++) {
      const u = queue.shift();
      currentLayer.push(u);

      // For each node `v` that depends on `u`, decrement its in-degree.
      // If a node's in-degree becomes 0, it means all its dependencies are met,
      // so it can be added to the queue for the next layer.
      for (const [v, dependencies] of graph.entries()) {
        if (dependencies.has(u)) {
          const vInDegree = inDegree.get(v) - 1;
          inDegree.set(v, vInDegree);

          if (vInDegree === 0) {
            queue.push(v);
          }
        }
      }
    }

    sortedLayers.push(currentLayer.sort()); // Sort for deterministic output
    sortedCount += currentLayer.length;
  }

  // Step 4: Check for cycles.
  // If sortedCount is less than the total number of nodes, the graph has a cycle.
  // The remaining nodes with in-degree > 0 are part of the cycle(s).
  if (sortedCount < allNodes.size) {
    const cycleNodes = [];
    for (const [taskId, degree] of inDegree.entries()) {
      if (degree > 0) {
        cycleNodes.push(taskId);
      }
    }
    return {
      sorted: null,
      hasCycle: true,
      cycle: cycleNodes.sort(), // Sort for deterministic error reporting
    };
  }

  // Success: no cycles were detected.
  return {
    sorted: sortedLayers,
    hasCycle: false,
  };
}