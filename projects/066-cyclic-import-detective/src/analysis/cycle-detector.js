/**
 * @file src/analysis/cycle-detector.js
 * @description Applies Tarjan's algorithm for finding Strongly Connected Components (SCCs)
 * to a dependency graph to detect import cycles.
 *
 * This module takes a `graphology` graph instance, converts it into a format
 * compatible with the `tarjan-graph` library, runs the algorithm, and then
 * filters the results to identify only the true cycles (SCCs with more than
 * one node, or a single node with a self-loop).
 */

import TarjanGraph from 'tarjan-graph';
import logger from '../utils/logger.js';

/**
 * @typedef {import('graphology').Graph} DependencyGraph
 */

/**
 * @typedef {string[]} Cycle - An array of absolute file paths representing a circular dependency.
 */

/**
 * Detects all circular dependencies within a given dependency graph.
 *
 * It works in three main steps:
 * 1.  **Format Conversion**: It transforms the `graphology` graph into a simple
 *     adjacency list format that the `tarjan-graph` library expects. This involves
 *     mapping each node (file path) to a list of its direct dependencies.
 *
 * 2.  **SCC Detection**: It runs Tarjan's algorithm on the formatted graph to find
 *     all Strongly Connected Components (SCCs). An SCC is a subgraph where every
 *     node is reachable from every other node in that subgraph.
 *
 * 3.  **Cycle Filtering**: It filters the list of SCCs to identify actual cycles.
 *     A cycle is defined as an SCC containing either:
 *     - More than one node (e.g., A -> B -> A).
 *     - A single node that points to itself (a self-loop, e.g., A -> A).
 *
 * @param {DependencyGraph} graph - The dependency graph instance from `graphology`.
 * @returns {Cycle[]} An array of cycles. Each cycle is an array of file paths.
 *                    Returns an empty array if no cycles are found or if the graph is empty.
 */
export function detectCycles(graph) {
  if (!graph || graph.order === 0) {
    logger.info('Graph is empty, no cycles to detect.');
    return [];
  }

  logger.info('Starting cycle detection using Tarjan\'s algorithm...');

  // 1. Format the graph for the `tarjan-graph` library.
  // It expects an object where keys are node names and values are arrays of adjacent node names.
  const tarjanInput = {};
  graph.forEachNode(node => {
    // Get the list of nodes that `node` has an edge pointing to.
    const neighbors = graph.outNeighbors(node);
    tarjanInput[node] = neighbors;
  });

  // 2. Initialize and run Tarjan's algorithm.
  const tarjan = new TarjanGraph(tarjanInput);
  const stronglyConnectedComponents = tarjan.getStronglyConnectedComponents();

  logger.debug(`Found ${stronglyConnectedComponents.length} strongly connected components.`);

  // 3. Filter SCCs to find actual cycles.
  const cycles = stronglyConnectedComponents.filter(component => {
    // A component with more than one node is always a cycle.
    if (component.length > 1) {
      return true;
    }

    // A component with a single node is a cycle only if it has a self-loop.
    if (component.length === 1) {
      const node = component[0];
      // `graph.hasEdge(node, node)` checks for an edge from the node to itself.
      const hasSelfLoop = graph.hasDirectedEdge(node, node);
      if (hasSelfLoop) {
        logger.debug(`Detected self-referencing cycle in: ${node}`);
      }
      return hasSelfLoop;
    }

    // Components with zero nodes are not possible but we filter them out just in case.
    return false;
  });

  if (cycles.length > 0) {
    logger.warn(`Cycle detection complete. Found ${cycles.length} circular dependency group(s).`);
  } else {
    logger.info('Cycle detection complete. No circular dependencies found!');
  }

  return cycles;
}