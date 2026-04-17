/**
 * @file src/resolver/module-resolver.js
 * @description Implements the core Node.js module resolution logic.
 *
 * This module provides a function to resolve module specifiers to absolute file paths,
 * mimicking the behavior of the Node.js runtime for both CommonJS and ES Modules.
 * It handles relative paths, absolute paths, bare specifiers (node_modules),
 * and package.json "exports" and "imports" fields.
 *
 * This implementation is a simplified version of the full Node.js resolution
 * algorithm, focusing on the features most relevant to static analysis.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../utils/logger.js';
import { SUPPORTED_EXTENSIONS } from '../constants.js';

/**
 * A cache to store resolved package.json contents to avoid redundant file I/O.
 * Maps directory paths to their parsed package.json object.
 * @type {Map<string, object | null>}
 */
const packageJsonCache = new Map();

/**
 * A cache to store the results of `resolve` calls.
 * Key is a composite string `specifier::from`, value is the resolved path or null.
 * @type {Map<string, string | null>}
 */
const resolutionCache = new Map();

/**
 * Reads and parses a package.json file from a given directory.
 * Results are cached to improve performance.
 *
 * @param {string} dirPath - The directory containing the package.json.
 * @returns {Promise<object | null>} The parsed package.json object, or null if not found or invalid.
 */
async function readPackageJson(dirPath) {
  if (packageJsonCache.has(dirPath)) {
    return packageJsonCache.get(dirPath);
  }

  const pkgPath = path.join(dirPath, 'package.json');
  try {
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    packageJsonCache.set(dirPath, pkg);
    return pkg;
  } catch (error) {
    // ENOENT is an expected error if no package.json exists.
    if (error.code !== 'ENOENT') {
      logger.warn(`[Resolver] Failed to read or parse ${pkgPath}: ${error.message}`);
    }
    packageJsonCache.set(dirPath, null); // Cache the failure to avoid retries.
    return null;
  }
}

/**
 * Finds the nearest `package.json` file by traversing up from a starting directory.
 *
 * @param {string} startDir - The directory to start searching from.
 * @returns {Promise<{path: string, content: object} | null>} An object containing the path and content of the package.json, or null if not found.
 */
async function findNearestPackageJson(startDir) {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) {
    const pkg = await readPackageJson(currentDir);
    if (pkg) {
      return { path: path.join(currentDir, 'package.json'), content: pkg };
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

/**
 * Tries to resolve a file path by appending supported extensions or checking for an index file.
 *
 * @param {string} filePath - The base path to resolve (e.g., './utils/helpers').
 * @returns {Promise<string | null>} The resolved absolute path with extension, or null if not found.
 */
async function resolveFileExtensions(filePath) {
  // 1. Try as-is (e.g., `import './styles.css'`)
  try {
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      return filePath;
    }
  } catch {
    // Ignore error, proceed to next steps
  }

  // 2. Try with supported extensions
  for (const ext of SUPPORTED_EXTENSIONS) {
    const pathWithExt = `${filePath}${ext}`;
    try {
      const stats = await fs.stat(pathWithExt);
      if (stats.isFile()) {
        return pathWithExt;
      }
    } catch {
      // File doesn't exist, continue to next extension
    }
  }

  // 3. Try as a directory with an index file
  for (const ext of SUPPORTED_EXTENSIONS) {
    const indexPath = path.join(filePath, `index${ext}`);
    try {
      const stats = await fs.stat(indexPath);
      if (stats.isFile()) {
        return indexPath;
      }
    } catch {
      // Index file doesn't exist, continue
    }
  }

  return null;
}

/**
 * Resolves a bare specifier (e.g., 'react', 'lodash/fp') by searching in `node_modules`.
 *
 * @param {string} specifier - The module specifier.
 * @param {string} from - The absolute path of the importing file.
 * @returns {Promise<string | null>} The resolved path to the module's entry point, or null.
 */
async function resolveNodeModules(specifier, from) {
  const fromDir = path.dirname(from);
  let currentDir = fromDir;

  // Traverse up the directory tree to find node_modules
  while (currentDir !== path.dirname(currentDir)) {
    const potentialPath = path.join(currentDir, 'node_modules', specifier);
    const resolved = await resolveFileExtensions(potentialPath);
    if (resolved) {
      return resolved;
    }

    // If not a direct file, check for package.json `main` or `exports`
    const pkgDir = path.join(currentDir, 'node_modules', specifier);
    const pkg = await readPackageJson(pkgDir);
    if (pkg) {
      let entryPoint = pkg.main || 'index.js';
      // A simplified "exports" check. A full implementation is very complex.
      if (typeof pkg.exports === 'string') {
        entryPoint = pkg.exports;
      } else if (typeof pkg.exports === 'object' && pkg.exports?.['.']) {
        entryPoint = pkg.exports['.'];
      }

      const fullEntryPointPath = path.resolve(pkgDir, entryPoint);
      const resolvedEntryPoint = await resolveFileExtensions(fullEntryPointPath);
      if (resolvedEntryPoint) {
        return resolvedEntryPoint;
      }
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Resolves a module specifier to an absolute file path.
 * This function orchestrates the resolution logic for different types of specifiers.
 *
 * @param {string} specifier - The module specifier (e.g., './utils', 'react').
 * @param {string} from - The absolute path of the file that contains the import/require.
 * @returns {Promise<string | null>} A promise that resolves to the absolute path of the module,
 *   or `null` if the module cannot be resolved.
 */
export async function resolve(specifier, from) {
  if (!specifier) {
    return null;
  }

  const cacheKey = `${specifier}::${from}`;
  if (resolutionCache.has(cacheKey)) {
    return resolutionCache.get(cacheKey);
  }

  let resolvedPath = null;

  try {
    // Handle `node:` built-in modules
    if (specifier.startsWith('node:')) {
      // We don't analyze built-in modules, so we treat them as resolved but external.
      resolvedPath = null;
    }
    // Handle absolute paths
    else if (path.isAbsolute(specifier)) {
      resolvedPath = await resolveFileExtensions(specifier);
    }
    // Handle relative paths
    else if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const absolutePath = path.resolve(path.dirname(from), specifier);
      resolvedPath = await resolveFileExtensions(absolutePath);
    }
    // Handle package.json "imports" (e.g., '#internal/...')
    else if (specifier.startsWith('#')) {
      const pkgInfo = await findNearestPackageJson(path.dirname(from));
      if (pkgInfo?.content.imports?.[specifier]) {
        const importTarget = pkgInfo.content.imports[specifier];
        const pkgRoot = path.dirname(pkgInfo.path);
        const absolutePath = path.resolve(pkgRoot, importTarget);
        resolvedPath = await resolveFileExtensions(absolutePath);
      }
    }
    // Handle bare specifiers (node_modules)
    else {
      resolvedPath = await resolveNodeModules(specifier, from);
    }
  } catch (error) {
    logger.warn(`[Resolver] Error resolving '${specifier}' from '${from}':`, error);
    resolvedPath = null;
  }

  if (!resolvedPath) {
    logger.debug(`[Resolver] Could not resolve '${specifier}' from '${from}'`);
  } else {
    logger.debug(`[Resolver] Resolved '${specifier}' from '${from}' to '${resolvedPath}'`);
  }

  resolutionCache.set(cacheKey, resolvedPath);
  return resolvedPath;
}

/**
 * Clears all internal caches used by the resolver.
 * This is useful for testing or running in a watch mode.
 */
export function clearCache() {
  packageJsonCache.clear();
  resolutionCache.clear();
  logger.debug('[Resolver] Caches cleared.');
}