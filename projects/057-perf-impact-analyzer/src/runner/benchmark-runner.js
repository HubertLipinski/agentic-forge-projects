import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import shell from 'shelljs';
import logger from '../utils/logger.js';

/**
 * @fileoverview Handles the execution of user-defined benchmark commands for a given Git ref.
 * Captures and returns stdout/stderr. This module abstracts the process of running external
 * commands and installing their dependencies.
 */

// Promisify exec for async/await usage, which is more modern than callbacks.
const execAsync = promisify(exec);

/**
 * Installs npm dependencies using `npm install` or `npm ci`.
 * It prefers `npm ci` if a `package-lock.json` file exists, as it provides faster,
 * more reliable builds, which is crucial for reproducible benchmarks. Otherwise,
 * it falls back to `npm install`.
 *
 * @param {string} workDir - The directory where the command should be executed.
 * @throws {Error} If the dependency installation fails.
 */
async function installDependencies(workDir) {
  const lockFileExists = shell.test('-f', `${workDir}/package-lock.json`);
  const command = lockFileExists ? 'npm ci' : 'npm install';

  logger.debug(`Running '${command}' in ${logger.style.path(workDir)}...`);

  // Using shelljs.exec for its synchronous nature and simpler API for this case.
  // It's suitable for setup steps where concurrency isn't the primary goal.
  // The output is silenced unless in DEBUG mode to keep the main output clean.
  const result = shell.exec(command, {
    cwd: workDir,
    silent: !process.env.DEBUG,
    env: { ...process.env, NODE_ENV: 'development' }, // Ensure devDependencies are installed
  });

  if (result.code !== 0) {
    logger.error(`Dependency installation failed with command: ${command}`);
    // Provide detailed error output to help diagnose CI/CD issues.
    throw new Error(`'${command}' failed with exit code ${result.code}:\n${result.stderr}`);
  }

  logger.debug('Dependencies installed successfully.');
}

/**
 * Executes a single benchmark run for a given command in a specified directory.
 * It captures and returns the standard output and standard error from the command.
 *
 * @param {string} command - The benchmark command to execute (e.g., 'npm run benchmark').
 * @param {string} workDir - The directory where the command should be executed.
 * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves with the
 *   captured stdout and stderr of the executed command.
 * @throws {Error} If the command execution fails.
 */
export async function runBenchmark(command, workDir) {
  if (!command || typeof command !== 'string') {
    throw new Error('Benchmark command must be a non-empty string.');
  }
  if (!workDir || typeof workDir !== 'string') {
    throw new Error('Working directory must be a non-empty string.');
  }

  // First, ensure all dependencies are installed for the benchmark script to run.
  // This is critical because each git checkout is in a clean, temporary directory.
  try {
    await installDependencies(workDir);
  } catch (error) {
    // Propagate the error with context.
    throw new Error(`Failed to prepare benchmark environment: ${error.message}`);
  }

  logger.debug(`Executing benchmark command: ${logger.style.command(command)}`);

  try {
    // Use the promisified `exec` to run the command asynchronously.
    // This is generally safer than shelljs.exec for capturing large outputs
    // and handling complex shell syntax.
    const { stdout, stderr } = await execAsync(command, {
      cwd: workDir,
      // Set a higher maxBuffer in case benchmark scripts produce a lot of output.
      // The default is 1MB, 10MB should be more than enough for most cases.
      maxBuffer: 10 * 1024 * 1024,
      // Pass through environment variables, which might be needed by the benchmark script.
      env: process.env,
    });

    // Log stderr as a warning if it contains content, as it might indicate
    // non-fatal issues in the benchmark script.
    if (stderr) {
      logger.warn(`Benchmark command produced stderr output:\n${stderr.trim()}`);
    }

    return { stdout, stderr };
  } catch (error) {
    // The `error` object from `exec` contains `stdout` and `stderr` which are
    // extremely useful for debugging a failed command.
    logger.error(`Benchmark command failed: ${logger.style.command(command)}`);
    logger.error(`Exit Code: ${error.code}`);
    if (error.stdout) {
      logger.error(`STDOUT:\n${error.stdout}`);
    }
    if (error.stderr) {
      logger.error(`STDERR:\n${error.stderr}`);
    }

    // Throw a new, more informative error.
    throw new Error(`Execution of command "${command}" failed with exit code ${error.code}.`);
  }
}