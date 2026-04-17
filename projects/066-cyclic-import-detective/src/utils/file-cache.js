import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import logger from './logger.js';

/**
 * The directory name within the system's temp directory to store cache files.
 * @type {string}
 */
const CACHE_DIR_NAME = 'cyclic-import-detective-cache';

/**
 * The base path for the cache directory.
 * @type {string}
 */
let cacheBasePath;

/**
 * A Map to hold in-memory cache entries for the current run.
 * This avoids repeated disk I/O for the same file within a single process execution.
 * @type {Map<string, any>}
 */
const memoryCache = new Map();

/**
 * Generates a unique, deterministic, and filesystem-safe cache key from a file path.
 * This prevents issues with very long paths or paths containing special characters.
 * @param {string} filePath - The absolute path to the file.
 * @returns {string} A SHA-256 hash of the file path.
 */
function getCacheKey(filePath) {
  return createHash('sha256').update(filePath).digest('hex');
}

/**
 * Initializes the cache directory. Creates it if it doesn't exist.
 * This function is designed to be called once at the start of the process.
 * @returns {Promise<void>}
 */
async function initializeCache() {
  if (cacheBasePath) {
    return; // Already initialized
  }
  try {
    const systemTempDir = os.tmpdir();
    cacheBasePath = path.join(systemTempDir, CACHE_DIR_NAME);
    await fs.mkdir(cacheBasePath, { recursive: true });
    logger.debug(`Cache initialized at: ${cacheBasePath}`);
  } catch (error) {
    logger.error('Failed to initialize file cache directory.', error);
    // Invalidate cache path to prevent further errors. The tool will run without caching.
    cacheBasePath = null;
  }
}

/**
 * Retrieves a cached item for a given file path.
 * It first checks the in-memory cache, then the file-based cache.
 * It validates the cache by comparing the file's modification time.
 *
 * @param {string} filePath - The absolute path of the file to retrieve from the cache.
 * @returns {Promise<any | null>} The cached data (e.g., an AST) if it's valid, otherwise null.
 */
export async function get(filePath) {
  if (!cacheBasePath) {
    logger.debug(`Cache not initialized, skipping get for: ${filePath}`);
    return null;
  }

  // 1. Check in-memory cache first for performance
  if (memoryCache.has(filePath)) {
    logger.debug(`[Memory Cache] HIT for: ${filePath}`);
    return memoryCache.get(filePath);
  }

  const cacheKey = getCacheKey(filePath);
  const cacheFilePath = path.join(cacheBasePath, cacheKey);

  try {
    // 2. Check file-based cache
    const stats = await fs.stat(filePath);
    const fileMtime = stats.mtime.getTime();

    const cacheFileContent = await fs.readFile(cacheFilePath, 'utf8');
    const cachedData = JSON.parse(cacheFileContent);

    // 3. Validate cache freshness
    if (cachedData.mtime === fileMtime) {
      logger.debug(`[File Cache] HIT for: ${filePath}`);
      // Store in memory for subsequent access during this run
      memoryCache.set(filePath, cachedData.data);
      return cachedData.data;
    }

    logger.debug(`[File Cache] STALE for: ${filePath} (mtime mismatch)`);
    return null;
  } catch (error) {
    // ENOENT (file not found) is the expected case for a cache miss.
    // Other errors (e.g., JSON parse error) are treated as a miss.
    if (error.code !== 'ENOENT') {
      logger.debug(`[File Cache] Error reading cache for ${filePath}: ${error.message}`);
    } else {
      logger.debug(`[File Cache] MISS for: ${filePath}`);
    }
    return null;
  }
}

/**
 * Stores an item in the cache for a given file path.
 * It writes to both the file-based cache and the in-memory cache.
 *
 * @param {string} filePath - The absolute path of the file being cached.
 * @param {any} data - The data to cache (e.g., an AST object). Must be JSON-serializable.
 * @returns {Promise<void>}
 */
export async function set(filePath, data) {
  if (!cacheBasePath) {
    logger.debug(`Cache not initialized, skipping set for: ${filePath}`);
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    const fileMtime = stats.mtime.getTime();

    const cachePayload = {
      mtime: fileMtime,
      data,
    };

    // Store in memory for the current run
    memoryCache.set(filePath, data);

    // Store in file system for subsequent runs
    const cacheKey = getCacheKey(filePath);
    const cacheFilePath = path.join(cacheBasePath, cacheKey);
    const content = JSON.stringify(cachePayload);

    await fs.writeFile(cacheFilePath, content, 'utf8');
    logger.debug(`[File Cache] SET for: ${filePath}`);
  } catch (error) {
    // Fail silently on cache write errors, as caching is non-critical.
    logger.error(`Failed to write to cache for ${filePath}.`, error);
  }
}

/**
 * Clears the entire file-based cache by removing the cache directory.
 * Also clears the in-memory cache for the current run.
 *
 * @returns {Promise<void>}
 */
export async function clear() {
  memoryCache.clear();
  if (!cacheBasePath) {
    logger.debug('Cache not initialized, nothing to clear.');
    return;
  }

  try {
    await fs.rm(cacheBasePath, { recursive: true, force: true });
    logger.info('File cache cleared successfully.');
    // Re-create the directory for the current session
    await initializeCache();
  } catch (error) {
    logger.error('Failed to clear file cache.', error);
  }
}

// Initialize the cache as soon as the module is loaded.
// The `await` is at the top level, which is valid in ES modules.
await initializeCache();