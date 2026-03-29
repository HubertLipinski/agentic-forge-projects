/**
 * @file src/analysis/cycle-detector.js
 * @description Implements a graph traversal algorithm (DFS-based) to detect and report
 *              cycles within the dependency tree.
 * @module cycle-detector
 */

import logger from '../utils/logger.js';

// Node visitation states for DFS-based cycle detection.
const VISITATION_STATE = {
  UNVISITED: 'unvisited', // White: Node has not been visited yet.
  VISITING: 'visiting',   // Gray: Node is currently in the recursion stack.
  VISITED: 'visited',     // Black: Node and all its descendants have been visited.
};

/**
 * Detects circular dependencies in a dependency graph using a depth-first search (DFS) algorithm.
 *
 * The algorithm works by traversing the graph and maintaining the state of each node:
 * - UNVISITED: Not yet explored.
 * - VISITING: Currently in the recursion stack of the DFS traversal. A cycle is detected
 *             if we encounter a 'VISITING' node.
 * - VISITED: Fully explored (all its children have been visited).
 *
 * This function identifies all unique cycles in the graph.
 *
 * @param {Map<string, import('../graph/graph-node.js').GraphNode>} graph - The dependency graph, represented as a map
 *   where keys are node IDs (e.g., 'react@18.2.0') and values are GraphNode objects.
 * @returns {Array<Array<string>>} An array of cycles. Each cycle is an array of node IDs
 *   representing the path of the circular dependency, e.g., [['a@1.0.0', 'b@1.0.0', 'a@1.0.0']].
 */
export function detectCycles(graph) {
  logger.info('Starting cycle detection...');

  const cycles = [];
  const visitationState = new Map();
  const recursionStack = new Map(); // Tracks the path from the DFS root to the current node

  // Initialize all nodes as unvisited
  for (const nodeId of graph.keys()) {
    visitationState.set(nodeId, VISITATION_STATE.UNVISITED);
  }

  // Iterate through all nodes to handle disconnected components in the graph
  for (const nodeId of graph.keys()) {
    if (visitationState.get(nodeId) === VISITATION_STATE.UNVISITED) {
      dfsVisit(nodeId, graph, visitationState, recursionStack, cycles);
    }
  }

  if (cycles.length > 0) {
    logger.warn(`Found ${cycles.length} circular dependenc(y/ies).`);
    cycles.forEach((cycle, index) => {
      logger.debug(`Cycle ${index + 1}: ${cycle.join(' -> ')}`);
    });
  } else {
    logger.info('No circular dependencies found.');
  }

  return cycles;
}

/**
 * A recursive helper function that performs a depth-first search from a given node.
 *
 * @param {string} nodeId - The ID of the current node to visit.
 * @param {Map<string, import('../graph/graph-node.js').GraphNode>} graph - The full dependency graph.
 * @param {Map<string, string>} visitationState - A map tracking the visitation state of each node.
 * @param {Map<string, string|null>} recursionStack - A map representing the current traversal path (nodeId -> parentNodeId).
 * @param {Array<Array<string>>} cycles - An array to store the detected cycles.
 * @private
 */
function dfsVisit(nodeId, graph, visitationState, recursionStack, cycles) {
  visitationState.set(nodeId, VISITATION_STATE.VISITING);
  // Add node to the current path. The value is its parent, which we don't need here,
  // but we use the map's keys to represent the path.
  recursionStack.set(nodeId, null);

  const node = graph.get(nodeId);

  // If a node is not in the graph (e.g., a broken link), we can't traverse it.
  if (!node) {
    logger.warn(`Cycle detection encountered a missing node in the graph: ${nodeId}. Skipping its children.`);
    // Mark as visited and remove from recursion stack to continue.
    visitationState.set(nodeId, VISITATION_STATE.VISITED);
    recursionStack.delete(nodeId);
    return;
  }

  // The dependencies of a node are its adjacent nodes in the graph.
  const dependencies = Object.keys(node.dependencies);

  for (const depName of dependencies) {
    const depNodeId = node.dependencies[depName];
    const depState = visitationState.get(depNodeId);

    if (depState === VISITATION_STATE.VISITING) {
      // Cycle detected! The dependency is currently in the recursion stack.
      const cyclePath = buildCyclePath(recursionStack, nodeId, depNodeId);
      cycles.push(cyclePath);
      // We continue traversal to find other cycles, rather than stopping.
    } else if (depState === VISITATION_STATE.UNVISITED) {
      // Recursively visit the unvisited dependency.
      dfsVisit(depNodeId, graph, visitationState, recursionStack, cycles);
    }
    // If depState is VISITED, we've already explored this subgraph and know it has no cycles
    // involving the current path, so we do nothing.
  }

  // Finished visiting all children of this node.
  visitationState.set(nodeId, VISITATION_STATE.VISITED);
  // Remove the node from the current recursion path as we backtrack.
  recursionStack.delete(nodeId);
}

/**
 * Reconstructs the cycle path when a cycle is detected.
 *
 * @param {Map<string, string|null>} recursionStack - A map representing the current traversal path.
 * @param {string} fromNodeId - The node ID where the traversal is currently at.
 * @param {string} toNodeId - The node ID that points back, completing the cycle.
 * @returns {Array<string>} An array of node IDs representing the cycle.
 * @private
 */
function buildCyclePath(recursionStack, fromNodeId, toNodeId) {
  // To build the path, we need to trace back from `fromNodeId` to `toNodeId`.
  // The current `recursionStack` map doesn't store parent pointers, but its keys
  // represent the full path from the DFS root. We can convert keys to an array.
  const path = Array.from(recursionStack.keys());

  const cycleStartIndex = path.indexOf(toNodeId);
  if (cycleStartIndex === -1) {
    // This case should theoretically not happen if the algorithm is correct.
    // It indicates an inconsistency between the recursion stack and the detected cycle.
    logger.error('Failed to reconstruct cycle path. Inconsistency detected.');
    return [fromNodeId, toNodeId]; // Return a minimal representation of the detected edge.
  }

  // The cycle consists of the slice of the path from the target node (`toNodeId`)
  // to the end, plus the target node again to show the loop.
  const cycle = path.slice(cycleStartIndex);
  cycle.push(toNodeId); // Close the loop, e.g., A -> B -> C -> A

  return cycle;
}