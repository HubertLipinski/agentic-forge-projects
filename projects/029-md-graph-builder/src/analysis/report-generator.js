/**
 * @fileoverview
 * This module provides functions to analyze a `graphology` graph of Markdown
 * documents and generate a comprehensive report. The analyses include identifying
 * broken links, orphan pages (files with no incoming links), and circular
 * dependencies.
 */

import { allSimplePaths } from 'graphology-simple-path';

/**
 * @typedef {import('graphology').default} Graph
 */

/**
 * @typedef {object} AnalysisReport
 * @property {number} totalNodes - The total number of documents (nodes) in the graph.
 * @property {number} totalEdges - The total number of links (edges) in the graph.
 * @property {BrokenLink[]} brokenLinks - A list of links pointing to non-existent documents.
 * @property {OrphanPage[]} orphanPages - A list of documents that have no incoming links.
 * @property {string[][]} circularDependencies - A list of paths representing circular dependencies.
 * @property {object} stats - General statistics about the graph.
 * @property {number} stats.nodeCount - Alias for totalNodes.
 * @property {number} stats.edgeCount - Alias for totalEdges.
 * @property {number} stats.density - The density of the graph.
 */

/**
 * @typedef {object} BrokenLink
 * @property {string} source - The canonical path of the file containing the broken link.
 * @property {string} target - The unresolved canonical path of the link destination.
 * @property {string} rawLink - The original, unprocessed link text from the Markdown file.
 */

/**
 * @typedef {object} OrphanPage
 * @property {string} id - The canonical path of the orphan document.
 * @property {string} absolutePath - The absolute file system path of the orphan document.
 */

/**
 * Analyzes the graph to find all links that point to a non-existent node.
 * These are considered "broken links".
 *
 * @param {Graph} graph - The graphology instance to analyze.
 * @returns {BrokenLink[]} An array of objects, each representing a broken link.
 * @private
 */
function findBrokenLinks(graph) {
  const brokenLinks = [];

  // An edge represents a link from a source node to a target node ID.
  // If the graph does not actually contain a node with that target ID,
  // it's a broken link.
  graph.forEachEdge((edge, attributes, source, target) => {
    if (!graph.hasNode(target)) {
      brokenLinks.push({
        source,
        target,
        rawLink: attributes.rawLink ?? '',
      });
    }
  });

  return brokenLinks;
}

/**
 * Analyzes the graph to find all nodes that have an in-degree of zero.
 * These are "orphan pages" as no other document in the set links to them.
 *
 * @param {Graph} graph - The graphology instance to analyze.
 * @returns {OrphanPage[]} An array of objects, each representing an orphan page.
 * @private
 */
function findOrphanPages(graph) {
  const orphans = [];

  graph.forEachNode((node, attributes) => {
    // The in-degree of a node is the number of incoming edges.
    // An orphan has an in-degree of 0.
    if (graph.inDegree(node) === 0) {
      orphans.push({
        id: node,
        absolutePath: attributes.absolutePath,
      });
    }
  });

  return orphans;
}

/**
 * Analyzes the graph to find all simple circular dependencies.
 * A simple cycle is a path that starts and ends at the same node.
 * For example: A -> B -> C -> A.
 *
 * This function uses a path-finding algorithm to detect cycles originating
 * from each node.
 *
 * @param {Graph} graph - The graphology instance to analyze.
 * @returns {string[][]} An array of arrays, where each inner array is a path
 *   representing a cycle (e.g., ['A', 'B', 'A']).
 * @private
 */
function findCircularDependencies(graph) {
  const cycles = [];
  const visitedCycles = new Set(); // To store a canonical representation of found cycles

  graph.forEachNode(startNode => {
    // `allSimplePaths` finds all paths from `startNode` to its successors.
    // If a successor is `startNode` itself, we've found a cycle.
    const successors = graph.successors(startNode);

    for (const successor of successors) {
      // Find all paths from the successor back to the start node.
      const paths = allSimplePaths(graph, successor, startNode);

      for (const path of paths) {
        // A full cycle is the start node -> the path back to it.
        const cycle = [startNode, ...path];

        // To avoid duplicates (e.g., A->B->A and B->A->B), we normalize
        // the cycle representation by sorting its nodes and creating a string key.
        const canonicalKey = [...new Set(cycle)].sort().join('->');

        if (!visitedCycles.has(canonicalKey)) {
          cycles.push(cycle);
          visitedCycles.add(canonicalKey);
        }
      }
    }
  });

  return cycles;
}


/**
 * Generates a comprehensive analysis report from a content graph.
 *
 * This is the main entry point for the analysis module. It orchestrates various
 * analysis functions (finding broken links, orphans, and cycles) and compiles
 * them into a single, structured report object.
 *
 * @param {Graph} graph - The `graphology` instance representing the content structure.
 * @returns {Promise<AnalysisReport>} A promise that resolves to the full analysis report.
 * @throws {Error} If the provided graph is not a valid graphology instance.
 */
export async function generateReport(graph) {
  // Basic input validation
  if (!graph || typeof graph.order === 'undefined' || typeof graph.size === 'undefined') {
    throw new Error('A valid graphology instance must be provided.');
  }

  // The analysis functions are synchronous and CPU-bound. We wrap them in a
  // Promise to maintain a consistent async API across the application,
  // allowing for potential future async analysis tasks without changing the interface.
  return new Promise((resolve) => {
    const nodeCount = graph.order;
    const edgeCount = graph.size;

    // The density of a directed graph is E / (V * (V - 1))
    const density = nodeCount > 1 ? edgeCount / (nodeCount * (nodeCount - 1)) : 0;

    const report = {
      totalNodes: nodeCount,
      totalEdges: edgeCount,
      brokenLinks: findBrokenLinks(graph),
      orphanPages: findOrphanPages(graph),
      circularDependencies: findCircularDependencies(graph),
      stats: {
        nodeCount,
        edgeCount,
        density: parseFloat(density.toFixed(4)), // Round for readability
      },
    };

    resolve(report);
  });
}