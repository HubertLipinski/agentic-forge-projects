/**
 * @file src/file-processor.js
 * @description Handles reading a directory or a single file, filtering for JSON files, and parsing their content.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import logger from './utils/logger.js';

/**
 * Represents the parsed content of a single JSON file.
 * @typedef {object} FileContent
 * @property {string} filePath - The absolute path to the file.
 * @property {string} target - The name of the collection/table, derived from the file's basename.
 * @property {object | object[]} data - The parsed JSON data from the file.
 */

/**
 * Asynchronously reads the content of a file and parses it as JSON.
 *
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<FileContent | null>} A promise that resolves with the file content object, or null if parsing fails.
 */
async function readAndParseFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    const target = path.basename(filePath, '.json');

    return { filePath, target, data };
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.warn(`Skipping file due to JSON parsing error: ${filePath}. Details: ${error.message}`);
    } else {
      logger.error(`Failed to read file: ${filePath}. Details: ${error.message}`);
    }
    return null;
  }
}

/**
 * Processes a single file path. If it's a JSON file, it reads and parses it.
 *
 * @param {string} filePath - The absolute path to the file.
 * @returns {Promise<FileContent[]>} A promise that resolves to an array containing the parsed file content, or an empty array if the file is not a valid JSON file.
 */
async function processSingleFile(filePath) {
  if (path.extname(filePath).toLowerCase() !== '.json') {
    logger.warn(`Skipping non-JSON file: ${filePath}`);
    return [];
  }

  const fileContent = await readAndParseFile(filePath);
  return fileContent ? [fileContent] : [];
}

/**
 * Reads a directory, filters for `.json` files, and parses each one.
 *
 * @param {string} dirPath - The absolute path to the directory.
 * @returns {Promise<FileContent[]>} A promise that resolves to an array of parsed file contents.
 */
async function processDirectory(dirPath) {
  logger.info(`Scanning directory: ${dirPath}`);
  const dirents = await fs.readdir(dirPath, { withFileTypes: true });

  const jsonFiles = dirents
    .filter(dirent => dirent.isFile() && path.extname(dirent.name).toLowerCase() === '.json')
    .map(dirent => path.join(dirPath, dirent.name));

  if (jsonFiles.length === 0) {
    logger.warn(`No JSON files found in directory: ${dirPath}`);
    return [];
  }

  const fileReadPromises = jsonFiles.map(readAndParseFile);
  const results = await Promise.all(fileReadPromises);

  // Filter out any files that failed to read or parse (they will be null)
  return results.filter(Boolean);
}

/**
 * Processes a given path, which can be a single file or a directory.
 * It determines the type of path and delegates to the appropriate handler.
 *
 * @param {string} inputPath - The path to a file or directory.
 * @returns {Promise<FileContent[]>} A promise that resolves to an array of objects, each representing a parsed JSON file.
 * @throws {Error} If the path does not exist.
 */
export async function processPath(inputPath) {
  const absolutePath = path.resolve(inputPath);
  let stats;

  try {
    stats = await fs.stat(absolutePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Path not found: ${absolutePath}`);
    }
    // Re-throw other unexpected errors
    throw error;
  }

  if (stats.isDirectory()) {
    return processDirectory(absolutePath);
  } else if (stats.isFile()) {
    return processSingleFile(absolutePath);
  } else {
    // This case handles things like sockets, FIFOs, etc., which are not supported.
    throw new Error(`Unsupported path type. Path must be a file or a directory: ${absolutePath}`);
  }
}