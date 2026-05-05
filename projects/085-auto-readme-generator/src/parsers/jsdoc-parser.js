import jsdoc from 'jsdoc-to-markdown';
import { glob } from 'glob';
import { pathExists } from '../utils/file-system.js';

/**
 * Custom error class for JSDoc parsing operations.
 */
class JSDocParserError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Optional parameters.
   * @param {Error} [options.cause] The original error that caused this one.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'JSDocParserError';
    if (options?.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }
}

/**
 * Parses JSDoc comments from specified source files and generates API documentation in Markdown format.
 * It uses glob patterns to find the files and then processes them with `jsdoc-to-markdown`.
 *
 * @param {string[]} entryFiles - An array of file paths or glob patterns for the source files.
 * @returns {Promise<string|null>} A promise that resolves with the generated Markdown string, or null if no files are found or no JSDoc comments are present.
 * @throws {JSDocParserError} If an error occurs during file globbing or Markdown generation.
 */
export async function parseJsdoc(entryFiles) {
  if (!entryFiles || entryFiles.length === 0) {
    // If no entry files are specified, it's not an error, just no API to document.
    return null;
  }

  let filesToParse;
  try {
    // Use glob to expand patterns and find all matching files.
    // `withFileTypes: false` ensures we get an array of path strings.
    filesToParse = await glob(entryFiles, { nodir: true, withFileTypes: false });
  } catch (error) {
    throw new JSDocParserError(`Failed to evaluate glob patterns for entry files: ${entryFiles.join(', ')}`, { cause: error });
  }

  if (filesToParse.length === 0) {
    console.warn(`[JSDoc Parser] No source files found for the provided patterns: ${entryFiles.join(', ')}. Skipping API documentation.`);
    return null;
  }

  // Verify that at least one of the resolved files actually exists.
  // This handles cases where glob returns a path that might be invalid.
  const existingFiles = (await Promise.all(filesToParse.map(async (file) => ({ file, exists: await pathExists(file) }))))
    .filter(item => item.exists)
    .map(item => item.file);

  if (existingFiles.length === 0) {
    console.warn(`[JSDoc Parser] The files matched by the glob patterns do not exist on disk. Skipping API documentation.`);
    return null;
  }

  try {
    const markdownOutput = await jsdoc.render({
      files: existingFiles,
      // You can add jsdoc-to-markdown options here if needed.
      // For example, to change the heading depth:
      // 'heading-depth': 3
    });

    // If the output is empty, it means no JSDoc comments were found to document.
    if (!markdownOutput || markdownOutput.trim() === '') {
      console.warn(`[JSDoc Parser] No JSDoc comments found in the specified files: ${existingFiles.join(', ')}. API section will be empty.`);
      return null;
    }

    return markdownOutput;
  } catch (error) {
    // Catch errors from jsdoc-to-markdown, which could be due to syntax issues or configuration problems.
    throw new JSDocParserError(`Failed to generate API documentation from JSDoc comments.`, { cause: error });
  }
}