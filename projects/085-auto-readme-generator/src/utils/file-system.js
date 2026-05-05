import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Custom error class for file system operations.
 * This allows for more specific error handling in the application logic.
 */
class FileSystemError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Optional parameters.
   * @param {Error} [options.cause] The original error that caused this one.
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'FileSystemError';
    if (options?.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }
}

/**
 * Reads the content of a file at the given path.
 *
 * @param {string} filePath - The absolute or relative path to the file.
 * @returns {Promise<string>} A promise that resolves with the file content as a UTF-8 string.
 * @throws {FileSystemError} If the file cannot be read (e.g., does not exist, permissions error).
 */
export async function readFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new FileSystemError(`File not found at path: ${filePath}`, { cause: error });
    }
    throw new FileSystemError(`Failed to read file: ${filePath}`, { cause: error });
  }
}

/**
 * Reads and parses a JSON file from the given path.
 *
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON object.
 * @throws {FileSystemError} If the file cannot be read or if the JSON is invalid.
 */
export async function readJsonFile(filePath) {
  const fileContent = await readFileContent(filePath);
  try {
    return JSON.parse(fileContent);
  } catch (error) {
    throw new FileSystemError(`Failed to parse JSON from file: ${filePath}. Ensure it is valid JSON.`, { cause: error });
  }
}

/**
 * Writes content to a specified file path.
 * If the directory for the file does not exist, it will be created.
 *
 * @param {string} filePath - The path where the file will be written.
 * @param {string} content - The content to write to the file.
 * @returns {Promise<void>} A promise that resolves when the file has been written.
 * @throws {FileSystemError} If the file cannot be written.
 */
export async function writeFileContent(filePath, content) {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new FileSystemError(`Failed to write to file: ${filePath}`, { cause: error });
  }
}

/**
 * Checks if a file or directory exists at the given path.
 *
 * @param {string} filePath - The path to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the path exists, false otherwise.
 */
export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    // For other errors (like permission issues), we re-throw as it's an unexpected state.
    throw new FileSystemError(`Error accessing path: ${filePath}`, { cause: error });
  }
}

/**
 * Resolves the absolute path for a template file.
 * It first checks for a user-provided path, then falls back to the built-in templates.
 *
 * @param {string} templateNameOrPath - The name of a built-in template (e.g., 'default') or a file path.
 * @returns {Promise<string>} A promise that resolves with the absolute path to the template file.
 * @throws {FileSystemError} If the template file cannot be found.
 */
export async function resolveTemplatePath(templateNameOrPath) {
  // Case 1: User provides a direct path to a template file.
  if (templateNameOrPath.includes('/') || templateNameOrPath.includes('\\') || templateNameOrPath.endsWith('.md')) {
    const absolutePath = path.resolve(process.cwd(), templateNameOrPath);
    if (await pathExists(absolutePath)) {
      return absolutePath;
    }
    throw new FileSystemError(`Template file not found at specified path: ${absolutePath}`);
  }

  // Case 2: User provides the name of a built-in template (e.g., 'default').
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const builtInTemplatePath = path.resolve(
    __dirname,
    '../templates',
    `${templateNameOrPath}.md`
  );

  if (await pathExists(builtInTemplatePath)) {
    return builtInTemplatePath;
  }

  throw new FileSystemError(`Built-in template "${templateNameOrPath}" not found.`);
}