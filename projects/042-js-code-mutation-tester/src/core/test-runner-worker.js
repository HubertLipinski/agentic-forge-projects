import { parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MUTANT_STATUS } from '../constants.js';

/**
 * @typedef {import('./mutant-generator.js').Mutant} Mutant
 */

/**
 * Represents the data passed from the main thread to this worker.
 * @typedef {object} WorkerData
 * @property {Mutant} mutant - The mutant to be tested.
 * @property {object} config - The application configuration.
 * @property {string} config.testCommand - The command to run the test suite (e.g., 'npm test').
 * @property {number} config.timeout - The timeout in milliseconds for a single test run.
 * @property {string} projectRoot - The root directory of the project being tested.
 */

/**
 * Executes a command in a child process and returns a promise that resolves
 * with the process's exit code.
 *
 * @param {string} command - The command to execute (e.g., 'npm').
 * @param {string[]} args - The arguments for the command (e.g., ['test']).
 * @param {object} options - Options for the child process.
 * @param {number} options.timeout - The maximum execution time in milliseconds.
 * @param {string} options.cwd - The working directory for the command.
 * @param {AbortSignal} options.signal - An AbortSignal to terminate the process.
 * @returns {Promise<{code: number | null, signal: NodeJS.Signals | null}>} A promise resolving with the exit code and signal.
 */
function runTestProcess(command, args, { timeout, cwd, signal }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      timeout,
      signal,
      // Detached: false is important. We want the child to be part of the same process group.
      // This helps ensure that when we kill the child process (e.g., on timeout), any
      // subprocesses it might have spawned (like the actual test runner) are also terminated.
      detached: false,
      // Pipe stdio to the parent's null stream to prevent test output from cluttering the console.
      // This improves performance and keeps the main mutation report clean.
      // For debugging, you could change this to 'inherit'.
      stdio: 'ignore',
    });

    child.on('error', (err) => {
      // 'error' is emitted for process creation errors (e.g., command not found).
      // We resolve with a non-zero code to indicate failure.
      // A specific code like 127 is conventional for "command not found".
      if (err.code === 'ENOENT') {
        resolve({ code: 127, signal: null });
      } else {
        resolve({ code: 1, signal: null });
      }
    });

    child.on('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

/**
 * Temporarily overwrites a source file with mutated code.
 * This is a critical operation and must be handled carefully to ensure
 * the original file is always restored.
 *
 * @param {string} filePath - The absolute path to the source file.
 * @param {string} mutatedCode - The mutated code to write.
 * @returns {Promise<void>}
 * @throws {Error} if writing the file fails.
 */
async function applyMutation(filePath, mutatedCode) {
  try {
    await fs.writeFile(filePath, mutatedCode, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to apply mutation to ${filePath}: ${error.message}`);
  }
}

/**
 * Restores the original source file content.
 * This function is designed to be robust and is typically called in a `finally` block.
 *
 * @param {string} filePath - The absolute path to the source file.
 * @param {string} originalCode - The original code to restore.
 * @returns {Promise<void>}
 * @throws {Error} if restoring the file fails.
 */
async function restoreOriginal(filePath, originalCode) {
  try {
    await fs.writeFile(filePath, originalCode, 'utf-8');
  } catch (error) {
    // If restoration fails, it's a critical problem. The user's source tree is left in a dirty state.
    // We throw an error to signal this catastrophic failure.
    throw new Error(`CRITICAL: Failed to restore original code for ${filePath}. Please restore it manually! Error: ${error.message}`);
  }
}

/**
 * The main function for the worker thread. It orchestrates the testing of a single mutant.
 * 1. Applies the mutation to the source file.
 * 2. Runs the configured test command.
 * 3. Determines the mutant's status (Killed, Survived, Timeout).
 * 4. Ensures the original source file is always restored.
 * 5. Posts the result back to the main thread.
 *
 * @param {WorkerData} data - The data passed from the main thread.
 * @returns {Promise<void>}
 */
async function testMutant({ mutant, config, projectRoot }) {
  const { sourceFilePath, originalCode, mutatedCode } = mutant;
  const { testCommand, timeout } = config;

  // AbortController for robust timeout and cleanup.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Step 1: Apply the mutation.
    await applyMutation(sourceFilePath, mutatedCode);

    // Step 2: Run the test command.
    const [command, ...args] = testCommand.split(/\s+/);
    const result = await runTestProcess(command, args, {
      timeout,
      cwd: projectRoot,
      signal: controller.signal,
    });

    // Step 3: Determine the status.
    let status;
    if (result.signal === 'SIGTERM' || controller.signal.aborted) {
      // If the process was terminated by our timeout.
      status = MUTANT_STATUS.TIMED_OUT;
    } else if (result.code === 0) {
      // Exit code 0 means tests passed, so the mutant survived.
      status = MUTANT_STATUS.SURVIVED;
    } else {
      // Any non-zero exit code means tests failed, so the mutant was killed.
      status = MUTANT_STATUS.KILLED;
    }

    parentPort.postMessage({ status });
  } catch (error) {
    // This catches errors from `applyMutation` or unexpected errors in the process.
    parentPort.postMessage({
      status: MUTANT_STATUS.ERROR,
      error: error.message,
    });
  } finally {
    // Step 4: CRITICAL - Always restore the original file.
    clearTimeout(timeoutId);
    // Ensure the process is terminated if it's still running.
    if (!controller.signal.aborted) {
      controller.abort();
    }
    await restoreOriginal(sourceFilePath, originalCode);
  }
}

// Entry point for the worker thread.
// The main thread sends a single message with the `workerData`.
// We listen for that message and start the test process.
if (!parentPort) {
  // This should not happen if run as a worker, but it's a good safeguard.
  throw new Error('This script must be run as a worker thread.');
}

// Start the process as soon as the worker is initialized with data.
testMutant(workerData).catch((error) => {
  // This is a last-resort catch for unexpected errors within the `testMutant` async function itself.
  parentPort.postMessage({
    status: MUTANT_STATUS.ERROR,
    error: `An unexpected error occurred in the test runner worker: ${error.message}`,
  });
});