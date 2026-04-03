import { spawn } from 'node:child_process';
import path from 'node:path';
import chalk from 'chalk';
import { startRecording, stopRecording } from './recorder.js';
import { startReplaying, stopReplaying } from './replayer.js';

const DEFAULT_FIXTURES_DIR = '__http_mocks__';

/**
 * @typedef {'record' | 'replay'} Mode - The operational mode for the orchestrator.
 */

/**
 * @typedef {object} OrchestratorOptions
 * @property {Mode} mode - The desired mode: 'record' or 'replay'.
 * @property {string[]} command - The test command and its arguments to execute (e.g., ['mocha', 'test.js']).
 * @property {string} [fixturesDir] - Directory for storing/loading fixtures. Defaults to '__http_mocks__'.
 * @property {boolean} [allowUnmocked] - In replay mode, allow unmocked requests to pass through.
 * @property {boolean} [clearFixtures] - In record mode, clear existing fixtures before recording.
 */

/**
 * Spawns the user's test command as a child process.
 *
 * This function executes the provided command (e.g., 'jest', 'mocha') and pipes its
 * stdio to the parent process, so the user sees the test output in real-time.
 * It resolves with the exit code of the child process.
 *
 * @param {string[]} commandWithArgs - The command and its arguments (e.g., ['npm', 'test']).
 * @returns {Promise<number>} A promise that resolves with the exit code of the test process.
 */
function runTestProcess(commandWithArgs) {
  return new Promise((resolve, reject) => {
    if (!commandWithArgs || commandWithArgs.length === 0) {
      return reject(new Error('No test command provided to execute.'));
    }

    const [command, ...args] = commandWithArgs;
    console.log(
      chalk.gray(`[Orchestrator] Spawning test process: ${command} ${args.join(' ')}`)
    );

    const testProcess = spawn(command, args, {
      // Inherit stdio to show test output, colors, etc., in the user's terminal.
      stdio: 'inherit',
      // Run command in a shell on Windows to correctly resolve .cmd, .bat files.
      shell: process.platform === 'win32',
    });

    testProcess.on('error', (err) => {
      console.error(
        chalk.red(`[Orchestrator] Failed to start test process '${command}'.`),
        chalk.red(err.message)
      );
      // Common errors include command not found (ENOENT).
      if (err.code === 'ENOENT') {
        console.error(chalk.yellow(`Is '${command}' installed and in your system's PATH?`));
      }
      reject(err);
    });

    testProcess.on('close', (code) => {
      console.log(
        chalk.gray(`[Orchestrator] Test process finished with exit code: ${code}`)
      );
      // A non-zero exit code usually indicates test failures. We resolve rather
      // than reject to allow the orchestrator to report the status correctly.
      resolve(code ?? 1);
    });
  });
}

/**
 * The main execution function for the HTTP Mock Recorder.
 *
 * It orchestrates the entire process:
 * 1. Sets up the environment (record or replay mode).
 * 2. Spawns the user's test command as a child process.
 * 3. Waits for the test process to complete.
 * 4. Tears down the environment and cleans up.
 * 5. Exits with the same exit code as the test process.
 *
 * @param {OrchestratorOptions} options - The configuration for the run.
 * @returns {Promise<void>} A promise that resolves when the entire process is complete.
 */
export async function run({
  mode,
  command,
  fixturesDir = DEFAULT_FIXTURES_DIR,
  allowUnmocked = false,
  clearFixtures: clear = false,
}) {
  if (!mode || (mode !== 'record' && mode !== 'replay')) {
    throw new Error(`[Orchestrator] Invalid mode specified: '${mode}'. Must be 'record' or 'replay'.`);
  }

  const absoluteFixturesDir = path.resolve(process.cwd(), fixturesDir);
  let exitCode = 1; // Default to failure

  try {
    // --- Setup Phase ---
    if (mode === 'record') {
      await startRecording({ fixturesDir: absoluteFixturesDir, clear });
    } else { // mode === 'replay'
      await startReplaying({ fixturesDir: absoluteFixturesDir, allowUnmocked });
    }

    // --- Execution Phase ---
    exitCode = await runTestProcess(command);

  } catch (error) {
    console.error(
      chalk.red.bold('[Orchestrator] A critical error occurred during execution:'),
      error
    );
    exitCode = 1;
  } finally {
    // --- Teardown Phase ---
    // This block runs regardless of whether the test process succeeded or failed.
    console.log(chalk.gray('[Orchestrator] Tearing down environment...'));
    if (mode === 'record') {
      await stopRecording();
    } else {
      await stopReplaying();
    }

    // Propagate the exit code from the test process.
    // This is crucial for CI/CD pipelines to correctly detect test failures.
    console.log(chalk.bold(`[Orchestrator] Exiting with code ${exitCode}.`));
    process.exit(exitCode);
  }
}