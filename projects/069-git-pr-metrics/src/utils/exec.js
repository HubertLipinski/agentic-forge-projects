import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * A promisified version of `child_process.exec`.
 * This allows executing shell commands as an asynchronous operation that returns a promise.
 * The promise resolves with an object containing `stdout` and `stderr` from the command's execution.
 *
 * @private
 * @type {function(string, object?): Promise<{stdout: string, stderr: string}>}
 */
const execPromise = promisify(execCallback);

/**
 * Executes a shell command asynchronously and returns its standard output.
 * This is a robust wrapper around `child_process.exec` designed specifically for this project's needs.
 *
 * Key features:
 * - Returns a promise that resolves with the command's `stdout`.
 * - Throws a detailed, custom error on failure, including `stderr` for better debugging.
 * - Trims leading/trailing whitespace from the output for cleaner data processing.
 * - Allows specifying the current working directory (`cwd`) for the command.
 *
 * @param {string} command The shell command to execute (e.g., 'git log').
 * @param {object} [options={}] Optional settings.
 * @param {string} [options.cwd=process.cwd()] The working directory to run the command in. Defaults to the current process's working directory.
 * @returns {Promise<string>} A promise that resolves to the trimmed `stdout` of the command.
 * @throws {Error} Throws a custom error if the command fails (exits with a non-zero code) or if `stderr` is produced. The error message includes the original command, exit code, and `stderr` content.
 */
export async function exec(command, { cwd = process.cwd() } = {}) {
  if (!command || typeof command !== 'string' || command.trim() === '') {
    throw new Error('Invalid command: Command must be a non-empty string.');
  }

  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd,
      // Set a higher maxBuffer to handle potentially large `git log` outputs.
      // 10MB should be sufficient for most repositories and date ranges.
      maxBuffer: 1024 * 1024 * 10,
    });

    // Some git commands print to stderr for informational purposes even on success.
    // We will log these but not treat them as hard errors unless the process exits non-zero.
    if (stderr) {
      // This is unlikely to be seen unless running with a verbose flag,
      // but it's good practice to acknowledge stderr.
      // In a more complex app, this could be logged to a file.
      // console.warn(`[exec] Warning (stderr) for command "${command}":\n${stderr}`);
    }

    return stdout.trim();
  } catch (error) {
    // The error object from promisify(exec) is rich with information.
    // We'll re-throw a more specific and helpful error for our application's context.
    const errorMessage = `
      Failed to execute command: "${command}"
      
      Exit Code: ${error.code}
      
      Stderr:
      ${error.stderr.trim()}
      
      Stdout:
      ${error.stdout.trim()}
      
      This error often indicates that:
      1. You are not inside a valid git repository.
      2. The 'git' command is not available in your system's PATH.
      3. The command syntax is incorrect.
    `;
    throw new Error(errorMessage);
  }
}