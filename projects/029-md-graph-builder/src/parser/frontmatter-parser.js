import matter from 'gray-matter';

/**
 * @fileoverview
 * This module provides functionality to parse YAML front-matter from a Markdown
 * file's content. It uses the 'gray-matter' library to safely extract metadata
 * and the main content body. This metadata can then be attached as attributes
 * to nodes in the content graph.
 */

/**
 * @typedef {object} ParsedContent
 * @property {object} metadata - An object containing the parsed front-matter data.
 *   If no front-matter is found, this will be an empty object.
 * @property {string} content - The content of the file after the front-matter.
 *   If no front-matter is found, this will be the original file content.
 */

/**
 * Parses a string containing Markdown and potential YAML front-matter.
 *
 * This function takes the raw string content of a file and uses 'gray-matter'
 * to separate the front-matter (metadata) from the body (content). It is a
 * pure function that operates solely on the input string without any I/O.
 *
 * It gracefully handles cases where no front-matter is present, returning an
 * empty metadata object and the original content.
 *
 * @param {string} fileContent - The raw string content of the file to parse.
 * @returns {Promise<ParsedContent>} A promise that resolves to an object
 *   containing the `metadata` and `content`.
 * @throws {Error} If `fileContent` is not a string.
 * @throws {Error} If 'gray-matter' encounters a parsing error (e.g., malformed YAML).
 */
export async function parseFrontmatter(fileContent) {
  if (typeof fileContent !== 'string') {
    throw new Error('The "fileContent" argument must be a string.');
  }

  try {
    // gray-matter is synchronous but can be CPU-intensive for large files.
    // Wrapping in a Promise maintains an async API consistent with other
    // parsers and I/O operations in the project.
    const { data, content } = matter(fileContent);

    return {
      metadata: data ?? {}, // Ensure metadata is always an object
      content: content,
    };
  } catch (error) {
    // 'gray-matter' can throw errors for malformed YAML.
    // We catch this and provide a more informative error message.
    console.error('Error parsing front-matter:', error.message);
    throw new Error(`Failed to parse front-matter. Reason: ${error.message}`);
  }
}