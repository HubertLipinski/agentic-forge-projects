/**
 * @file src/graph/dependency-graph-builder.js
 * @description Orchestrates the static analysis process to build a dependency graph.
 *
 * This module takes a list of entry files, and recursively traverses their
 * dependencies to construct a complete, directed graph representing the
 * project's module structure. It uses the parser to get ASTs, the extractor
 * to find dependencies, and the resolver to find the absolute path of each dependency.
 */

import path from 'node:path';
import Graph from 'graphology';
import logger from '../utils/logger.js';
import { parseFile } from '../parser/ast-parser.js';
import { extractDependencies } from '../parser/dependency-extractor.js';
import { resolve as resolveModule } from '../resolver/module-resolver.js';

/**
 * @typedef {import('graphology').Graph} DependencyGraph
 */

/**
 * @typedef {object} BuildGraphOptions
 * @property {string[]} [exclude=[]] - An array of glob patterns to exclude from the analysis.
 */

/**
 * A Set to keep track of files that are currently being processed in the
 * recursion stack. This is used to prevent infinite loops in case of
 * synchronous, but non-cyclic, re-processing of the same file path.
 * @type {Set<string>}
 */
const processing = new Set();

/**
 * A Set to keep track of all files that have already been fully processed.
 * This prevents redundant work if a file is imported multiple times through
 * different paths.
 * @type {Set<string>}
 */
const processed = new Set();

/**
 * Recursively processes a file: parses it, extracts its dependencies,
 * resolves them, and adds them to the graph. It then continues the
 * process for each resolved dependency.
 *
 * @param {string} filePath - The absolute path of the file to process.
 * @param {DependencyGraph} graph - The graphology instance to populate.
 * @param {BuildGraphOptions} options - The build options, including exclusion patterns.
 * @returns {Promise<void>}
 */
async function processFile(filePath, graph, options) {
  // Normalize the file path to ensure consistency (e.g., drive letter casing on Windows).
  const normalizedFilePath = path.normalize(filePath);

  if (processing.has(normalizedFilePath) || processed.has(normalizedFilePath)) {
    logger.debug(`Skipping already visited file: ${normalizedFilePath}`);
    return;
  }

  logger.info(`Processing: ${normalizedFilePath}`);
  processing.add(normalizedFilePath);

  // Ensure the node for the current file exists in the graph.
  // This is important for files that might not import anything but are imported by others.
  if (!graph.hasNode(normalizedFilePath)) {
    graph.addNode(normalizedFilePath, {
      label: path.relative(process.cwd(), normalizedFilePath),
    });
  }

  const ast = await parseFile(normalizedFilePath);
  if (!ast) {
    logger.warn(`Could not generate AST for ${normalizedFilePath}. Skipping its dependencies.`);
    // Mark as processed to avoid retrying a failed parse.
    processing.delete(normalizedFilePath);
    processed.add(normalizedFilePath);
    return;
  }

  const dependencies = extractDependencies(ast, normalizedFilePath);
  if (dependencies.length === 0) {
    logger.debug(`No dependencies found in ${normalizedFilePath}.`);
  }

  // Create a list of promises for resolving all dependencies concurrently.
  const resolutionPromises = dependencies.map(async (dep) => {
    const resolvedPath = await resolveModule(dep.specifier, normalizedFilePath);
    if (resolvedPath) {
      const normalizedResolvedPath = path.normalize(resolvedPath);

      // Add the target node if it doesn't exist.
      if (!graph.hasNode(normalizedResolvedPath)) {
        graph.addNode(normalizedResolvedPath, {
          label: path.relative(process.cwd(), normalizedResolvedPath),
        });
      }

      // Add a directed edge from the current file to its dependency.
      // `addDirectedEdge` is idempotent; it won't create a duplicate edge.
      graph.addDirectedEdge(normalizedFilePath, normalizedResolvedPath, {
        specifier: dep.specifier,
        isDynamic: dep.isDynamic,
      });

      // Recurse into the resolved dependency.
      await processFile(normalizedResolvedPath, graph, options);
    } else {
      logger.debug(`Could not resolve '${dep.specifier}' from '${normalizedFilePath}'. Treating as external.`);
      // Optionally, we could add a node for the external module specifier for visualization.
      const externalNodeId = `external:${dep.specifier}`;
      if (!graph.hasNode(externalNodeId)) {
        graph.addNode(externalNodeId, {
          label: dep.specifier,
          isExternal: true,
        });
      }
      graph.addDirectedEdge(normalizedFilePath, externalNodeId);
    }
  });

  // Wait for all dependencies of the current file to be resolved and processed.
  await Promise.all(resolutionPromises);

  // Mark the current file as fully processed.
  processing.delete(normalizedFilePath);
  processed.add(normalizedFilePath);
}

/**
 * Builds a dependency graph from a list of entry files.
 * This is the main orchestrator for the graph construction phase.
 *
 * @param {string[]} entryFiles - An array of absolute paths to the entry files.
 * @param {BuildGraphOptions} [options={}] - Configuration options for the build process.
 * @returns {Promise<DependencyGraph>} A promise that resolves to the constructed `graphology` graph instance.
 */
export async function buildGraph(entryFiles, options = {}) {
  // Ensure options are defaulted properly.
  const buildOptions = {
    exclude: [],
    ...options,
  };

  // The graph is directed because imports have a clear source and target.
  const graph = new Graph({ type: 'directed', allowSelfLoops: true });

  // Clear tracking sets for a fresh run. This is important if `buildGraph`
  // is called multiple times in the same process (e.g., in tests or watch mode).
  processing.clear();
  processed.clear();

  logger.info('Starting dependency graph construction...');

  // Process all entry files concurrently.
  const processingPromises = entryFiles.map(entryFile =>
    processFile(path.resolve(entryFile), graph, buildOptions)
  );

  try {
    await Promise.all(processingPromises);
    logger.info(`Graph construction complete. Found ${graph.order} nodes and ${graph.size} edges.`);
  } catch (error) {
    logger.error('An unexpected error occurred during graph construction:', error);
    // Re-throw to allow the CLI to handle the fatal error.
    throw error;
  }

  return graph;
}