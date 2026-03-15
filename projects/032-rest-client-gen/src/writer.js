/**
 * @file src/writer.js
 * @description A utility module that uses 'fs-extra' to write the generated code string
 * to the specified output file, creating directories if they don't exist.
 */

import path from 'node:path';
import fs from 'fs-extra';

/**
 * A custom error class for file writing operations.
 * This allows for specific error handling when I/O fails.
 */
class FileWriteError extends Error {
  /**
   * @param {string} message - A descriptive error message.
   * @param {Error} [cause] - The underlying error from the filesystem operation.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'FileWriteError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Asynchronously writes content to a specified file path.
 *
 * This function handles the entire file writing process, including:
 * 1. Ensuring the target directory exists by creating it recursively if needed.
 * 2. Writing the provided content to the file.
 *
 * It leverages `fs-extra` for robust and convenient filesystem operations.
 * If any part of the process fails, it throws a `FileWriteError` with a
 * detailed, user-friendly message.
 *
 * @param {string} outputPath - The absolute or relative path to the output file.
 * @param {string} content - The string content to be written to the file.
 * @returns {Promise<void>} A promise that resolves when the file has been successfully written.
 * @throws {FileWriteError} If the directory cannot be created or the file cannot be written.
 */
export const writeGeneratedCode = async (outputPath, content) => {
  if (!outputPath || typeof outputPath !== 'string') {
    throw new FileWriteError('Invalid output path provided. The path must be a non-empty string.');
  }

  if (typeof content !== 'string') {
    // This is a defensive check, though content should always be a string from the generator.
    throw new FileWriteError('Invalid content provided. The content to write must be a string.');
  }

  try {
    // `fs.outputFile` from 'fs-extra' is a convenient method that automatically
    // creates the directory structure if it doesn't exist before writing the file.
    // This is equivalent to calling `fs.ensureDir` followed by `fs.writeFile`.
    await fs.outputFile(outputPath, content, 'utf-8');
  } catch (error) {
    // Catch potential errors from fs-extra (e.g., permission issues, invalid path characters)
    // and wrap them in our custom error type for consistent error handling upstream.
    const absolutePath = path.resolve(outputPath);
    throw new FileWriteError(
      `Failed to write generated code to "${absolutePath}". Please check file permissions and path validity.`,
      error
    );
  }
};