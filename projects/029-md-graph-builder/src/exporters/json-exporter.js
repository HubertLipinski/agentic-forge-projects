/**
 * @fileoverview
 * This module provides functionality to export a `graphology` graph instance
 * into a serializable JSON format. The exported format is compatible with
 * graphology's own serialization methods, making it easy to re-import or use
 * with other tools that understand this structure.
 */

/**
 * @typedef {import('graphology').default} Graph
 */

/**
 * @typedef {object} JsonExporterOptions
 * @property {boolean} [pretty=false] - If true, the output JSON will be formatted
 *   with an indentation of 2 spaces for human readability.
 */

/**
 * Exports a graphology graph instance to a JSON string.
 *
 * This function serializes the provided graph into a standard JSON format that
 * captures the graph's nodes, edges, attributes, and options. It leverages
 * graphology's built-in `export` method, which is highly optimized and ensures
 * a complete and accurate representation of the graph structure.
 *
 * The function is designed to be robust, handling potential serialization errors
 * and providing an option for pretty-printing the output.
 *
 * @param {Graph} graph - The graphology instance to export.
 * @param {JsonExporterOptions} [options={}] - Configuration options for the export.
 * @returns {Promise<string>} A promise that resolves to the JSON string
 *   representation of the graph.
 * @throws {Error} If the provided `graph` is not a valid graphology instance.
 * @throws {Error} If the serialization process fails (e.g., due to non-serializable attributes).
 */
export async function exportAsJson(graph, options = {}) {
  if (!graph || typeof graph.export !== 'function') {
    throw new Error('A valid graphology instance must be provided for export.');
  }

  const { pretty = false } = options;

  try {
    // graphology's `export` method is synchronous but can be computationally
    // intensive for very large graphs. Wrapping it in a Promise maintains a
    // consistent async API across all exporters in the project.
    const graphObject = graph.export();

    // `JSON.stringify` can be a blocking operation for large objects.
    // The async nature of this function allows it to be awaited without
    // blocking the event loop if called from an async context.
    const jsonString = JSON.stringify(
      graphObject,
      null, // No replacer function needed
      pretty ? 2 : 0 // Indentation level for pretty-printing
    );

    return Promise.resolve(jsonString);
  } catch (error) {
    // This error could be a TypeError from JSON.stringify if the graph
    // contains circular references or BigInts in its attributes, which
    // graphology's export should prevent, but we handle it defensively.
    console.error('Failed to serialize graph to JSON:', error);
    throw new Error(`Graph serialization failed. Reason: ${error.message}`);
  }
}