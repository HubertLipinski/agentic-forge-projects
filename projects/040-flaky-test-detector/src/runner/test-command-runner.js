/**
 * @file src/runner/test-command-runner.js
 * @description A module responsible for executing the user-provided test command
 * using `child_process.spawn` and capturing its stdout/stderr streams.
 * It's designed to be robust, handling command execution, output buffering,
 * and graceful termination.
 */

import { spawn } from 'node:child_process';
import { RUN_OUTCOME } from '../config/constants.js';

/**
 * Executes a given shell command in a child process and captures its output.
 * This function is designed to run a single test suite invocation.
 *
 * @param {string} command - The full command string to execute (e.g., "npm test -- --watchAll=false").
 * @param {object} options - Configuration for the execution.
 * @param {string} options.cwd - The current working directory for the child process.
 * @param {AbortSignal} [options.signal] - An optional AbortSignal to terminate the child process.
 * @returns {Promise<{outcome: string, output: string, error: Error | null}>} A promise that resolves with an object containing:
 *  - `outcome`: The result of the run ('success', 'failure', or 'cancelled').
 *  - `output`: The combined stdout and stderr from the command.
 *  - `error`: An Error object if the process could not be spawned or was killed unexpectedly, otherwise null.
 */
export async function runTestCommand(command, { cwd, signal }) {
  return new Promise((resolve) => {
    // Command parsing: The first part is the command, the rest are arguments.
    // This handles commands with arguments like "npm test -- --coverage".
    const [cmd, ...args] = command.trim().split(/\s+/);

    let childProcess;
    try {
      childProcess = spawn(cmd, args, {
        cwd,
        shell: true, // Use shell to correctly interpret commands like 'npm' on Windows and handle complex args.
        signal,
        // Detached: false is the default, but being explicit helps clarity.
        // We want the child to terminate if the parent does (unless we handle it).
        detached: false,
      });
    } catch (spawnError) {
      // This catches errors during the spawn call itself, e.g., if the command is malformed
      // or the shell option has issues. This is a critical failure.
      resolve({
        outcome: RUN_OUTCOME.FAILURE,
        output: `Failed to spawn command: "${command}"\n${spawnError.message}`,
        error: spawnError,
      });
      return;
    }

    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const onAbort = () => {
      // This listener handles cancellation via the AbortSignal.
      // It ensures we resolve the promise with a 'cancelled' state.
      resolve({
        outcome: RUN_OUTCOME.CANCELLED,
        output: stdout + stderr,
        error: new Error('The test run was cancelled.'),
      });
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    childProcess.on('error', (spawnError) => {
      // This event fires for errors *after* the process has spawned,
      // such as an 'ENOENT' if the command itself doesn't exist in the PATH.
      signal?.removeEventListener('abort', onAbort);
      resolve({
        outcome: RUN_OUTCOME.FAILURE,
        output: stdout + stderr,
        error: spawnError,
      });
    });

    childProcess.on('close', (code, signalName) => {
      // 'close' fires after all I/O streams have been closed.
      // This is the definitive end of the process.
      signal?.removeEventListener('abort', onAbort);

      // If the process was terminated by a signal (e.g., SIGINT from our own abort controller),
      // and we haven't already resolved via the 'abort' listener, it's a cancellation.
      if (signalName) {
        resolve({
          outcome: RUN_OUTCOME.CANCELLED,
          output: stdout + stderr,
          error: new Error(`Process terminated by signal: ${signalName}`),
        });
        return;
      }

      // A non-zero exit code indicates a test failure.
      // Test runners typically exit with 0 on success and >0 on failure.
      if (code !== 0) {
        resolve({
          outcome: RUN_OUTCOME.FAILURE,
          output: stdout + stderr,
          error: new Error(`Process exited with non-zero code: ${code}`),
        });
        return;
      }

      // A zero exit code indicates a successful test run.
      resolve({
        outcome: RUN_OUTCOME.SUCCESS,
        output: stdout + stderr,
        error: null,
      });
    });
  });
}