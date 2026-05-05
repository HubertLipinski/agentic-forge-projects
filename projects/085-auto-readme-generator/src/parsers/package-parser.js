import path from 'node:path';
import { readJsonFile, pathExists } from '../utils/file-system.js';

/**
 * @typedef {object} ParsedAuthor
 * @property {string} name - The author's name.
 * @property {string} [email] - The author's email address.
 * @property {string} [url] - The author's website URL.
 */

/**
 * @typedef {object} PackageData
 * @property {string} name - The project name.
 * @property {string} [description] - The project description.
 * @property {string} [version] - The project version.
 * @property {string} [license] - The project license type (e.g., "MIT").
 * @property {ParsedAuthor} [author] - The parsed author information.
 * @property {object} [repository] - The repository information.
 * @property {string} [repository.url] - The URL of the repository.
 * @property {object} [bugs] - The bug tracker information.
 * @property {string} [bugs.url] - The URL for the issue tracker.
 * @property {string} [homepage] - The project's homepage URL.
 * @property {object<string, string>} [scripts] - A map of script names to commands.
 */

/**
 * Parses the author string from package.json into a structured object.
 * The string can be in the format "Name <email> (url)".
 *
 * @param {string | object} authorInfo - The author field from package.json.
 * @returns {ParsedAuthor | null} A structured author object or null if input is invalid.
 */
function parseAuthor(authorInfo) {
  if (!authorInfo) {
    return null;
  }

  // If author is already an object, return it as is.
  if (typeof authorInfo === 'object' && authorInfo !== null && authorInfo.name) {
    return {
      name: authorInfo.name,
      email: authorInfo.email,
      url: authorInfo.url,
    };
  }

  // If author is a string, parse it.
  if (typeof authorInfo === 'string') {
    const author = {};
    const nameMatch = authorInfo.match(/^([^<(]+)/);
    if (nameMatch) {
      author.name = nameMatch[0].trim();
    } else {
      // If no name can be parsed, the string is invalid.
      return null;
    }

    const emailMatch = authorInfo.match(/<([^>]+)>/);
    if (emailMatch) {
      author.email = emailMatch[1].trim();
    }

    const urlMatch = authorInfo.match(/\(([^)]+)\)/);
    if (urlMatch) {
      author.url = urlMatch[1].trim();
    }

    return author;
  }

  return null;
}

/**
 * Reads and parses the package.json file from the specified project root directory.
 * It extracts essential information needed for generating the README.md file.
 *
 * @param {string} projectRoot - The absolute path to the root of the target project.
 * @returns {Promise<{project: PackageData, packageManager: string}>} A promise that resolves to an object containing structured package data and the detected package manager.
 * @throws {Error} If package.json is not found or is invalid.
 */
export async function parsePackageFile(projectRoot) {
  const packageJsonPath = path.resolve(projectRoot, 'package.json');

  if (!(await pathExists(packageJsonPath))) {
    throw new Error(`'package.json' not found in the project root: ${projectRoot}`);
  }

  const packageJson = await readJsonFile(packageJsonPath);

  // Basic validation to ensure we have a 'name' field.
  if (!packageJson.name) {
    throw new Error(`'name' field is missing in ${packageJsonPath}. This is a required field.`);
  }

  // Detect package manager by lock file presence.
  let packageManager = 'npm'; // Default
  if (await pathExists(path.resolve(projectRoot, 'pnpm-lock.yaml'))) {
    packageManager = 'pnpm';
  } else if (await pathExists(path.resolve(projectRoot, 'yarn.lock'))) {
    packageManager = 'yarn';
  }

  const projectData = {
    name: packageJson.name,
    description: packageJson.description,
    version: packageJson.version,
    license: packageJson.license,
    author: parseAuthor(packageJson.author),
    repository: packageJson.repository,
    bugs: packageJson.bugs,
    homepage: packageJson.homepage,
    scripts: packageJson.scripts,
  };

  return {
    project: projectData,
    packageManager,
  };
}