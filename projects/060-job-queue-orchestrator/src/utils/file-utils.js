/**
 * src/utils/file-utils.js
 *
 * Provides low-level, atomic file I/O utilities to ensure data integrity.
 *
 * The core principle for atomicity is the "write-to-temp-then-rename" pattern.
 * This prevents file corruption if the application crashes mid-write. For appends,
 * it uses file handles with the 'a' flag, which is generally atomic at the OS level
 * for single write operations.
 *
 * These utilities are fundamental for the file-based storage engine, guaranteeing
 * that the job database remains consistent and recoverable.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import logger from './logger.js';

/**
 * Ensures that the directory for a given file path exists.
 * If the directory does not exist, it is created recursively.
 *
 * @param {string} filePath - The full path to the file.
 * @returns {Promise<void>} A promise that resolves when the directory is confirmed to exist.
 * @throws {Error} If the directory cannot be created.
 */
export async function ensureDirectoryExists(filePath) {
  const dirname = path.dirname(filePath);
  try {
    await fs.mkdir(dirname, { recursive: true });
  } catch (error) {
    // Ignore EEXIST error, which means the directory already exists.
    if (error.code !== 'EEXIST') {
      logger.error({ err: error, directory: dirname }, 'Failed to create directory');
      throw new Error(`Could not ensure directory exists: ${dirname}`);
    }
  }
}

/**
 * Atomically writes data to a file.
 *
 * It first writes the content to a temporary file in the same directory,
 * and then renames the temporary file to the final destination path. This
 * ensures that the final file is never left in a partially written or
 * corrupt state, even if the process is interrupted.
 *
 * @param {string} filePath - The final path of the file to write.
 * @param {string | Buffer} data - The data to write to the file.
 * @returns {Promise<void>} A promise that resolves when the file has been written successfully.
 * @throws {Error} If any step of the atomic write process fails.
 */
export async function atomicWriteFile(filePath, data) {
  await ensureDirectoryExists(filePath);

  const dirname = path.dirname(filePath);
  const tempPath = path.join(dirname, `.${path.basename(filePath)}.${nanoid(8)}.tmp`);

  let fileHandle;
  try {
    // O_EXCL ensures that we are the ones creating this temporary file.
    fileHandle = await fs.open(tempPath, 'wx');
    await fileHandle.writeFile(data, 'utf8');
    await fileHandle.sync(); // Ensure data is flushed to the disk.
    await fileHandle.close();

    // The atomic operation: rename the temp file to the final destination.
    await fs.rename(tempPath, filePath);
  } catch (error) {
    logger.error(
      { err: error, filePath, tempPath },
      'Atomic file write failed'
    );

    // Cleanup: Attempt to close the handle and remove the temp file if they exist.
    if (fileHandle) {
      await fileHandle.close().catch(closeErr => {
        logger.warn({ err: closeErr, tempPath }, 'Failed to close file handle during cleanup');
      });
    }
    await fs.unlink(tempPath).catch(unlinkErr => {
      // It's possible the file was never created, so we only log if the error is not ENOENT.
      if (unlinkErr.code !== 'ENOENT') {
        logger.warn({ err: unlinkErr, tempPath }, 'Failed to remove temporary file during cleanup');
      }
    });

    throw new Error(`Failed to atomically write to file: ${filePath}`);
  }
}

/**
 * Appends a line of data to a file, ensuring the directory exists first.
 *
 * This function uses the 'a' flag for appending, which is generally atomic
 * for single write operations on most modern operating systems. It also ensures
 * a newline character is added to maintain the JSON Lines format.
 *
 * @param {string} filePath - The path of the file to append to.
 * @param {string} data - The string data to append as a new line.
 * @returns {Promise<void>} A promise that resolves when the data has been appended.
 * @throws {Error} If the append operation fails.
 */
export async function appendLine(filePath, data) {
  await ensureDirectoryExists(filePath);

  try {
    // The 'a' flag opens the file for appending. The file is created if it does not exist.
    // Appending a single buffer is typically an atomic operation at the OS level.
    await fs.appendFile(filePath, data + '\n', 'utf8');
  } catch (error) {
    logger.error({ err: error, filePath }, 'Failed to append line to file');
    throw new Error(`Failed to append to file: ${filePath}`);
  }
}

/**
 * Reads the entire content of a file.
 *
 * @param {string} filePath - The path of the file to read.
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {Error} If the file does not exist or cannot be read.
 */
export async function readFileContent(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Return an empty string if the file doesn't exist, as this is often
      // an expected state for a new database file. The caller can decide
      // how to handle an empty result.
      return '';
    }
    logger.error({ err: error, filePath }, 'Failed to read file content');
    throw new Error(`Failed to read file: ${filePath}`);
  }
}