/**
 * @file src/utils/file-reader.js
 * @description Asynchronous file reading utilities, optimized for safely reading and
 *              parsing thousands of `package.json` files. Includes caching to avoid
 *              re-reading and re-parsing the same file multiple times during a scan.
 */

import { promises as fs } from 'fs';
import path from 'path';
import logger from './logger.js';

/**
 * An in-memory cache to store the parsed content of `package.json` files.
 * The key is the absolute file path, and the value is the parsed JSON object.
 * This prevents redundant file I/O and JSON parsing for the same file,
 * which is common in dependency resolution.
 * @type {Map<string, object>}
 */
const fileCache = new Map();

/**
 * Clears the internal file cache.
 * Useful for testing or running multiple scans in a single process.
 */
export function clearCache() {
  fileCache.clear();
  logger.debug('File reader cache cleared.');
}

/**
 * Asynchronously reads and parses a JSON file, with caching.
 *
 * This function is optimized for reading `package.json` files. It first checks
 * an in-memory cache to see if the file has already been read and parsed. If so,
 * it returns a deep clone of the cached object to prevent downstream mutations
 * from affecting the cache. If not, it reads the file from disk, parses it as JSON,
 * stores the result in the cache, and then returns a deep clone.
 *
 * @param {string} filePath - The absolute or relative path to the JSON file.
 * @returns {Promise<object | null>} A promise that resolves to the parsed JSON object,
 *                                    or `null` if the file cannot be read or parsed.
 */
export async function readJsonFile(filePath) {
  const absolutePath = path.resolve(filePath);

  if (fileCache.has(absolutePath)) {
    logger.debug(`[CACHE HIT] Reading from cache: ${absolutePath}`);
    // Return a deep clone to prevent mutations of the cached object
    return structuredClone(fileCache.get(absolutePath));
  }

  logger.debug(`[CACHE MISS] Reading from disk: ${absolutePath}`);

  try {
    const fileContent = await fs.readFile(absolutePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);

    // Store the pristine parsed object in the cache
    fileCache.set(absolutePath, jsonData);

    // Return a deep clone for the caller to use
    return structuredClone(jsonData);
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.warn(`Failed to parse JSON file at "${absolutePath}". Invalid JSON content.`, error.message);
    } else if (error.code === 'ENOENT') {
      logger.debug(`File not found: "${absolutePath}". This can be normal for optional dependencies.`);
    } else if (error.code === 'EACCES') {
      logger.warn(`Permission denied while trying to read file: "${absolutePath}".`);
    } else {
      logger.error(`An unexpected error occurred while reading file: "${absolutePath}".`, error);
    }
    return null;
  }
}

/**
 * Checks if a file or directory exists at the given path.
 *
 * @param {string} entityPath - The path to the file or directory.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the entity exists, otherwise `false`.
 */
export async function pathExists(entityPath) {
  try {
    await fs.access(entityPath);
    return true;
  } catch (error) {
    // ENOENT is the specific error code for "file or directory not found"
    if (error.code === 'ENOENT') {
      return false;
    }
    // For other errors (like EACCES), we log a warning but still treat it as "not accessible"
    logger.warn(`Could not access path "${entityPath}" due to an error:`, error.code);
    return false;
  }
}