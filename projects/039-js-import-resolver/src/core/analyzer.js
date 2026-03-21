/**
 * @file src/core/analyzer.js
 * @description Orchestrates the analysis process by reading files, parsing imports,
 * and using the path resolver to identify broken module specifiers.
 */

import { promises as fs } from 'node:fs';
import { parseImportsAndExports } from '../utils/ast-parser.js';
import { resolvePath } from './path-resolver.js';
import { readFileContent } from '../utils/file-system.js';

/**
 * Analyzes a single file to find broken import/export specifiers.
 *
 * @param {string} filePath - The absolute path of the file to analyze.
 * @returns {Promise<{
 *   filePath: string,
 *   brokenImports: Array<{specifier: string, error: string}>,
 *   error?: string
 * }>} An object containing the analysis results for the file.
 * If the file cannot be read or parsed, the `error` property will be set.
 */
async function analyzeFile(filePath) {
  const fileResult = {
    filePath,
    brokenImports: [],
    error: undefined,
  };

  try {
    const content = await readFileContent(filePath);
    const { specifiers } = parseImportsAndExports(content);

    if (specifiers.size === 0) {
      return fileResult; // No imports/exports to analyze
    }

    const resolutionPromises = Array.from(specifiers).map(async (specifier) => {
      // Node.js built-in modules (e.g., 'fs', 'path') start with `node:`.
      // The resolver would fail on these, so we skip them.
      if (specifier.startsWith('node:')) {
        return null; // Indicates a valid, skipped import
      }

      const { resolvedPath, error } = await resolvePath(specifier, filePath);
      if (!resolvedPath) {
        return { specifier, error: error ?? 'Unknown resolution failure.' };
      }
      return null; // Indicates a successful resolution
    });

    const results = await Promise.all(resolutionPromises);
    fileResult.brokenImports = results.filter(Boolean);

  } catch (error) {
    fileResult.error = error instanceof Error ? error.message : String(error);
  }

  return fileResult;
}

/**
 * Orchestrates the analysis of multiple source files to find all broken imports.
 *
 * This function takes a list of file paths, analyzes each one concurrently,
 * and aggregates the results, filtering out files that have no issues.
 *
 * @param {string[]} filePaths - An array of absolute file paths to analyze.
 * @returns {Promise<Array<{
 *   filePath: string,
 *   brokenImports: Array<{specifier: string, error: string}>,
 *   error?: string
 * }>>} A promise that resolves to an array of analysis results for files
 * that contain broken imports or encountered an error during processing.
 * @throws {Error} If the `filePaths` argument is not a valid array.
 */
export async function analyzeProject(filePaths) {
  if (!Array.isArray(filePaths)) {
    throw new Error('Invalid input: "filePaths" must be an array of strings.');
  }

  if (filePaths.length === 0) {
    return [];
  }

  // Run analysis on all files concurrently for performance.
  const analysisPromises = filePaths.map(filePath => analyzeFile(filePath));
  const allResults = await Promise.all(analysisPromises);

  // Filter the results to include only files with errors or broken imports.
  const problematicFiles = allResults.filter(result => {
    return result.error || (result.brokenImports && result.brokenImports.length > 0);
  });

  return problematicFiles;
}