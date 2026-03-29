/**
 * @file src/graph/graph-node.js
 * @description A class representing a single node in the dependency graph. Each node
 *              corresponds to a specific version of a package.
 * @module graph-node
 */

/**
 * Represents the type of dependency relationship between two packages.
 * @readonly
 * @enum {string}
 */
export const DependencyType = {
  PROD: 'prod',
  DEV: 'dev',
  PEER: 'peer',
  OPTIONAL: 'optional',
  ROOT: 'root', // Special type for the main project package
  WORKSPACE: 'workspace', // For internal monorepo packages
};

/**
 * A class representing a node in the dependency graph.
 * Each instance corresponds to a specific version of a package found during the scan.
 */
export class GraphNode {
  /**
   * A unique identifier for this node, typically in the format `name@version`.
   * For the root project, it might just be the project name.
   * @type {string}
   */
  id;

  /**
   * The name of the package.
   * @type {string}
   */
  name;

  /**
   * The resolved version of the package.
   * @type {string}
   */
  version;

  /**
   * The absolute path to the `package.json` file for this node.
   * @type {string}
   */
  path;

  /**
   * Indicates if this node is an internal workspace package in a monorepo.
   * @type {boolean}
   */
  isWorkspace;

  /**
   * Stores metadata about the dependencies declared by this package.
   * The key is the dependency name (e.g., 'react'), and the value is an object
   * containing the required version range and the type of dependency.
   * Example: `{'react': { version: '^18.2.0', type: 'prod' }}`
   * @type {Object<string, {version: string, type: DependencyType}>}
   */
  dependencyMeta;

  /**
   * Maps dependency names to the unique ID (`GraphNode.id`) of the node that
   * satisfies the dependency in the graph. This represents the resolved dependency link.
   * Example: `{'react': 'react@18.2.0'}`
   * @type {Object<string, string>}
   */
  resolvedDependencies;

  /**
   * Creates an instance of GraphNode.
   *
   * @param {object} options - The configuration for the node.
   * @param {string} options.name - The name of the package.
   * @param {string} options.version - The resolved version of the package.
   * @param {string} options.path - The absolute path to the package's directory.
   * @param {boolean} [options.isWorkspace=false] - Whether this is a monorepo workspace package.
   */
  constructor({ name, version, path, isWorkspace = false }) {
    if (!name || !version || !path) {
      throw new Error('GraphNode requires name, version, and path to be specified.');
    }

    this.id = GraphNode.generateId(name, version);
    this.name = name;
    this.version = version;
    this.path = path;
    this.isWorkspace = isWorkspace;

    this.dependencyMeta = {};
    this.resolvedDependencies = {};
  }

  /**
   * Adds a dependency relationship to this node.
   * This records what this package requires, but does not yet resolve it.
   *
   * @param {string} name - The name of the dependency package.
   * @param {string} versionRange - The version range required (e.g., '^1.2.3').
   * @param {DependencyType} type - The type of the dependency (e.g., 'prod', 'dev').
   */
  addDependency(name, versionRange, type) {
    if (!name || !versionRange || !type) {
      // This would indicate a parsing error upstream, so we should be strict.
      throw new Error('Cannot add dependency with missing name, versionRange, or type.');
    }
    this.dependencyMeta[name] = { version: versionRange, type };
  }

  /**
   * Links a dependency to its resolved node in the graph.
   *
   * @param {string} dependencyName - The name of the dependency being resolved.
   * @param {string} resolvedNodeId - The unique ID of the GraphNode that satisfies this dependency.
   */
  resolveDependency(dependencyName, resolvedNodeId) {
    if (!this.dependencyMeta[dependencyName]) {
      // This might happen with optional dependencies that are not in package.json but are resolved.
      // Or it could be a logic error. For now, we'll allow it but it's worth noting.
      // A stricter implementation might throw an error here.
    }
    this.resolvedDependencies[dependencyName] = resolvedNodeId;
  }

  /**
   * Generates a standardized, unique ID for a graph node from its name and version.
   *
   * @param {string} name - The package name.
   * @param {string} version - The package version.
   * @returns {string} The unique node ID (e.g., 'react@18.2.0').
   */
  static generateId(name, version) {
    return `${name}@${version}`;
  }
}