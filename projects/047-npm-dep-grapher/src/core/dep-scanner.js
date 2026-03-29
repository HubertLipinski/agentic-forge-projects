/**
 * @file src/core/dep-scanner.js
 * @description The core logic for scanning the `node_modules` directory. It uses a
 *              queue-based, breadth-first search (BFS) approach to recursively explore
 *              dependencies and build an in-memory graph representation.
 */

import path from 'path';
import { readJsonFile, pathExists } from '../utils/file-reader.js';
import { GraphNode, DependencyType } from '../graph/graph-node.js';
import logger from '../utils/logger.js';

/**
 * @typedef {import('../graph/graph-node.js').GraphNode} GraphNode
 */

/**
 * @typedef {object} ScanOptions
 * @property {string} entrypoint - The absolute path to the root `package.json`.
 * @property {boolean} [includeDev=true] - Whether to include devDependencies.
 * @property {number} [depth=Infinity] - The maximum depth to scan.
 * @property {Map<string, GraphNode>} [workspacePackages=new Map()] - Pre-identified monorepo packages.
 */

/**
 * @typedef {object} ScanResult
 * @property {Map<string, GraphNode>} graph - The complete dependency graph.
 * @property {string} rootNodeId - The ID of the root node in the graph.
 */

/**
 * Represents a task in the scanning queue.
 * @typedef {object} ScanQueueItem
 * @property {string} parentId - The ID of the node that requires this dependency.
 * @property {string} parentPath - The filesystem path of the parent node's directory.
 * @property {string} dependencyName - The name of the dependency to resolve.
 * @property {string} requiredVersion - The version range required by the parent.
 * @property {DependencyType} dependencyType - The type of the dependency (prod, dev, etc.).
 * @property {number} currentDepth - The current traversal depth.
 */

/**
 * Scans the project's dependencies starting from a root `package.json` and builds a dependency graph.
 *
 * This function orchestrates the entire scanning process. It starts with the root package,
 * adds its dependencies to a queue, and then processes the queue item by item. For each
 * item, it resolves the dependency's location in `node_modules`, creates a graph node for it,
 * and adds its sub-dependencies back into the queue, continuing until the queue is empty
 * or the maximum depth is reached.
 *
 * @param {ScanOptions} options - The configuration for the scan.
 * @returns {Promise<ScanResult>} A promise that resolves to an object containing the graph and the root node ID.
 */
export async function scanDependencies({
  entrypoint,
  includeDev = true,
  depth = Infinity,
  workspacePackages = new Map(),
}) {
  logger.info(`Starting dependency scan from: ${entrypoint}`);
  logger.debug(`Scan options: includeDev=${includeDev}, depth=${depth}`);

  const graph = new Map(workspacePackages);
  const queue = [];

  // 1. Create the root node for the project itself.
  const rootPackageJson = await readJsonFile(entrypoint);
  if (!rootPackageJson) {
    throw new Error(`Failed to read root package.json at ${entrypoint}. Cannot proceed.`);
  }

  const rootNode = new GraphNode({
    name: rootPackageJson.name || 'root-project',
    version: rootPackageJson.version || '0.0.0',
    path: path.dirname(entrypoint),
  });
  graph.set(rootNode.id, rootNode);

  // 2. Seed the queue with the root node's dependencies.
  enqueueDependencies(rootNode, { includeDev, depth, queue });

  // 3. Process the queue until it's empty.
  while (queue.length > 0) {
    const currentItem = queue.shift();

    // Resolve the dependency and potentially add more items to the queue.
    await processQueueItem(currentItem, { graph, queue, includeDev, depth, workspacePackages });
  }

  logger.info(`Scan complete. Found ${graph.size} unique packages.`);
  return { graph, rootNodeId: rootNode.id };
}

/**
 * Processes a single item from the dependency scan queue.
 * It resolves the dependency's location, creates or retrieves its graph node,
 * links it to its parent, and enqueues its own dependencies for further scanning.
 *
 * @param {ScanQueueItem} item - The queue item to process.
 * @param {object} context - The context of the ongoing scan.
 * @param {Map<string, GraphNode>} context.graph - The main dependency graph.
 * @param {ScanQueueItem[]} context.queue - The scan queue.
 * @param {boolean} context.includeDev - Whether to include devDependencies.
 * @param {number} context.depth - The maximum scan depth.
 * @param {Map<string, GraphNode>} context.workspacePackages - Pre-identified monorepo packages.
 */
