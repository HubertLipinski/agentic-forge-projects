/**
 * @file src/analysis/version-resolver.js
 * @description Contains logic using the `semver` package to check if a resolved package
 *              version satisfies the required version range and flags conflicts.
 * @module version-resolver
 */

import semver from 'semver';
import logger from '../utils/logger.js';

/**
 * @typedef {import('../graph/graph-node.js').GraphNode} GraphNode
 */

/**
 * @typedef {object} VersionConflict
 * @property {string} parentId - The ID of the parent node that requires the dependency.
 * @property {string} dependencyName - The name of the dependency with a conflict.
 * @property {string} requiredVersion - The version range required by the parent.
 * @property {string} resolvedVersion - The actual version that was resolved and installed.
 */

/**
 * Analyzes the entire dependency graph to find version conflicts.
 *
 * A version conflict occurs when a package depends on a version range of another
 * package, but the version that is actually resolved and present in `node_modules`
 * does not satisfy that range. This often happens in complex dependency trees where
 * multiple packages depend on different versions of the same sub-dependency, and npm's
 * hoisting mechanism picks one version to place at the top level.
 *
 * @param {Map<string, GraphNode>} graph - The complete dependency graph, where keys are
 *   node IDs (e.g., 'react@18.2.0') and values are GraphNode objects.
 * @returns {VersionConflict[]} An array of objects, each describing a single version conflict.
 */
export function findVersionConflicts(graph) {
  logger.info('Analyzing dependency versions for conflicts...');
  const conflicts = [];

  // Iterate over every node in the graph, as each one can have dependencies.
  for (const [parentId, parentNode] of graph.entries()) {
    if (!parentNode || !parentNode.dependencies) {
      continue;
    }

    // For each dependency of the current node, check if the resolved version is valid.
    for (const [depName, requiredVersion] of Object.entries(parentNode.dependencies)) {
      // The `requiredVersion` is the version string from the parent's `package.json` (e.g., "^1.2.3", ">=2.0.0").
      // We need to find which version of `depName` was actually resolved for this parent.
      // In a flattened `node_modules` structure, this is typically the single version
      // hoisted to the top, or a nested version if there was a conflict npm had to resolve.
      // Our graph model stores this resolved link.

      // The `depNodeId` from the parent's dependency map points to the resolved node.
      const resolvedNodeId = parentNode.resolvedDependencies?.[depName];
      if (!resolvedNodeId) {
        // This can happen if a dependency was optional and not installed, or if the
        // graph construction failed for this link. We can't check what's not there.
        logger.debug(`Skipping version check for "${depName}" from "${parentId}" because it has no resolved node link.`);
        continue;
      }

      const resolvedNode = graph.get(resolvedNodeId);
      if (!resolvedNode) {
        // This indicates a broken link in our graph data structure.
        logger.warn(`Could not find resolved node with ID "${resolvedNodeId}" for dependency "${depName}" of "${parentId}".`);
        continue;
      }

      const resolvedVersion = resolvedNode.version;

      // Use semver to check if the resolved version satisfies the required range.
      const isSatisfied = checkVersionSatisfaction(resolvedVersion, requiredVersion);

      if (!isSatisfied) {
        // A conflict is found!
        const conflict = {
          parentId,
          dependencyName: depName,
          requiredVersion,
          resolvedVersion,
        };
        conflicts.push(conflict);
        logger.debug(`Conflict found: ${parentId} requires ${depName}@${requiredVersion}, but resolved to ${resolvedVersion}.`);
      }
    }
  }

  if (conflicts.length > 0) {
    logger.warn(`Found ${conflicts.length} version conflict(s).`);
  } else {
    logger.info('No version conflicts found.');
  }

  return conflicts;
}

/**
 * Checks if a given version satisfies a semantic versioning range.
 *
 * This function is a robust wrapper around `semver.satisfies`. It handles edge cases
 * like non-standard version ranges (e.g., git URLs, file paths) which `semver`
 * cannot parse. For such cases, it assumes satisfaction, as the package manager
 * would have already handled the resolution.
 *
 * @param {string} version - The actual version to check (e.g., "1.2.4"). Must be a valid semver version.
 * @param {string} range - The required version range (e.g., "^1.2.3", ">=2.0.0 <3.0.0").
 * @returns {boolean} `true` if the version satisfies the range or if the range is not a
 *                    valid semver range (implying a URL, git repo, etc.); `false` otherwise.
 */
export function checkVersionSatisfaction(version, range) {
  // Ensure the version itself is valid before checking. If not, we can't make a comparison.
  if (!semver.valid(version)) {
    logger.debug(`Cannot check satisfaction for invalid version "${version}". Assuming it does not satisfy range "${range}".`);
    return false;
  }

  // semver.validRange returns null for non-standard ranges like git URLs, file paths, or aliases.
  // In these cases, npm/yarn/pnpm has already resolved it. We assume it's "satisfied"
  // because our goal is to find semver mismatches, not installation failures.
  if (semver.validRange(range) === null) {
    logger.debug(`Range "${range}" is not a standard semver range (e.g., git URL, file path). Assuming satisfaction.`);
    return true;
  }

  try {
    // The core check. `semver.satisfies` returns true if the version is within the range.
    // The `includePrerelease` option is important for ranges like `^1.0.0-alpha.1`.
    return semver.satisfies(version, range, { includePrerelease: true });
  } catch (error) {
    // This is a safeguard, though `semver.satisfies` is generally stable.
    logger.error(`An unexpected error occurred in semver.satisfies with version "${version}" and range "${range}".`, error);
    return false; // Fail safe
  }
}