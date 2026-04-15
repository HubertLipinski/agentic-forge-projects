import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Reads the content of a file.
 *
 * @param {string} filePath - The absolute or relative path to the file.
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {Error} If the file cannot be read.
 */
export async function readFileContent(filePath) {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    // Provide a more context-specific error message
    if (error.code === 'ENOENT') {
      throw new Error(`File not found at path: ${filePath}`);
    }
    throw new Error(`Failed to read file "${filePath}": ${error.message}`);
  }
}

/**
 * Writes content to a file, overwriting it if it already exists.
 *
 * @param {string} filePath - The absolute or relative path to the file.
 * @param {string} content - The content to write to the file.
 * @returns {Promise<void>} A promise that resolves when the file has been written.
 * @throws {Error} If the file cannot be written.
 */
export async function writeFileContent(filePath, content) {
  try {
    await writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write to file "${filePath}": ${error.message}`);
  }
}

/**
 * Recursively scans a directory and its subdirectories for files matching a set of extensions.
 *
 * @param {string} dirPath - The path to the directory to start scanning from.
 * @param {Set<string>} extensions - A Set of file extensions to include (e.g., new Set(['.js', '.ts'])).
 * @returns {Promise<string[]>} A promise that resolves with an array of full file paths.
 * @throws {Error} If the initial directory cannot be read.
 */
export async function findFilesByExtension(dirPath, extensions) {
  const allFiles = [];

  /**
   * Inner recursive function to traverse directories.
   * @param {string} currentPath - The directory path to scan.
   */
  async function scan(currentPath) {
    let entries;
    try {
      // `withFileTypes: true` is more efficient as it avoids extra `stat` calls.
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      // If a subdirectory is unreadable, log a warning and skip it.
      // This is more robust than failing the entire operation.
      console.warn(`Warning: Could not read directory "${currentPath}". Skipping. Error: ${error.message}`);
      return; // Stop traversal for this path
    }

    const promises = entries.map(async (entry) => {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath); // Recurse into subdirectories
      } else if (entry.isFile()) {
        const fileExt = extname(entry.name);
        if (extensions.has(fileExt)) {
          allFiles.push(fullPath);
        }
      }
      // Symlinks and other file types are ignored by design.
    });

    // Wait for all concurrent operations in the current directory to complete.
    await Promise.all(promises);
  }

  // Initial validation for the root directory path
  try {
    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error(`The provided path is not a directory: ${dirPath}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    // Re-throw other stat-related errors
    throw error;
  }


  await scan(dirPath);
  return allFiles;
}