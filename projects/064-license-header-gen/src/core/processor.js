/**
 * @file src/core/processor.js
 * @description Core logic for processing individual source files to add or update license headers.
 *
 * This module orchestrates the process for a single file: reading its content,
 * detecting if a license header already exists, and then deciding whether to
 * add a new header, replace an existing one, or skip the file. It also handles
 * the "dry-run" mode to preview changes without modifying the file system.
 */

import { readFileContent, writeFileContent } from '../utils/file-system.js';
import { buildHeader } from './header-builder.js';

/**
 * An enumeration for the status of a file after processing.
 * @readonly
 * @enum {string}
 */
export const FileStatus = {
  /** The file was updated with a new or replaced header. */
  UPDATED: 'updated',
  /** A new header was added to the file. */
  ADDED: 'added',
  /** The file already had a valid, up-to-date header. */
  SKIPPED: 'skipped',
  /** The file was not modified due to dry-run mode. */
  DRY_RUN: 'dry-run',
  /** The file could not be processed due to an error. */
  ERROR: 'error',
};

/**
 * Generates a regular expression to detect an existing license header.
 * The regex is designed to be non-greedy and match a block that starts
 * with the comment delimiter and contains the word "Copyright" or "License".
 *
 * @param {import('../utils/comment-styles.js').CommentStyle} commentStyle - The comment style for the file type.
 * @returns {RegExp} A regular expression for finding a license header.
 */
function createHeaderRegex(commentStyle) {
  // Escape special regex characters in the comment start delimiter.
  const start = commentStyle.start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // A flexible pattern to find "Copyright" or "License", case-insensitive.
  // This makes detection more robust against minor variations.
  const contentPattern = '(?:Copyright|License)';

  // The regex looks for the start of the file (^), optional whitespace (\s*),
  // the escaped comment start delimiter, and then anything (.*?) until it finds
  // the content pattern. The `s` flag allows `.` to match newlines, and `i` makes
  // the pattern case-insensitive.
  return new RegExp(`^\\s*${start}.*?${contentPattern}.*?$`, 'is');
}

/**
 * Removes a shebang (e.g., #!/usr/bin/env node) from the file content.
 *
 * @param {string} content - The original file content.
 * @returns {{shebang: string | null, content: string}} An object containing the shebang and the rest of the content.
 */
function stripShebang(content) {
  const shebangMatch = content.match(/^#![^\r\n]*/);
  if (shebangMatch) {
    const shebang = shebangMatch[0];
    // Return the shebang and the content that follows it, preserving newlines.
    const remainingContent = content.substring(shebang.length);
    return { shebang, content: remainingContent.trimStart() };
  }
  return { shebang: null, content };
}

/**
 * Processes a single source file to add or update its license header.
 *
 * It reads the file, checks for an existing header, and if necessary,
 * replaces it or adds a new one. It respects the dry-run flag,
 * logging intended changes without writing them.
 *
 * @param {object} options - The processing options for the file.
 * @param {string} options.filePath - The absolute path to the file to process.
 * @param {string} options.newHeader - The fully formatted new header string.
 * @param {import('../utils/comment-styles.js').CommentStyle} options.commentStyle - The comment style for this file type.
 * @param {boolean} options.isDryRun - If true, no changes will be written to disk.
 * @returns {Promise<FileStatus>} The status of the file after processing.
 */
export async function processFile({ filePath, newHeader, commentStyle, isDryRun }) {
  try {
    const originalContent = await readFileContent(filePath);

    // Preserve shebang if it exists, as it must be the first line.
    const { shebang, content: contentWithoutShebang } = stripShebang(originalContent);

    const headerRegex = createHeaderRegex(commentStyle);
    const existingHeaderMatch = contentWithoutShebang.match(headerRegex);

    let contentWithoutHeader = contentWithoutShebang;
    let status = FileStatus.ADDED;

    if (existingHeaderMatch) {
      // Find the end of the comment block to correctly remove it.
      const endDelimiter = commentStyle.end ?? commentStyle.start;
      const endDelimiterEscaped = endDelimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fullHeaderRegex = new RegExp(
        `^\\s*?${headerRegex.source.slice(1, -3)}.*?${endDelimiterEscaped}\\s*`, // Reconstruct regex to find the whole block
        's'
      );

      const fullHeaderMatch = contentWithoutShebang.match(fullHeaderRegex);

      if (fullHeaderMatch) {
        const oldHeader = fullHeaderMatch[0];
        // If the old header is identical to the new one, we can skip.
        if (oldHeader.trim() === newHeader.trim()) {
          return FileStatus.SKIPPED;
        }
        contentWithoutHeader = contentWithoutShebang.substring(oldHeader.length);
        status = FileStatus.UPDATED;
      }
    }

    // In dry-run mode, we report what would have happened and return.
    if (isDryRun) {
      // If the status is SKIPPED, it would have returned earlier.
      // Any other status means a change is pending.
      return FileStatus.DRY_RUN;
    }

    // Construct the final content, re-attaching the shebang if it existed.
    const shebangPart = shebang ? `${shebang}\n` : '';
    // Ensure a blank line separates the header from the code, but avoid triple newlines.
    const separator = contentWithoutHeader.startsWith('\n') ? '' : '\n';
    const finalContent = `${shebangPart}${newHeader}\n${separator}${contentWithoutHeader}`;

    await writeFileContent(filePath, finalContent);

    return status;
  } catch (error) {
    console.error(`Error processing file "${filePath}": ${error.message}`);
    return FileStatus.ERROR;
  }
}