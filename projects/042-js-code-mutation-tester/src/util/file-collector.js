import { glob } from 'glob';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';

// Although glob supports promises natively, let's ensure we handle potential callback-style usage
// or older versions gracefully. This is good practice for robustness.
const globPromise = promisify(glob);

/**
 * A utility class to encapsulate file collection logic.
 * It finds source and test files based on glob patterns from the configuration,
 * respecting ignore patterns.
 */
class FileCollector {
  /**
   * @param {object} config - The merged configuration object.
   * @param {string[]} config.sourceFiles - Glob patterns for source files to mutate.
   * @param {string[]} config.testFiles - Glob patterns for test files to run.
   * @param {string[]} config.ignorePatterns - Glob patterns for files/directories to ignore.
   */
  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('FileCollector requires a valid configuration object.');
    }
    this.config = config;
  }

  /**
   * Executes a glob search with provided patterns and ignore rules.
   *
   * @param {string|string[]} patterns - The glob pattern(s) to match.
   * @param {string[]} ignore - An array of glob patterns to ignore.
   * @returns {Promise<string[]>} A promise that resolves to an array of absolute file paths.
   * @private
   */
  async _findFiles(patterns, ignore) {
    if (!patterns || patterns.length === 0) {
      return [];
    }

    try {
      // The `glob` package handles arrays of patterns automatically.
      // We use `absolute: true` to ensure all paths are unambiguous.
      const files = await glob(patterns, {
        ignore,
        nodir: true, // We only want files, not directories
        absolute: true,
        dot: true, // Include files starting with a dot
      });
      // Normalize paths to use forward slashes for cross-platform consistency.
      return files.map(file => path.normalize(file).replace(/\\/g, '/'));
    } catch (error) {
      // This might happen with malformed glob patterns.
      throw new Error(`Failed to execute glob pattern search: ${error.message}`);
    }
  }

  /**
   * Finds all source files to be mutated based on the configuration.
   *
   * @returns {Promise<string[]>} An array of absolute paths to source files.
   */
  async collectSourceFiles() {
    const { sourceFiles, ignorePatterns } = this.config;
    return this._findFiles(sourceFiles, ignorePatterns);
  }

  /**
   * Finds all test files to be run for each mutation.
   *
   * @returns {Promise<string[]>} An array of absolute paths to test files.
   */
  async collectTestFiles() {
    const { testFiles, ignorePatterns } = this.config;
    return this._findFiles(testFiles, ignorePatterns);
  }

  /**
   * Collects both source and test files in parallel.
   *
   * @returns {Promise<{sourceFiles: string[], testFiles: string[]}>} An object containing arrays of source and test file paths.
   */
  async collect() {
    const startTime = performance.now();

    try {
      const [sourceFiles, testFiles] = await Promise.all([
        this.collectSourceFiles(),
        this.collectTestFiles(),
      ]);

      const duration = (performance.now() - startTime).toFixed(2);

      return {
        sourceFiles,
        testFiles,
        durationMs: parseFloat(duration),
      };
    } catch (error) {
      // Propagate errors from underlying find operations.
      console.error('Error during file collection:', error.message);
      // Re-throwing allows the caller (e.g., the CLI) to handle the exit.
      throw error;
    }
  }
}

/**
 * A factory function to create and use a FileCollector to gather all relevant files.
 * This is the main export of the module.
 *
 * @param {object} config - The merged configuration object.
 * @returns {Promise<{sourceFiles: string[], testFiles: string[], durationMs: number}>} An object with the collected file paths and collection duration.
 */
export async function collectAllFiles(config) {
  const collector = new FileCollector(config);
  return collector.collect();
}