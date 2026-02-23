/**
 * @file src/converter.js
 * @description Orchestrates the conversion of Markdown files to structured JSON.
 * This module provides high-level functions to convert a single file or a
 * collection of files (matched by a glob pattern) into a structured JSON format.
 * It integrates the file reading utilities and the core Markdown parser.
 */

import path from 'node:path';
import { glob } from 'glob';
import { readFileContent, isDirectory } from './utils/file-helpers.js';
import { parseMarkdown } from './parser.js';

/**
 * Converts a single Markdown file into a structured JSON object.
 *
 * The resulting object includes the parsed YAML front-matter as `attributes`
 * and the remaining Markdown content as `body`. It also includes the file's
 * path and name for context.
 *
 * @async
 * @param {string} filePath - The path to the Markdown file.
 * @returns {Promise<object>} A promise that resolves to an object with
 *          `filePath`, `fileName`, `attributes`, and `body`.
 * @throws {Error} Throws if the file cannot be read or the front-matter
 *                 is malformed.
 */
export async function convertFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid argument: `filePath` must be a non-empty string.');
  }

  try {
    const content = await readFileContent(filePath);
    const { attributes, body } = parseMarkdown(content);
    const fileName = path.basename(filePath);

    return {
      filePath,
      fileName,
      attributes,
      body,
    };
  } catch (error) {
    // Add context to errors bubbled up from readFileContent or parseMarkdown.
    // The original error is preserved in the `cause` property.
    const newError = new Error(`Failed to convert file '${filePath}': ${error.message}`);
    newError.cause = error;
    throw newError;
  }
}

/**
 * Converts all Markdown files found via a glob pattern or in a directory
 * into an array of structured JSON objects.
 *
 * This function handles three types of input paths:
 * 1. A glob pattern (e.g., 'content/**/*.md').
 * 2. A path to a directory (e.g., 'content/'). It will recursively find all
 *    `.md` and `.markdown` files within it.
 * 3. A path to a single file.
 *
 * It processes all matched files concurrently for performance.
 *
 * @async
 * @param {string} inputPath - A file path, directory path, or glob pattern.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of
 *          converted file objects, each matching the structure from `convertFile`.
 *          Returns an empty array if no files are matched.
 * @throws {Error} Throws if the glob pattern is invalid or if any file
 *                 processing fails.
 */
export async function convert(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Invalid argument: `inputPath` must be a non-empty string.');
  }

  let pattern = inputPath;

  // If the path is a directory, create a glob pattern to find all markdown files within it.
  if (await isDirectory(inputPath)) {
    // Use path.join to handle trailing slashes correctly.
    // The pattern `**/*.{md,markdown}` recursively finds files with these extensions.
    pattern = path.join(inputPath, '**', '*.{md,markdown}');
  }

  let filePaths;
  try {
    // `glob` finds all files matching the pattern.
    // `windowsPathsNoEscape` is important for cross-platform compatibility.
    filePaths = await glob(pattern, { nodir: true, windowsPathsNoEscape: true });
  } catch (error) {
    const newError = new Error(`Invalid glob pattern or path '${inputPath}': ${error.message}`);
    newError.cause = error;
    throw newError;
  }

  if (filePaths.length === 0) {
    // It's not an error to find no files; simply return an empty result.
    return [];
  }

  // Process all files concurrently using Promise.all for efficiency.
  const conversionPromises = filePaths.map(filePath => convertFile(filePath));

  // `Promise.all` will reject if any of the file conversions fail,
  // effectively stopping the entire process and propagating the error.
  const results = await Promise.all(conversionPromises);

  return results;
}