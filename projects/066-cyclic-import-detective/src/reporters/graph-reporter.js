/**
 * @file src/reporters/graph-reporter.js
 * @description Exports the dependency graph to a file format like GraphML or GEXF
 * for visualization in external tools such as Gephi.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { write as writeGexf } from 'graphology-gexf';
import { write as writeGraphml } from 'graphology-graphml';
import logger from '../utils/logger.js';
import { REPORT_FORMATS } from '../constants.js';

/**
 * @typedef {import('graphology').Graph} DependencyGraph
 * @typedef {string[]} Cycle - An array of absolute file paths representing a circular dependency.
 */

/**
 * @typedef {object} GraphReporterOptions
 * @property {string} outputFile - The path where the graph file will be saved.
 * @property {'graphml' | 'gexf'} format - The output format for the graph file.
 * @property {string} [baseDir=process.cwd()] - The base directory to make file paths relative to for labels.
 */

/**
 * Enhances a graph with visual attributes based on analysis results, such as cycles.
 * This function adds 'size', 'color', and other attributes to nodes to make the
 * resulting graph more informative when visualized.
 *
 * @param {DependencyGraph} graph - The graph to enhance.
 * @param {Cycle[]} cycles - The detected cycles.
 * @param {GraphReporterOptions} options - Reporter configuration options.
 */
function enhanceGraphForVisualization(graph, cycles, options) {
  logger.debug('Enhancing graph with visual attributes for export...');
  const { baseDir } = options;

  // Create a quick lookup set for nodes that are part of any cycle.
  const nodesInCycles = new Set(cycles.flat());

  graph.forEachNode((node, attributes) => {
    const isCycleNode = nodesInCycles.has(node);
    const isExternal = attributes.isExternal || false;

    // Make labels relative and more readable.
    const label = isExternal
      ? attributes.label // External nodes already have their specifier as label
      : path.relative(baseDir, node);

    // Set visual attributes. These are standard attributes recognized by Gephi.
    graph.setNodeAttribute(node, 'label', label);
    graph.setNodeAttribute(node, 'size', isCycleNode ? 15 : 5); // Make cycle nodes larger.

    // Assign colors based on node type.
    if (isCycleNode) {
      graph.setNodeAttribute(node, 'color', '#E63946'); // Red for cycle nodes
    } else if (isExternal) {
      graph.setNodeAttribute(node, 'color', '#A8DADC'); // Light blue for external modules
    } else {
      graph.setNodeAttribute(node, 'color', '#457B9D'); // Dark blue for regular project files
    }
  });

  // Optionally, add attributes to edges
  graph.forEachEdge((edge, attributes, source, target) => {
    if (attributes.isDynamic) {
        // Example: make dynamic import edges dashed (visualization tool dependent)
        graph.setEdgeAttribute(edge, 'type', 'dashed');
    }
  });
}

/**
 * Generates and saves a graph file (GraphML or GEXF) from the analysis results.
 *
 * This function takes the dependency graph, enhances it with visual information
 * (like highlighting nodes in cycles), and then serializes it to the specified
 * file format and path.
 *
 * @param {object} analysisResult - The result object from the analysis.
 * @param {Cycle[]} analysisResult.cycles - An array of detected cycles.
 * @param {DependencyGraph} analysisResult.graph - The complete dependency graph.
 * @param {GraphReporterOptions} options - Configuration for the graph reporter.
 * @returns {Promise<void>} A promise that resolves when the file has been written.
 */
export async function generateGraphReport(analysisResult, options) {
  const { cycles, graph } = analysisResult;
  const { outputFile, format } = options;

  if (!outputFile) {
    const errorMessage = 'An output file path is required for graph reports.';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (format !== REPORT_FORMATS.GRAPHML && format !== REPORT_FORMATS.GEXF) {
    const errorMessage = `Invalid graph format: '${format}'. Must be '${REPORT_FORMATS.GRAPHML}' or '${REPORT_FORMATS.GEXF}'.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (!graph || graph.order === 0) {
    logger.warn('Graph is empty. Skipping graph report generation.');
    return;
  }

  // Use a deep copy to avoid mutating the original graph object, which might be
  // used by other reporters. `structuredClone` is a modern and efficient way to do this.
  const graphCopy = structuredClone(graph);

  const reporterOptions = {
    baseDir: process.cwd(),
    ...options,
  };

  // Add visual attributes to the graph copy.
  enhanceGraphForVisualization(graphCopy, cycles, reporterOptions);

  logger.info(`Generating ${format.toUpperCase()} report...`);

  let graphString;
  try {
    if (format === REPORT_FORMATS.GEXF) {
      graphString = writeGexf(graphCopy);
    } else { // format is 'graphml'
      graphString = writeGraphml(graphCopy);
    }
  } catch (error) {
    const errorMessage = `Failed to serialize graph to ${format.toUpperCase()} format.`;
    logger.error(errorMessage, error);
    throw new Error(errorMessage, { cause: error });
  }


  try {
    const outputPath = path.resolve(outputFile);
    await fs.writeFile(outputPath, graphString, 'utf-8');
    logger.info(`Graph report successfully written to: ${outputPath}`);
  } catch (error) {
    const errorMessage = `Failed to write graph report to file: ${outputFile}`;
    logger.error(errorMessage, error);
    // Re-throw to allow the CLI to exit with a non-zero code, indicating failure.
    throw new Error(`${errorMessage}: ${error.message}`, { cause: error });
  }
}