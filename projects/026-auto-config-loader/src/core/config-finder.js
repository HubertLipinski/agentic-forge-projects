/**
 * @file src/core/config-finder.js
 * @description Implements the logic to search upwards from a starting directory to find all
 *              relevant configuration files (e.g., config.json, config.development.json).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SUPPORTED_EXTENSIONS = ['.json', '.yaml', '.yml'];
const CONFIG_BASENAMES = ['config', '.config'];

/**
 * Checks if a given directory path exists and is accessible.
 * @param {string} dirPath - The directory path to check.
 * @returns {Promise<boolean>} `true` if the directory exists, `false` otherwise.
 */
async function directoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return false;
    }
    // For other errors (like EACCES), re-throw as it indicates a problem.
    throw new Error(`Error accessing directory: ${dirPath}`, { cause: error });
  }
}

/**
 * Generates a list of potential configuration file names for a given directory.
 * This includes base names, environment-specific names, and all supported extensions.
 *
 * Example: for NODE_ENV='production', it generates:
 * - config.production.json, config.production.yaml, ...
 * - .config.production.json, .config.production.yaml, ...
 * - config.json, config.yaml, ...
 * - .config.json, .config.yaml, ...
 *
 * @param {string} dirPath - The directory to generate file names for.
 * @param {string} [env=''] - The current environment (e.g., 'production').
 * @returns {string[]} An array of absolute file paths to check for.
 */
function generateCandidateFilePaths(dirPath, env = '') {
  const candidates = [];
  const envSuffix = env ? `.${env}` : '';

  // Environment-specific files should be prioritized.
  if (envSuffix) {
    for (const basename of CONFIG_BASENAMES) {
      for (const ext of SUPPORTED_EXTENSIONS) {
        candidates.push(path.join(dirPath, `${basename}${envSuffix}${ext}`));
      }
    }
  }

  // Add base config files.
  for (const basename of CONFIG_BASENAMES) {
    for (const ext of SUPPORTED_EXTENSIONS) {
      candidates.push(path.join(dirPath, `${basename}${ext}`));
    }
  }

  return candidates;
}

/**
 * Finds all existing configuration files in a specific directory.
 * @param {string} dirPath - The directory to search in.
 * @param {string} env - The current environment string.
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute paths to existing config files.
 */
async function findConfigFilesInDir(dirPath, env) {
  const candidates = generateCandidateFilePaths(dirPath, env);
  const foundFiles = [];

  // Using Promise.allSettled to check for file existence in parallel.
  const checkResults = await Promise.allSettled(
    candidates.map(file => fs.access(file, fs.constants.F_OK).then(() => file))
  );

  for (const result of checkResults) {
    if (result.status === 'fulfilled' && result.value) {
      foundFiles.push(result.value);
    }
    // We ignore 'rejected' status, as it simply means the file doesn't exist.
  }

  return foundFiles;
}

/**
 * Searches for configuration files by traversing upwards from a starting directory
 * up to the root of the filesystem. It also includes the user's home directory
 * in the search paths.
 *
 * The search order is:
 * 1. User's home directory (`~`).
 * 2. Project directories, from the root of the project downwards to the `startDir`.
 *
 * The final returned list is ordered by precedence (project files first, then home files),
 * with files deeper in the project structure having higher precedence.
 *
 * @param {object} options - The options for finding configuration files.
 * @param {string} [options.startDir=process.cwd()] - The directory to start searching from.
 * @param {string} [options.stopDir=path.parse(startDir).root] - The directory to stop searching at.
 * @param {string} [options.env=process.env.NODE_ENV] - The current environment (e.g., 'production').
 * @param {boolean} [options.searchHome=true] - Whether to search in the user's home directory.
 * @returns {Promise<{projectFiles: string[], homeFiles: string[], envFiles: string[]}>}
 *          A promise that resolves to an object containing lists of found file paths,
 *          categorized by source (project, home, and .env files).
 */
export async function findConfigFiles({
  startDir = process.cwd(),
  stopDir = path.parse(startDir).root,
  env = process.env.NODE_ENV,
  searchHome = true,
} = {}) {
  const homeDir = os.homedir();
  const projectSearchPaths = [];
  let currentDir = startDir;

  // 1. Collect all directories to search in the project tree.
  while (true) {
    if (!(await directoryExists(currentDir))) {
      // If startDir doesn't exist, we can't search from it.
      if (currentDir === startDir) {
        console.warn(`[Auto-Config-Loader] Start directory not found: ${startDir}`);
        break;
      }
      // If an intermediate directory is missing, stop there.
      break;
    }

    projectSearchPaths.push(currentDir);

    if (currentDir === stopDir || currentDir === path.parse(currentDir).root) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  // 2. Find config files in the user's home directory if enabled.
  let homeFiles = [];
  if (searchHome && homeDir && (await directoryExists(homeDir))) {
    // Ensure we don't search home directory twice if it's part of the project path.
    if (!projectSearchPaths.includes(homeDir)) {
      homeFiles = await findConfigFilesInDir(homeDir, env);
    }
  }

  // 3. Find config files in all project directories.
  // We search in parallel for efficiency.
  const projectFilePromises = projectSearchPaths.map(dir => findConfigFilesInDir(dir, env));
  const projectFilesNested = await Promise.all(projectFilePromises);

  // Flatten the array and remove duplicates. The `Set` ensures uniqueness.
  // The order is from parent to child dir, which is what we want for merging.
  const projectFiles = [...new Set(projectFilesNested.flat())];

  // 4. Find all `.env` and `.env.<environment>` files up the tree.
  const envFiles = [];
  for (const dir of projectSearchPaths) {
    const envPath = path.join(dir, '.env');
    // Check for .env.<environment> first, as it has higher precedence.
    if (env) {
      const envSpecificPath = `${envPath}.${env}`;
      try {
        await fs.access(envSpecificPath);
        envFiles.push(envSpecificPath);
      } catch {
        // File doesn't exist, do nothing.
      }
    }
    // Then check for the base .env file.
    try {
      await fs.access(envPath);
      envFiles.push(envPath);
    } catch {
      // File doesn't exist, do nothing.
    }
  }

  // The final file lists are ordered from lowest to highest precedence.
  // `homeFiles` are lowest, `projectFiles` are next (with deeper files overriding shallower ones),
  // and `envFiles` are handled separately but also ordered by depth.
  return {
    projectFiles,
    homeFiles,
    envFiles: [...new Set(envFiles)], // Ensure uniqueness
  };
}