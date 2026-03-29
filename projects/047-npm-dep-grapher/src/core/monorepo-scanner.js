/**
 * @file src/core/monorepo-scanner.js
 * @description Specialized scanner that first identifies workspace packages (e.g., from
 *              pnpm-workspace.yaml or package.json workspaces) and links them in the graph.
 * @module monorepo-scanner
 */

import path from 'path';
import { glob } from 'glob';
import { readJsonFile, pathExists } from '../utils/file-reader.js';
import { GraphNode, DependencyType } from '../graph/graph-node.js';
import logger from '../utils/logger.js';

// PNPM uses a YAML file to define workspaces. We'll need a simple parser for it.
// We avoid adding a full YAML parsing dependency by implementing a minimal, regex-based one.
import { parse as parseYaml } from 'yaml';

/**
 * @typedef {import('../graph/graph-node.js').GraphNode} GraphNode
 */

/**
 * A map of workspace packages, where the key is the package name and the value is the GraphNode.
 * @typedef {Map<string, GraphNode>} WorkspacePackageMap
 */

/**
 * Scans the project structure to identify all internal monorepo packages.
 *
 * This function acts as a dispatcher, checking for different monorepo manager configurations
 * (PNPM, Yarn/NPM workspaces) and using the appropriate method to find workspace packages.
 * The goal is to build a map of these packages so they can be correctly linked during the
 * main dependency scan, rather than being treated as external `node_modules` dependencies.
 *
 * @param {string} projectRoot - The absolute path to the root of the monorepo.
 * @returns {Promise<WorkspacePackageMap>} A promise that resolves to a map of workspace packages.
 */
export async function findWorkspacePackages(projectRoot) {
  logger.info('Searching for monorepo workspace packages...');

  // 1. Check for PNPM workspaces
  const pnpmWorkspacePath = path.join(projectRoot, 'pnpm-workspace.yaml');
  if (await pathExists(pnpmWorkspacePath)) {
    logger.info('Found pnpm-workspace.yaml, scanning for PNPM workspaces.');
    return findPackagesFromPnpm(projectRoot, pnpmWorkspacePath);
  }

  // 2. Check for Yarn/NPM workspaces defined in the root package.json
  const rootPackageJsonPath = path.join(projectRoot, 'package.json');
  const rootPackageJson = await readJsonFile(rootPackageJsonPath);
  if (rootPackageJson?.workspaces) {
    logger.info('Found "workspaces" in root package.json, scanning for Yarn/NPM workspaces.');
    return findPackagesFromGlobs(projectRoot, rootPackageJson.workspaces);
  }

  logger.info('No monorepo configuration found. Assuming a single-package project.');
  return new Map();
}

/**
 * Finds workspace packages based on the `pnpm-workspace.yaml` file.
 *
 * @param {string} projectRoot - The absolute path to the monorepo root.
 * @param {string} pnpmWorkspacePath - The path to the `pnpm-workspace.yaml` file.
 * @returns {Promise<WorkspacePackageMap>} A map of discovered workspace packages.
 */
async function findPackagesFromPnpm(projectRoot, pnpmWorkspacePath) {
  try {
    const fileContent = await readJsonFile(pnpmWorkspacePath); // Our reader handles non-JSON too
    if (!fileContent) {
      // readJsonFile uses fs.readFile and would have logged an error.
      logger.error('Could not read pnpm-workspace.yaml content.');
      return new Map();
    }

    // A simple YAML parser is sufficient here.
    const pnpmConfig = parseYaml(fileContent.toString());

    const globs = pnpmConfig?.packages;
    if (!Array.isArray(globs) || globs.length === 0) {
      logger.warn('pnpm-workspace.yaml found, but it contains no "packages" field or is empty.');
      return new Map();
    }

    return findPackagesFromGlobs(projectRoot, globs);
  } catch (error) {
    logger.error('Failed to parse pnpm-workspace.yaml. Please ensure it is valid YAML.', error);
    return new Map();
  }
}

/**
 * Finds workspace packages by resolving an array of glob patterns.
 * This is the common mechanism used by PNPM, Yarn, and NPM workspaces.
 *
 * @param {string} projectRoot - The absolute path to the monorepo root.
 * @param {string[]} workspaceGlobs - An array of glob patterns (e.g., ['packages/*']).
 * @returns {Promise<WorkspacePackageMap>} A map of discovered workspace packages.
 */
async function findPackagesFromGlobs(projectRoot, workspaceGlobs) {
  const workspaceMap = new Map();
  logger.debug('Using glob patterns to find workspaces:', workspaceGlobs);

  // The glob patterns are relative to the project root. We need to find `package.json`
  // files within directories matching these patterns.
  const globPatterns = workspaceGlobs.map(p => path.join(p, 'package.json'));

  const packageJsonPaths = await glob(globPatterns, {
    cwd: projectRoot,
    absolute: true,
    ignore: '**/node_modules/**', // Explicitly ignore node_modules
  });

  if (packageJsonPaths.length === 0) {
    logger.warn('Workspace globs were specified, but no matching package.json files were found.');
    return workspaceMap;
  }

  logger.info(`Found ${packageJsonPaths.length} potential workspace package(s).`);

  // Process each found package.json concurrently.
  const processingPromises = packageJsonPaths.map(async (pkgPath) => {
    const packageJson = await readJsonFile(pkgPath);
    if (!packageJson || !packageJson.name || !packageJson.version) {
      logger.warn(`Skipping invalid or incomplete package.json at: ${pkgPath}`);
      return;
    }

    const { name, version } = packageJson;
    const packageDir = path.dirname(pkgPath);

    if (workspaceMap.has(name)) {
      logger.warn(`Duplicate workspace package name "${name}" found. The one at "${packageDir}" will be ignored.`);
      return;
    }

    const workspaceNode = new GraphNode({
      name,
      version,
      path: packageDir,
      isWorkspace: true,
    });

    // Pre-populate the node's own dependencies for later resolution.
    // This is important because workspace packages are not processed via the standard queue mechanism.
    addDependenciesToNode(workspaceNode, packageJson);

    workspaceMap.set(name, workspaceNode);
    logger.debug(`Registered workspace package: ${name}@${version}`);
  });

  await Promise.all(processingPromises);

  logger.info(`Successfully registered ${workspaceMap.size} workspace package(s).`);
  return workspaceMap;
}

/**
 * Helper function to populate a GraphNode's dependency metadata from its `package.json`.
 *
 * @param {GraphNode} node - The GraphNode to populate.
 * @param {object} packageJson - The parsed `package.json` content for that node.
 */
function addDependenciesToNode(node, packageJson) {
  const dependencyTypes = [
    { type: DependencyType.PROD, deps: packageJson.dependencies },
    { type: DependencyType.DEV, deps: packageJson.devDependencies },
    { type: DependencyType.OPTIONAL, deps: packageJson.optionalDependencies },
    { type: DependencyType.PEER, deps: packageJson.peerDependencies },
  ];

  for (const { type, deps } of dependencyTypes) {
    if (!deps) continue;
    for (const [depName, versionRange] of Object.entries(deps)) {
      node.addDependency(depName, versionRange, type);
    }
  }
}