/**
 * @fileoverview
 * This module provides functionality to export a `graphology` graph instance
 * into the Mermaid.js syntax. The resulting string can be embedded in Markdown
 * files (e.g., on GitHub) or used with Mermaid tools to generate diagrams
 * representing the content graph.
 */

/**
 * @typedef {import('graphology').default} Graph
 */

/**
 * @typedef {object} MermaidExporterOptions
 * @property {'LR' | 'TD' | 'RL' | 'BT'} [direction='LR'] - The direction of the graph layout
 *   (Left to Right, Top to Down, Right to Left, Bottom to Top).
 * @property {boolean} [addStyles=false] - Whether to add default styling classes for nodes.
 *   Note: Styling requires a Mermaid configuration or CSS to be effective.
 */

/**
 * Escapes a string for use as a node ID or label in Mermaid syntax.
 * Mermaid IDs cannot contain special characters, so we need a way to map
 * complex node IDs (like file paths) to safe, unique identifiers.
 * Labels (the text displayed) must have their quotes escaped.
 *
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string, suitable for a Mermaid label.
 * @private
 */
function escapeMermaidLabel(str) {
  if (typeof str !== 'string') {
    return '""';
  }
  // Replace quotes and other potentially problematic characters for display.
  return `"${str.replace(/"/g, '#quot;')}"`;
}

/**
 * Creates a safe, unique, and valid Mermaid node ID from a graph node ID.
 * Graphology node IDs can be strings like 'docs/folder/file', which are not
 * valid as unquoted IDs in Mermaid. This function creates a simple, unique
 * mapping.
 *
 * @param {string} nodeId - The original node ID from the graph.
 * @param {Map<string, string>} nodeMap - A map to store the mapping from original ID to safe ID.
 * @returns {string} The safe, unique ID for use in Mermaid.
 * @private
 */
function getSafeNodeId(nodeId, nodeMap) {
  if (nodeMap.has(nodeId)) {
    return nodeMap.get(nodeId);
  }
  const safeId = `N${nodeMap.size}`;
  nodeMap.set(nodeId, safeId);
  return safeId;
}


/**
 * Exports a graphology graph instance to a Mermaid.js syntax string.
 *
 * This function traverses the provided graph and constructs a string that defines
 * the graph's structure using Mermaid's `graph` or `flowchart` syntax. It maps
 * graph nodes and edges to their Mermaid equivalents, ensuring that node IDs and
 * labels are properly formatted.
 *
 * @param {Graph} graph - The graphology instance to export.
 * @param {MermaidExporterOptions} [options={}] - Configuration options for the Mermaid output.
 * @returns {Promise<string>} A promise that resolves to the Mermaid syntax string.
 * @throws {Error} If the provided `graph` is not a valid graphology instance.
 */
export async function exportAsMermaid(graph, options = {}) {
  if (!graph || typeof graph.forEachNode !== 'function' || typeof graph.forEachEdge !== 'function') {
    throw new Error('A valid graphology instance must be provided for export.');
  }

  // This operation is synchronous but wrapped in a Promise to maintain a consistent
  // async API across all exporters, which is good practice for I/O-like modules.
  return new Promise((resolve) => {
    const {
      direction = 'LR',
      addStyles = false,
    } = options;

    const mermaidLines = [];
    // `graph` is a synonym for `flowchart` in Mermaid v10+
    mermaidLines.push(`graph ${direction}`);

    // A map to translate potentially complex graphology node IDs (like file paths)
    // into simple, valid Mermaid node IDs (like N0, N1, N2).
    const nodeMap = new Map();
    const definedNodes = new Set();

    // First, define all nodes with their labels. This ensures nodes with no
    // edges are still rendered and allows us to apply labels correctly.
    graph.forEachNode((node, attributes) => {
      const safeId = getSafeNodeId(node, nodeMap);
      const label = attributes.label ?? node;
      mermaidLines.push(`  ${safeId}(${escapeMermaidLabel(label)});`);
      definedNodes.add(node);
    });

    mermaidLines.push(''); // Blank line for readability

    // Now, define all the edges (links).
    graph.forEachEdge((edge, attributes, source, target) => {
      const sourceId = getSafeNodeId(source, nodeMap);

      // Handle broken links: the target node doesn't exist in the graph.
      // We create a "ghost" node for it in Mermaid to visualize the broken link.
      if (!definedNodes.has(target)) {
        const targetId = getSafeNodeId(target, nodeMap);
        // Define the broken node with a distinct appearance.
        mermaidLines.push(`  ${targetId}(["${target} 💔"]);`);
        mermaidLines.push(`  style ${targetId} fill:#fdd,stroke:#f00,stroke-width:2px`);
        definedNodes.add(target); // Mark as defined to avoid re-definition
        mermaidLines.push(`  ${sourceId} --> ${targetId};`);
      } else {
        const targetId = getSafeNodeId(target, nodeMap);
        mermaidLines.push(`  ${sourceId} --> ${targetId};`);
      }
    });

    // Optionally add some default styling classes for different node types.
    // This is a basic example; more complex styling can be done via Mermaid's API.
    if (addStyles) {
      mermaidLines.push('');
      mermaidLines.push('  %% Default styles');
      mermaidLines.push('  classDef default fill:#f8f8f8,stroke:#333,stroke-width:1px;');
    }

    resolve(mermaidLines.join('\n'));
  });
}