async function processQueueItem(item, { graph, queue, includeDev, depth, workspacePackages }) {
  const { parentId, parentPath, dependencyName, requiredVersion, dependencyType, currentDepth } = item;

  // Check if we've exceeded the maximum depth.
  if (currentDepth > depth) {
    logger.debug(`Skipping "${dependencyName}" from "${parentId}" - exceeds max depth.`);
    return;
  }

  // Handle internal workspace packages first.
  if (workspacePackages.has(dependencyName)) {
    const workspaceNode = workspacePackages.get(dependencyName);
    const parentNode = graph.get(parentId);
    if (parentNode) {
      parentNode.resolveDependency(dependencyName, workspaceNode.id);
    }
    // Don't scan dependencies of workspace packages here; they are scanned from their own context.
    return;
  }

  // Resolve the dependency's path and get its package.json.
  const resolvedPath = await resolveDependencyPath(dependencyName, parentPath);
  if (!resolvedPath) {
    logger.warn(`Could not resolve path for dependency "${dependencyName}" required by "${parentId}". It may be an optional dependency that is not installed.`);
    return;
  }

  const packageJsonPath = path.join(resolvedPath, 'package.json');
  const packageJson = await readJsonFile(packageJsonPath);
  if (!packageJson) {
    logger.warn(`Could not read package.json for resolved dependency "${dependencyName}" at "${resolvedPath}".`);
    return;
  }

  const { name, version } = packageJson;
  const nodeId = GraphNode.generateId(name, version);

  // Link the parent to this resolved child node.
  const parentNode = graph.get(parentId);
  if (parentNode) {
    parentNode.resolveDependency(dependencyName, nodeId);
  }

  // If we've already processed this exact package version, we don't need to do it again.
  if (graph.has(nodeId)) {
    logger.debug(`Already processed ${nodeId}, skipping dependency enqueue.`);
    return;
  }

  // Create a new node for this dependency and add it to the graph.
  const newNode = new GraphNode({ name, version, path: resolvedPath });
  graph.set(nodeId, newNode);
  logger.debug(`Added new node to graph: ${nodeId}`);

  // Enqueue the new node's dependencies for the next level of scanning.
  enqueueDependencies(newNode, { includeDev, depth, queue, currentDepth });
}

/**
 * Gathers dependencies from a package's `package.json` and adds them to the scan queue.
 *
 * @param {GraphNode} node - The graph node whose dependencies are to be enqueued.
 * @param {object} options - Configuration for enqueuing.
 * @param {boolean} options.includeDev - Whether to include devDependencies.
 * @param {number} options.depth - The maximum scan depth.
 * @param {ScanQueueItem[]} options.queue - The scan queue.
 * @param {number} [options.currentDepth=0] - The depth of the current node.
 */
async function enqueueDependencies(node, { includeDev, depth, queue, currentDepth = 0 }) {
  if (currentDepth >= depth) {
    return;
  }

  const packageJsonPath = path.join(node.path, 'package.json');
  const packageJson = await readJsonFile(packageJsonPath);
  if (!packageJson) {
    logger.warn(`Cannot enqueue dependencies for "${node.id}"; package.json not found at "${packageJsonPath}".`);
    return;
  }

  const dependencyTypesToScan = [
    { type: DependencyType.PROD, deps: packageJson.dependencies },
    { type: DependencyType.OPTIONAL, deps: packageJson.optionalDependencies },
    { type: DependencyType.PEER, deps: packageJson.peerDependencies },
  ];

  if (includeDev) {
    dependencyTypesToScan.push({ type: DependencyType.DEV, deps: packageJson.devDependencies });
  }

  for (const { type, deps } of dependencyTypesToScan) {
    if (!deps) continue;

    for (const [depName, requiredVersion] of Object.entries(deps)) {
      node.addDependency(depName, requiredVersion, type);

      const queueItem = {
        parentId: node.id,
        parentPath: node.path,
        dependencyName: depName,
        requiredVersion,
        dependencyType: type,
        currentDepth: currentDepth + 1,
      };
      queue.push(queueItem);
    }
  }
}

/**
 * Simulates Node.js's `require.resolve` logic to find a dependency's directory.
 * It searches for the dependency in `node_modules` directories, starting from the
 * `parentPath` and moving up the directory tree.
 *
 * @param {string} dependencyName - The name of the package to find.
 * @param {string} parentPath - The directory path of the package that requires the dependency.
 * @returns {Promise<string | null>} The absolute path to the dependency's directory, or null if not found.
 */
async function resolveDependencyPath(dependencyName, parentPath) {
  let currentPath = parentPath;

  while (currentPath) {
    const potentialPath = path.join(currentPath, 'node_modules', dependencyName);

    if (await pathExists(potentialPath)) {
      return potentialPath;
    }

    const parent = path.dirname(currentPath);
    if (parent === currentPath) {
      // Reached the filesystem root (e.g., '/'), stop searching.
      break;
    }
    currentPath = parent;
  }

  return null; // Not found
}