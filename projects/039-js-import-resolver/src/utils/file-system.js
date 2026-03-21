import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';

/**
 * A cache for the determined project root to avoid redundant lookups.
 * @type {string | null}
 */
let projectRootCache = null;

/**
 * Asynchronously reads the content of a file.
 *
 * @param {string} filePath - The absolute or relative path to the file.
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {Error} If the file cannot be read (e.g., it doesn't exist or permissions are denied).
 */
export async function readFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    // Provide a more context-rich error message
    if (error.code === 'ENOENT') {
      throw new Error(`File not found at path: ${filePath}`);
    }
    if (error.code === 'EACCES') {
      throw new Error(`Permission denied to read file at path: ${filePath}`);
    }
    // Re-throw other unexpected errors
    throw new Error(`Failed to read file '${filePath}': ${error.message}`);
  }
}

/**
 * Finds the project root by searching upwards from a given directory for a `package.json` file.
 * The result is cached for subsequent calls.
 *
 * @param {string} [startDir=process.cwd()] - The directory to start the search from.
 * @returns {Promise<string>} A promise that resolves with the absolute path to the project root directory.
 * @throws {Error} If no `package.json` is found in the directory hierarchy.
 */
export async function findProjectRoot(startDir = process.cwd()) {
  if (projectRootCache) {
    return projectRootCache;
  }

  let currentDir = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      await fs.access(packageJsonPath);
      projectRootCache = currentDir;
      return currentDir;
    } catch {
      // `fs.access` throws if the file doesn't exist, so we continue upwards.
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // We've reached the filesystem root (e.g., '/') without finding package.json
      throw new Error('Could not find a package.json in the project structure. Please run this command from within a Node.js project.');
    }
    currentDir = parentDir;
  }
}

/**
 * Resets the cached project root. Primarily for testing purposes.
 */
export function clearProjectRootCache() {
  projectRootCache = null;
}

/**
 * Scans a directory for JavaScript files using fast-glob, respecting specified patterns and ignore rules.
 *
 * @param {string} baseDir - The base directory to start scanning from.
 * @param {string[]} [patterns=['**/*.{js,mjs,cjs}']] - Glob patterns to match files.
 * @param {string[]} [ignorePatterns=['**/node_modules/**', '**/dist/**']] - Glob patterns to ignore.
 * @returns {Promise<string[]>} A promise that resolves with an array of absolute file paths.
 */
export async function findSourceFiles(
  baseDir,
  patterns = ['**/*.{js,mjs,cjs}'],
  ignorePatterns = ['**/node_modules/**', '**/dist/**']
) {
  try {
    const files = await fg(patterns, {
      cwd: baseDir,
      absolute: true,
      ignore: ignorePatterns,
      dot: false, // Ignore dotfiles like .git, .vscode, etc.
      onlyFiles: true,
    });
    return files;
  } catch (error) {
    throw new Error(`Failed to scan for source files in '${baseDir}': ${error.message}`);
  }
}

/**
 * Converts a file URL (like `import.meta.url`) to an absolute file path.
 *
 * @param {string} fileUrl - The file URL to convert.
 * @returns {string} The corresponding absolute file path.
 */
export function getPathFromURL(fileUrl) {
  return fileURLToPath(fileUrl);
}