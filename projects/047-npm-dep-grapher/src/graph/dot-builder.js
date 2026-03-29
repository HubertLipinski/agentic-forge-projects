/**
 * @file src/graph/dot-builder.js
 * @description Takes the internal graph representation and converts it into a DOT language string,
 *              with nodes styled based on dependency type or conflicts.
 * @module dot-builder
 */

import logger from '../utils/logger.js';

/**
 * @typedef {import('./graph-node.js').GraphNode} GraphNode
 * @typedef {import('../analysis/version-resolver.js').VersionConflict} VersionConflict
 */

/**
 * Configuration for styling the Graphviz DOT output.
 * Defines colors, shapes, and styles for different node and edge types.
 */
const DOT_STYLES = {
  graph: {
    fontname: 'Helvetica, Arial, sans-serif',
    fontsize: '16',
    label: 'NPM Dependency Graph',
    labelloc: 't', // Label at the top
    rankdir: 'TB', // Top-to-bottom layout
    splines: 'ortho', // Use orthogonal lines for edges
    nodesep: '0.8',
    ranksep: '1.2',
    bgcolor: '#F9F9F9',
  },
  node: {
    fontname: 'Helvetica, Arial, sans-serif',
    fontsize: '10',
    shape: 'box',
    style: 'rounded,filled',
    fillcolor: '#EFEFEF',
    color: '#CCCCCC',
    fontcolor: '#333333',
  },
  edge: {
    fontname: 'Helvetica, Arial, sans-serif',
    fontsize: '8',
    color: '#777777',
    arrowsize: '0.7',
  },
  // Node styles based on properties
  nodeStyles: {
    root: {
      shape: 'doubleoctagon',
      fillcolor: '#C8E6C9', // Light Green
      fontcolor: '#2E7D32',
      penwidth: '2',
    },
    workspace: {
      shape: 'house',
      fillcolor: '#BBDEFB', // Light Blue
      fontcolor: '#1976D2',
    },
    conflict: {
      fillcolor: '#FFCDD2', // Light Red
      color: '#D32F2F',
      fontcolor: '#B71C1C',
      penwidth: '2',
    },
    cycle: {
      style: 'rounded,filled,dashed',
      color: '#FF8F00', // Amber
      penwidth: '2',
    },
  },
  // Edge styles based on dependency type
  edgeStyles: {
    prod: {
      color: '#424242', // Dark Gray
      style: 'solid',
    },
    dev: {
      color: '#9E9E9E', // Medium Gray
      style: 'dashed',
    },
    peer: {
      color: '#0288D1', // Blue
      style: 'dotted',
      arrowhead: 'empty',
    },
    optional: {
      color: '#757575', // Gray
      style: 'dotted',
    },
  },
};

/**
 * Escapes a string for use within a DOT file label.
 * Replaces special characters like quotes, newlines, and backslashes.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeDotString(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Generates a unique, DOT-compliant ID for a graph node.
 * Node IDs in DOT cannot contain special characters like '@' or '.'.
 * @param {string} nodeId - The original node ID (e.g., 'react@18.2.0').
 * @returns {string} A safe ID for use in DOT (e.g., 'react_18_2_0').
 */
function getDotNodeId(nodeId) {
  return `"${escapeDotString(nodeId)}"`;
}

/**
 * Builds a DOT language string from the dependency graph.
 *
 * @param {object} options
 * @param {Map<string, GraphNode>} options.graph - The dependency graph.
 * @param {string} options.rootNodeId - The ID of the project's root node.
 * @param {VersionConflict[]} [options.conflicts=[]] - Array of version conflicts.
 * @param {string[][]} [options.cycles=[]] - Array of detected cycles.
 * @returns {string} A string containing the complete DOT graph definition.
 */
export function buildDotGraph({ graph, rootNodeId, conflicts = [], cycles = [] }) {
  logger.info('Building DOT graph string...');

  const dotLines = [];
  const conflictNodeIds = new Set(conflicts.map(c => c.parentId));
  const cycleNodeIds = new Set(cycles.flat());

  // --- Graph Header ---
  dotLines.push('digraph DependencyGraph {');
  dotLines.push('  // Graph attributes');
  for (const [key, value] of Object.entries(DOT_STYLES.graph)) {
    dotLines.push(`  ${key}="${value}";`);
  }

  // --- Node Definitions ---
  dotLines.push('\n  // Node definitions');
  dotLines.push(`  node [${Object.entries(DOT_STYLES.node).map(([k, v]) => `${k}="${v}"`).join(', ')}];`);

  for (const [nodeId, node] of graph.entries()) {
    const dotId = getDotNodeId(nodeId);
    const label = `${node.name}\\n${node.version}`;
    const styles = {};

    if (nodeId === rootNodeId) {
      Object.assign(styles, DOT_STYLES.nodeStyles.root);
    }
    if (node.isWorkspace) {
      Object.assign(styles, DOT_STYLES.nodeStyles.workspace);
    }
    if (conflictNodeIds.has(nodeId)) {
      Object.assign(styles, DOT_STYLES.nodeStyles.conflict);
    }
    if (cycleNodeIds.has(nodeId)) {
      Object.assign(styles, DOT_STYLES.nodeStyles.cycle);
    }

    const styleString = Object.entries(styles).map(([k, v]) => `${k}="${v}"`).join(', ');
    dotLines.push(`  ${dotId} [label="${escapeDotString(label)}"${styleString ? `, ${styleString}` : ''}];`);
  }

  // --- Edge Definitions ---
  dotLines.push('\n  // Edge definitions');
  dotLines.push(`  edge [${Object.entries(DOT_STYLES.edge).map(([k, v]) => `${k}="${v}"`).join(', ')}];`);

  for (const [parentId, parentNode] of graph.entries()) {
    if (!parentNode.resolvedDependencies) continue;

    for (const [depName, resolvedDepId] of Object.entries(parentNode.resolvedDependencies)) {
      const parentDotId = getDotNodeId(parentId);
      const childDotId = getDotNodeId(resolvedDepId);
      const depInfo = parentNode.dependencyMeta[depName];

      if (!depInfo) {
        logger.debug(`Missing dependency metadata for "${depName}" in "${parentId}". Cannot draw edge.`);
        continue;
      }

      const { type, version: requiredVersion } = depInfo;
      const edgeStyle = DOT_STYLES.edgeStyles[type] || {};
      const styleString = Object.entries(edgeStyle).map(([k, v]) => `${k}="${v}"`).join(', ');

      dotLines.push(`  ${parentDotId} -> ${childDotId} [label="${escapeDotString(requiredVersion)}"${styleString ? `, ${styleString}` : ''}];`);
    }
  }

  // --- Graph Footer ---
  dotLines.push('}');

  const dotString = dotLines.join('\n');
  logger.info('DOT graph string built successfully.');
  logger.debug(`DOT string length: ${dotString.length} characters.`);

  return dotString;
}