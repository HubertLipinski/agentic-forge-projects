/**
 * @file src/core/path-resolver.js
 * @description Core logic to resolve module specifiers against the file system,
 * respecting package.json 'exports' and 'imports' fields, and Node.js ESM resolution rules.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { findProjectRoot } from '../utils/file-system.js';

/**
 * A cache for parsed package.json files to avoid redundant I/O and parsing.
 * The key is the directory path containing the package.json.
 * @type {Map<string, object>}
 */
const packageJsonCache = new Map();

/**
 * A cache for resolved paths to speed up repeated lookups of the same specifier.
 * The key is a unique combination of the specifier and the importing file's directory.
 * @type {Map<string, string | null>}
 */
const resolutionCache = new Map();

/**
 * Asynchronously reads and parses a `package.json` file, using a cache to avoid re-reading.
 *
 * @param {string} dirPath - The directory containing the `package.json`.
 * @returns {Promise<object | null>} The parsed package.json object, or null if not found or invalid.
 */
async function readPackageJson(dirPath) {
  if (packageJsonCache.has(dirPath)) {
    return packageJsonCache.get(dirPath);
  }

  const packagePath = path.join(dirPath, 'package.json');
  try {
    const content = await fs.readFile(packagePath, 'utf-8');
    const parsed = JSON.parse(content);
    packageJsonCache.set(dirPath, parsed);
    return parsed;
  } catch (error) {
    // It's common for a directory not to have a package.json, so we return null.
    // JSON parsing errors are also treated as "not found" for our purposes.
    packageJsonCache.set(dirPath, null);
    return null;
  }
}

/**
 * Checks if a given file path exists and is a file.
 *
 * @param {string} filePath - The absolute path to check.
 * @returns {Promise<boolean>} True if the path is an existing file, false otherwise.
 */
async function fileExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Resolves a module specifier relative to an importing file, trying common extensions.
 * Follows Node.js ESM resolution for relative paths.
 *
 * @param {string} specifier - The relative module specifier (e.g., './utils').
 * @param {string} importerDir - The absolute path of the directory containing the importing file.
 * @returns {Promise<string | null>} The resolved absolute file path, or null if not found.
 */
async function resolveAsFileOrDirectory(specifier, importerDir) {
  const absolutePath = path.resolve(importerDir, specifier);
  const extensions = ['.js', '.mjs', '.cjs', '.json', '.node'];

  // 1. Try as a file with extensions
  for (const ext of extensions) {
    if (await fileExists(absolutePath + ext)) {
      return absolutePath + ext;
    }
  }

  // 2. If it's a directory, look for an index file
  try {
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      for (const ext of extensions) {
        const indexPath = path.join(absolutePath, 'index' + ext);
        if (await fileExists(indexPath)) {
          return indexPath;
        }
      }
    }
  } catch {
    // If fs.stat fails, it's not a directory, which is fine.
  }

  // 3. Try as a file itself (e.g., import './foo.js')
  if (await fileExists(absolutePath)) {
    return absolutePath;
  }

  return null;
}

/**
 * Resolves a bare module specifier (e.g., 'lodash') by searching in `node_modules`.
 *
 * @param {string} specifier - The bare module specifier.
 * @param {string} importerDir - The directory of the importing file.
 * @returns {Promise<string | null>} The path to the main entry file of the module, or null.
 */
async function resolveAsNodeModule(specifier, importerDir) {
  let currentDir = importerDir;
  const projectRoot = await findProjectRoot(importerDir);

  while (true) {
    const modulePath = path.join(currentDir, 'node_modules', specifier);
    const packageJson = await readPackageJson(modulePath);

    if (packageJson) {
      // Respect 'exports' field if present (modern ESM)
      if (packageJson.exports) {
        // Simplified 'exports' handling: we look for the default '.' entry.
        // A full implementation would need to handle conditional exports.
        const mainExport = packageJson.exports['.'] ?? packageJson.exports;
        if (typeof mainExport === 'string') {
          return path.resolve(modulePath, mainExport);
        }
      }

      // Fallback to 'module' or 'main'
      const mainFile = packageJson.module ?? packageJson.main;
      if (mainFile) {
        return path.resolve(modulePath, mainFile);
      }
    }

    // If we've checked the project root and found nothing, stop.
    if (currentDir === projectRoot) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Resolves a module specifier according to Node.js ESM resolution rules.
 * Caches results to improve performance on subsequent identical requests.
 *
 * @param {string} specifier - The module specifier (e.g., 'lodash', './utils', '#helpers').
 * @param {string} importingFilePath - The absolute path of the file containing the import.
 * @returns {Promise<{resolvedPath: string | null, error: string | null}>} An object containing the resolved path or an error message.
 */
export async function resolvePath(specifier, importingFilePath) {
  const importerDir = path.dirname(importingFilePath);
  const cacheKey = `${specifier}__FROM__${importerDir}`;

  if (resolutionCache.has(cacheKey)) {
    const cachedResult = resolutionCache.get(cacheKey);
    return { resolvedPath: cachedResult, error: cachedResult ? null : 'Resolution failed (cached)' };
  }

  let resolvedPath = null;

  try {
    if (specifier.startsWith('/') || specifier.startsWith('file:/')) {
      // Absolute path. Not typically used but handle it.
      const absolutePath = specifier.startsWith('file:/') ? new URL(specifier).pathname : specifier;
      resolvedPath = await fileExists(absolutePath) ? absolutePath : null;
    } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
      // Relative path
      resolvedPath = await resolveAsFileOrDirectory(specifier, importerDir);
    } else if (specifier.startsWith('#')) {
      // Package 'imports' field. Not yet implemented.
      // A full implementation would read the nearest package.json and resolve from its 'imports' map.
      // For now, we treat it as unresolvable.
      return { resolvedPath: null, error: `Resolution for package 'imports' ('${specifier}') is not yet supported.` };
    } else {
      // Bare specifier (node_module)
      resolvedPath = await resolveAsNodeModule(specifier, importerDir);
    }
  } catch (error) {
    // Catch unexpected errors during resolution and report them.
    return { resolvedPath: null, error: `An unexpected error occurred while resolving '${specifier}': ${error.message}` };
  }

  resolutionCache.set(cacheKey, resolvedPath);

  if (resolvedPath) {
    return { resolvedPath, error: null };
  }

  return { resolvedPath: null, error: `Module not found: Cannot resolve '${specifier}' from '${importingFilePath}'.` };
}

/**
 * Clears all internal caches. Primarily used for testing.
 */
export function clearResolutionCache() {
  packageJsonCache.clear();
  resolutionCache.clear();
}