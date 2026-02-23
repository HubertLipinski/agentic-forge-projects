/**
 * @file src/index.js
 * @description Main library entry point for programmatic usage.
 *
 * This module exports the primary functions for converting Markdown files or
 * directories into structured JSON. It serves as the public API for developers
 * who want to use this package as a library in their own Node.js projects.
 *
 * The functions are designed to be robust, asynchronous, and easy to integrate.
 * They abstract away the underlying file system and parsing logic, providing
 * a simple interface for content conversion.
 *
 * @module md-front-matter-json
 * @example
 * import { convertFile, convertDirectory } from 'md-front-matter-json';
 *
 * // Convert a single file
 * const singleFileData = await convertFile('./content/post.md');
 * console.log(singleFileData);
 *
 * // Convert all markdown files in a directory
 * const allPostsData = await convertDirectory('./content/posts');
 * console.log(allPostsData);
 */

import { convert, convertFile as convertSingleFile } from './converter.js';

/**
 * Converts a single Markdown file into a structured JSON object.
 *
 * The resulting object includes the parsed YAML front-matter as `attributes`
 * and the remaining Markdown content as `body`. It also includes the file's
 * path and name for context. This is a direct export of the core file
 * conversion logic.
 *
 * @async
 * @function convertFile
 * @param {string} filePath - The path to the Markdown file.
 * @returns {Promise<object>} A promise that resolves to an object with
 *          `filePath`, `fileName`, `attributes`, and `body`.
 * @throws {Error} Throws if the file cannot be read or the front-matter
 *                 is malformed.
 * @example
 * const data = await convertFile('path/to/your/file.md');
 * // data = {
 * //   filePath: 'path/to/your/file.md',
 * //   fileName: 'file.md',
 * //   attributes: { title: 'Hello World' },
 * //   body: '# This is the content'
 * // }
 */
export const convertFile = convertSingleFile;

/**
 * Converts all Markdown files found in a directory or matching a glob pattern
 * into an array of structured JSON objects.
 *
 * This function handles three types of input paths:
 * 1. A path to a directory (e.g., 'content/'). It will recursively find all
 *    `.md` and `.markdown` files within it.
 * 2. A glob pattern (e.g., 'content/**/*.md').
 * 3. A path to a single file (in which case it returns an array with one item).
 *
 * It processes all matched files concurrently for performance.
 *
 * @async
 * @function convertDirectory
 * @param {string} inputPath - A directory path or a glob pattern.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of
 *          converted file objects. Returns an empty array if no files are matched.
 * @throws {Error} Throws if the glob pattern is invalid or if any file
 *                 processing fails.
 * @example
 * const posts = await convertDirectory('path/to/posts');
 * // posts = [
 * //   { filePath: '...', fileName: 'post1.md', ... },
 * //   { filePath: '...', fileName: 'post2.md', ... }
 * // ]
 */
export const convertDirectory = convert;

/**
 * Default export providing access to all primary functions.
 * This allows for a different import style if preferred.
 *
 * @default
 * @type {{convertFile: Function, convertDirectory: Function}}
 * @example
 * import markdownConverter from 'md-front-matter-json';
 * const data = await markdownConverter.convertFile('path/to/file.md');
 */
export default {
  convertFile,
  convertDirectory,
};