import { glob } from 'glob';
import path from 'node:path';
import { SUPPORTED_EXTENSIONS } from '../constants.js';

/**
 * @typedef {object} FileScannerOptions
 * @property {string[]} [include=['**/*']] - An array of glob patterns to include.
 * @property {string[]} [exclude=['**/node_modules/**']] - An array of glob patterns to exclude.
 * @property {string[]} [extensions=SUPPORTED_EXTENSIONS] - An array of file extensions to match.
 */

/**
 * Asynchronously scans a directory for Markdown files based on specified patterns.
 *
 * This function recursively searches for files within the `baseDir` that match the
 * provided extensions. It uses glob patterns for fine-grained control over which
 * files and directories to include or exclude.
 *
 * @param {string} baseDir - The absolute path to the directory to start scanning from.
 * @param {FileScannerOptions} [options={}] - Configuration for the file scan.
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute file paths
 *   for the matched Markdown files. The paths are sorted for consistent output.
 * @throws {Error} If `baseDir` is not a valid string or if the glob scan fails.
 */
export async function findMarkdownFiles(baseDir, options = {}) {
  if (typeof baseDir !== 'string' || baseDir.trim() === '') {
    throw new Error('The "baseDir" argument must be a non-empty string.');
  }

  const {
    include = ['**/*'],
    exclude = ['**/node_modules/**'],
    extensions = SUPPORTED_EXTENSIONS,
  } = options;

  // Construct a glob pattern that matches any of the specified extensions.
  // e.g., '**/*.{md,markdown}'
  const extensionPattern = `.{${extensions.join(',')}}`;

  // Combine the include patterns with the extension pattern.
  // e.g., ['docs/**/*.md', 'blog/**/*.md'] becomes ['docs/**/*.{md,markdown}', 'blog/**/*.{md,markdown}']
  const patterns = include.map(p => p.endsWith('/') ? `${p}*${extensionPattern}` : `${p}${extensionPattern}`);

  try {
    const files = await glob(patterns, {
      cwd: baseDir,
      ignore: exclude,
      nodir: true, // Ensure we only get files, not directories
      absolute: true, // Return absolute paths
      dot: true, // Include files starting with a dot (e.g., .README.md)
    });

    // Sort the results for deterministic behavior.
    files.sort();

    return files;
  } catch (error) {
    // Catch potential errors from the glob library, e.g., invalid patterns.
    console.error(`Error scanning for files in '${baseDir}':`, error);
    throw new Error(`Failed to scan for Markdown files. Reason: ${error.message}`);
  }
}