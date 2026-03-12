/**
 * @fileoverview
 * This module provides functionality to export a `graphology` graph instance
 * into the DOT language format. The resulting string can be used with Graphviz
 * tools (like `dot`, `neato`, `fdp`) to generate visual representations of the
 * content graph.
 */

/**
 * @typedef {import('graphology').default} Graph
 */

/**
 * @typedef {object} DotExporterOptions
 * @property {string} [graphName='MarkdownContentGraph'] - The name of the graph in the DOT output.
 * @property {object} [graphAttributes] - Global attributes to apply to the graph (e.g., `{ rankdir: 'LR' }`).
 * @property {object} [nodeAttributes] - Default attributes to apply to all nodes (e.g., `{ shape: 'box', style: 'rounded' }`).
 * @property {object} [edgeAttributes] - Default attributes to apply to all edges (e.g., `{ color: 'gray' }`).
 */

/**
 * Escapes a string for use as an ID or label in the DOT language.
 * DOT language identifiers should be quoted if they contain special characters,
 * keywords, or spaces. Labels can contain escaped newlines (`\n`).
 *
 * @param {string} str - The string to escape.
 * @returns {string} The escaped and quoted string.
 * @private
 */
function escapeDot(str) {
  if (typeof str !== 'string') {
    return '""';
  }
  // Replace backslashes and double quotes, then wrap in double quotes.
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Converts a JavaScript object of attributes into a DOT attribute string.
 * Example: { color: 'blue', shape: 'box' } -> '[color="blue", shape="box"]'
 *
 * @param {object} attributes - The object of key-value pairs.
 * @returns {string} The formatted DOT attribute list, or an empty string if no attributes.
 * @private
 */
function formatAttributes(attributes) {
  if (!attributes || Object.keys(attributes).length === 0) {
    return '';
  }

  const parts = Object.entries(attributes).map(([key, value]) => {
    // In DOT, boolean values are often just the key (e.g., `[arrowhead=none]`).
    // However, string representation `[arrowhead="none"]` is more robust.
    // We will quote all values for consistency.
    return `${key}=${escapeDot(String(value))}`;
  });

  return ` [${parts.join(', ')}]`;
}

/**
 * Exports a graphology graph instance to a DOT language string.
 *
 * This function traverses the provided graph and constructs a string representation
 * in the DOT format. It allows for customization of graph, node, and edge
 * attributes to control the final visualization's appearance.
 *
 * The function is designed to be robust, handling potential errors and ensuring
 * that all identifiers and labels are correctly escaped for the DOT language.
 *
 * @param {Graph} graph - The graphology instance to export.
 * @param {DotExporterOptions} [options={}] - Configuration options for the DOT output.
 * @returns {Promise<string>} A promise that resolves to the DOT language string.
 * @throws {Error} If the provided `graph` is not a valid graphology instance.
 */
export async function exportAsDot(graph, options = {}) {
  if (!graph || typeof graph.forEachNode !== 'function' || typeof graph.forEachEdge !== 'function') {
    throw new Error('A valid graphology instance must be provided for export.');
  }

  // Wrapping in a Promise to maintain a consistent async API across exporters.
  // The operation itself is synchronous but can be CPU-intensive for large graphs.
  return new Promise((resolve) => {
    const {
      graphName = 'MarkdownContentGraph',
      graphAttributes = { rankdir: 'LR', charset: 'UTF-8' },
      nodeAttributes = { shape: 'box', style: 'rounded,filled', fillcolor: '#f8f8f8' },
      edgeAttributes = { color: '#555555' },
    } = options;

    const dotLines = [];

    // Start the directed graph definition.
    dotLines.push(`digraph ${escapeDot(graphName)} {`);

    // Apply global graph, node, and edge attributes.
    dotLines.push(`  graph${formatAttributes(graphAttributes)};`);
    dotLines.push(`  node${formatAttributes(nodeAttributes)};`);
    dotLines.push(`  edge${formatAttributes(edgeAttributes)};`);
    dotLines.push(''); // Add a blank line for readability.

    // Define all nodes.
    // This ensures that even nodes with no edges are included in the output.
    graph.forEachNode((node, attributes) => {
      // Use the node's `label` attribute if it exists, otherwise default to the node ID.
      const label = attributes.label ?? node;
      const nodeAttrs = { label };

      // Add a red border for nodes that are part of a broken link target.
      // This is a simple heuristic; more complex styling could be added.
      if (attributes.isBroken) {
        nodeAttrs.color = 'red';
        nodeAttrs.style = 'dashed';
      }

      dotLines.push(`  ${escapeDot(node)}${formatAttributes(nodeAttrs)};`);
    });

    dotLines.push(''); // Add a blank line for readability.

    // Define all edges.
    graph.forEachEdge((edge, attributes, source, target) => {
      const edgeAttrs = {};
      // Add a tooltip with the raw link for interactivity in SVG outputs.
      if (attributes.rawLink) {
        edgeAttrs.tooltip = `From ${source} to ${target} via "${attributes.rawLink}"`;
      }
      dotLines.push(`  ${escapeDot(source)} -> ${escapeDot(target)}${formatAttributes(edgeAttrs)};`);
    });

    // Close the graph definition.
    dotLines.push('}');

    resolve(dotLines.join('\n'));
  });
}