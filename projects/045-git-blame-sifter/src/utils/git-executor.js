import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createReadStream } from 'node:fs';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

/**
 * A custom error class for Git command failures.
 * This helps in distinguishing Git-specific errors from other runtime errors.
 */
class GitCommandError extends Error {
  /**
   * @param {string} command The full Git command that was executed.
   * @param {number} exitCode The exit code of the failed process.
   * @param {string} stderr The standard error output from the command.
   */
  constructor(command, exitCode, stderr) {
    const message = `Git command failed with exit code ${exitCode}: ${command}\n${stderr}`;
    super(message);
    this.name = 'GitCommandError';
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/**
 * Executes a Git command and returns its output.
 * This function is designed to handle both streaming and buffered output.
 *
 * @param {string[]} args - An array of arguments to pass to the `git` command.
 * @param {object} [options={}] - Options for the execution.
 * @param {string} [options.cwd=process.cwd()] - The working directory for the command.
 * @param {AbortSignal} [options.signal] - An AbortSignal to terminate the process.
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} A promise that resolves with the command's output.
 * @throws {GitCommandError} If the Git command returns a non-zero exit code.
 */
async function executeGitCommand(args, options = {}) {
  const { cwd = process.cwd(), signal } = options;
  const command = `git ${args.join(' ')}`;

  const gitProcess = spawn('git', args, {
    cwd,
    signal,
    stdio: ['ignore', 'pipe', 'pipe'], // stdin, stdout, stderr
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';

  // Efficiently collect stream data without creating intermediate strings
  const stdoutChunks = [];
  const stderrChunks = [];

  gitProcess.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
  gitProcess.stderr.on('data', (chunk) => stderrChunks.push(chunk));

  try {
    const [exitCode] = await once(gitProcess, 'close');

    stdout = Buffer.concat(stdoutChunks).toString('utf8');
    stderr = Buffer.concat(stderrChunks).toString('utf8');

    if (exitCode !== 0) {
      throw new GitCommandError(command, exitCode, stderr);
    }

    return { stdout, stderr, exitCode };
  } catch (error) {
    // If the error is already a GitCommandError, re-throw it.
    // Otherwise, it might be an error from `spawn` itself (e.g., command not found)
    // or an AbortError. We wrap it for consistency.
    if (error instanceof GitCommandError) {
      throw error;
    }

    // Handle AbortError specifically
    if (error.name === 'AbortError') {
      throw new Error(`Git command was aborted: ${command}`);
    }

    // For other spawn errors (e.g., ENOENT)
    const detailedError = error.message.includes('ENOENT')
      ? 'Git command not found. Is Git installed and in your PATH?'
      : error.message;

    throw new Error(`Failed to execute Git command: ${command}. Reason: ${detailedError}`);
  }
}

/**
 * Executes a Git command and streams its stdout.
 * This is useful for large outputs that don't need to be buffered in memory,
 * like `git blame --porcelain`.
 *
 * @param {string[]} args - An array of arguments to pass to the `git` command.
 * @param {object} [options={}] - Options for the execution.
 * @param {string} [options.cwd=process.cwd()] - The working directory for the command.
 * @param {AbortSignal} [options.signal] - An AbortSignal to terminate the process.
 * @returns {Promise<import('stream').Readable>} A promise that resolves with the stdout stream of the command.
 * @throws {GitCommandError} If the Git process exits with an error before streaming begins.
 */
async function streamGitCommand(args, options = {}) {
  const { cwd = process.cwd(), signal } = options;
  const command = `git ${args.join(' ')}`;

  const gitProcess = spawn('git', args, {
    cwd,
    signal,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // We need to handle early exit with an error code.
  // We'll collect stderr and throw if the process closes with a non-zero code.
  const stderrChunks = [];
  gitProcess.stderr.on('data', (chunk) => stderrChunks.push(chunk));

  const closePromise = once(gitProcess, 'close').then(([exitCode]) => {
    if (exitCode !== 0) {
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      throw new GitCommandError(command, exitCode, stderr);
    }
  });

  // Race between the process closing and the stream being readable.
  // If it closes first with an error, the promise will reject.
  // If it's readable, we can safely return the stream.
  await Promise.race([closePromise, once(gitProcess.stdout, 'readable')]);

  // If closePromise rejected, the await above would have thrown.
  // At this point, we know the process is running successfully and stdout is ready.
  // We attach the closePromise rejection handler to the stream to propagate errors.
  gitProcess.stdout.on('error', (err) => {
    // This can happen if the stream is destroyed prematurely.
    // We can choose to ignore or log this. For now, we'll let it be.
  });
  closePromise.catch((err) => gitProcess.stdout.emit('error', err));

  return gitProcess.stdout;
}

/**
 * Checks if the current working directory is inside a Git repository.
 *
 * @param {string} [cwd=process.cwd()] - The directory to check.
 * @returns {Promise<boolean>} A promise that resolves to true if it's a Git repo, false otherwise.
 */
async function isGitRepository(cwd = process.cwd()) {
  try {
    // `git rev-parse --is-inside-work-tree` is a reliable way to check.
    // It exits with 0 and prints "true" if inside a repo, and exits with 128 otherwise.
    const { stdout } = await executeGitCommand(['rev-parse', '--is-inside-work-tree'], { cwd });
    return stdout.trim() === 'true';
  } catch (error) {
    // A non-zero exit code from this specific command means we're not in a repo.
    if (error instanceof GitCommandError) {
      return false;
    }
    // Re-throw other unexpected errors (e.g., git not installed).
    throw error;
  }
}

export {
  executeGitCommand,
  streamGitCommand,
  isGitRepository,
  GitCommandError
};