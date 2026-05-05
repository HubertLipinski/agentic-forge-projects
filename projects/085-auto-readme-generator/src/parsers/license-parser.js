import path from 'node:path';
import { readFileContent, pathExists } from '../utils/file-system.js';

/**
 * @typedef {object} LicenseData
 * @property {string} content - The full text content of the license file.
 * @property {string} path - The relative path to the license file from the project root.
 */

/**
 * Searches for a license file in the project root directory.
 * It checks for common license file names like 'LICENSE', 'LICENSE.md', etc.,
 * in a case-insensitive manner.
 *
 * @param {string} projectRoot - The absolute path to the root of the project.
 * @returns {Promise<string|null>} A promise that resolves to the full path of the
 *   found license file, or null if no license file is found.
 */
async function findLicenseFile(projectRoot) {
  // Common license file names, ordered by preference.
  const potentialFilenames = [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'UNLICENSE',
    'UNLICENSE.md',
    'COPYING',
    'COPYING.md',
  ];

  for (const filename of potentialFilenames) {
    const licensePath = path.resolve(projectRoot, filename);
    if (await pathExists(licensePath)) {
      return licensePath;
    }
  }

  return null;
}

/**
 * Detects and reads the project's license file from the specified root directory.
 * It searches for common license file names and, if found, reads its content.
 *
 * @param {string} projectRoot - The absolute path to the root of the target project.
 * @returns {Promise<LicenseData|null>} A promise that resolves to an object containing
 *   the license content and its path, or null if no license file could be found.
 * @throws {import('../utils/file-system.js').FileSystemError} If a license file is found but cannot be read due to permissions or other I/O errors.
 */
export async function parseLicenseFile(projectRoot) {
  const licensePath = await findLicenseFile(projectRoot);

  if (!licensePath) {
    // It's not an error if a project doesn't have a license file.
    // The engine will simply not include the license section.
    return null;
  }

  try {
    const licenseContent = await readFileContent(licensePath);
    const relativePath = path.relative(projectRoot, licensePath);

    return {
      content: licenseContent,
      path: relativePath,
    };
  } catch (error) {
    // Re-throw the error from readFileContent, which will be a FileSystemError.
    // This indicates a more serious problem than a missing file, e.g., a permissions issue.
    console.error(`[License Parser] Found a license file at ${licensePath} but failed to read it.`);
    throw error;
  }
}