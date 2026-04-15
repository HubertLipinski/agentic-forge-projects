/**
 * @file src/utils/comment-styles.js
 * @description Defines comment syntax styles for various programming languages.
 * This module provides a centralized mapping of file extensions to their
 * corresponding comment block or line comment syntax. This allows the
 * license header generator to apply the correct formatting for each file type.
 */

/**
 * An enumeration for comment style types.
 * @readonly
 * @enum {string}
 */
export const CommentStyleType = {
  /** Represents a block comment (e.g., /* ... * /). */
  BLOCK: 'block',
  /** Represents a line-by-line comment (e.g., # ...). */
  LINE: 'line',
};

/**
 * @typedef {object} CommentStyle
 * @property {CommentStyleType} type - The type of comment style ('block' or 'line').
 * @property {string} start - The starting delimiter for the comment. For line comments, this is the per-line prefix.
 * @property {string} [middle] - The prefix for each line within a block comment (optional). Typically a space followed by an asterisk.
 * @property {string} [end] - The ending delimiter for a block comment (optional).
 */

/**
 * A map of file extensions to their corresponding comment style definitions.
 * The key is the file extension (including the dot), and the value is a
 * {@link CommentStyle} object.
 *
 * This map is designed to be easily extensible to support new languages.
 *
 * @type {Readonly<Map<string, CommentStyle>>}
 */
export const commentStyles = new Map(
  Object.entries({
    // C-style block comments
    '.js': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.mjs': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.cjs': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.ts': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.mts': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.cts': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.jsx': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.tsx': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.css': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.scss': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.less': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.java': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.go': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.c': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.h': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.cpp': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.hpp': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.cs': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },
    '.php': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.rs': {
      type: CommentStyleType.BLOCK,
      start: '/*!',
      middle: ' *',
      end: ' */',
    },
    '.swift': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.kt': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.kts': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.scala': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.groovy': {
      type: CommentStyleType.BLOCK,
      start: '/**',
      middle: ' *',
      end: ' */',
    },
    '.sql': {
      type: CommentStyleType.BLOCK,
      start: '/*',
      middle: ' *',
      end: ' */',
    },

    // Hash-based line comments
    '.py': { type: CommentStyleType.LINE, start: '#' },
    '.sh': { type: CommentStyleType.LINE, start: '#' },
    '.bash': { type: CommentStyleType.LINE, start: '#' },
    '.zsh': { type: CommentStyleType.LINE, start: '#' },
    '.rb': { type: CommentStyleType.LINE, start: '#' },
    '.pl': { type: CommentStyleType.LINE, start: '#' },
    '.pm': { type: CommentStyleType.LINE, start: '#' },
    '.t': { type: CommentStyleType.LINE, start: '#' }, // Perl test files
    '.yml': { type: CommentStyleType.LINE, start: '#' },
    '.yaml': { type: CommentStyleType.LINE, start: '#' },
    '.toml': { type: CommentStyleType.LINE, start: '#' },
    '.dockerfile': { type: CommentStyleType.LINE, start: '#' },
    'Dockerfile': { type: CommentStyleType.LINE, start: '#' }, // Handle extension-less Dockerfile

    // Other line comment styles
    '.lua': { type: CommentStyleType.LINE, start: '--' },
    '.vb': { type: CommentStyleType.LINE, start: "'" },

    // XML-style block comments
    '.xml': { type: CommentStyleType.BLOCK, start: '<!--', end: '-->' },
    '.html': { type: CommentStyleType.BLOCK, start: '<!--', end: '-->' },
    '.htm': { type: CommentStyleType.BLOCK, start: '<!--', end: '-->' },
    '.svg': { type: CommentStyleType.BLOCK, start: '<!--', end: '-->' },
    '.vue': { type: CommentStyleType.BLOCK, start: '<!--', end: '-->' }, // For the <template> part
  }),
);

/**
 * Retrieves the comment style for a given file extension.
 *
 * @param {string} extension - The file extension (e.g., '.js', '.py').
 * @returns {CommentStyle | undefined} The comment style object if found, otherwise undefined.
 */
export function getCommentStyle(extension) {
  return commentStyles.get(extension);
}