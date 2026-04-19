/**
 * @file src/parser/markdown-parser.js
 * @description Contains the core logic for reading Markdown files and
 * extracting all link URLs using regular expressions.
 */

import { promises as fs } from 'node:fs';
import { MARKDOWN_LINK_REGEX } from '../util/constants.js';

/**
 * Represents a link found within a Markdown file.
 * @typedef {object} MarkdownLink
 * @property {string} url - The URL of the link (e.g., 'https://example.com' or '../docs/another-file.md').
 * @property {string} text - The anchor text of the link (e.g., 'click here').
 * @property {string} file - The absolute path to the Markdown file where the link was found.
 * @property {number} line - The line number in the file where the link was found.
 */

/**
 * A private helper function to find the line number of a character index within a string.
 * This is more efficient than splitting the entire content into an array of lines for each match.
 *
 * @param {string} content - The full string content of the file.
 * @param {number} index - The character index of the match within the content.
 * @returns {number} The 1-based line number.
 */
function getLineNumber(content, index) {
  // Substring up to the index and count the newline characters.
  // Add 1 because line numbers are 1-based.
  const newlines = content.substring(0, index).match(/\n/g) || [];
  return newlines.length + 1;
}

/**
 * Extracts all links from a given string of Markdown content.
 * It uses a regular expression to find both standard and reference-style links.
 *
 * @param {string} content - The Markdown content as a string.
 * @param {string} filePath - The path to the file from which the content was read.
 * @returns {MarkdownLink[]} An array of MarkdownLink objects found in the content.
 */
export function extractLinks(content, filePath) {
  const links = [];
  let match;

  // The regex uses a global flag 'g', so we can repeatedly call exec()
  // to find all matches in the content.
  while ((match = MARKDOWN_LINK_REGEX.exec(content)) !== null) {
    // The regex has two main parts separated by `|`:
    // 1. `\[([^\]]+?)\]\((?!#)([^)]+?)\)` for inline links like [text](url)
    //    - match[1] is the text, match[2] is the URL.
    // 2. `\[([^\]]+?)\]:\s*([^\s]+)` for reference-style links like [text]: url
    //    - match[3] is the text, match[4] is the URL.

    const text = match[1] || match[3];
    let url = match[2] || match[4];

    // Ignore empty URLs that can result from malformed links like `[]()`
    if (!url) {
      continue;
    }

    // Trim whitespace and remove potential title attributes from the URL part, e.g., `(url "title")`
    url = url.trim().split(' ')[0];

    links.push({
      url,
      text: text.trim(),
      file: filePath,
      line: getLineNumber(content, match.index),
    });
  }

  return links;
}

/**
 * Reads a Markdown file from the given path and extracts all links.
 * This function orchestrates reading the file and then parsing its content.
 *
 * @param {string} filePath - The absolute or relative path to the Markdown file.
 * @returns {Promise<MarkdownLink[]>} A promise that resolves to an array of MarkdownLink objects.
 * @throws {Error} If the file cannot be read (e.g., it doesn't exist or permissions are denied).
 */
export async function parseMarkdownFile(filePath) {
  try {
    const content = await fs.readFile(filePath, { encoding: 'utf8' });
    return extractLinks(content, filePath);
  } catch (error) {
    // Add context to the original error message for better debugging.
    const errorMessage = `Failed to read or parse file: ${filePath}. Reason: ${error.message}`;
    // Re-throw a new error with a more descriptive message, while preserving the original cause.
    throw new Error(errorMessage, { cause: error });
  }
}