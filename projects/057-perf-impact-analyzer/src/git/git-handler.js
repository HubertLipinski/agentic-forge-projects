import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import shell from 'shelljs';
import logger from '../utils/logger.js';

/**
 * @fileoverview Manages all Git operations using 'shelljs': cloning, checking out refs,
 * and getting commit info in a temporary directory. This module abstracts away the
 * complexities of Git, providing a clean API for the orchestrator.
 */

/**
 * A class to manage Git operations within a temporary, isolated directory.
 * It handles the lifecycle of the temporary directory, from creation to cleanup,
 * and executes Git commands safely within that context.
 */
class GitHandler {
  /**
   * The path to the temporary directory used for Git operations.
   * @type {string|null}
   * @private
   */
  #workDir = null;

  /**
   * The path to the original Git repository.
   * @type {string}
   * @private
   */
  #repoPath;

  /**
   * Constructs a new GitHandler instance.
   * @param {string} repoPath - The file path to the local Git repository.
   */
  constructor(repoPath) {
    if (!repoPath || typeof repoPath !== 'string') {
      throw new Error('GitHandler requires a valid repository path.');
    }
    this.#repoPath = path.resolve(repoPath);
  }

  /**
   * Creates a temporary directory for Git operations.
   * This is the first step before any cloning or checking out can occur.
   * The directory is created within the system's temporary folder to ensure
   * it's isolated and eventually cleaned up by the OS if the script crashes.
   *
   * @returns {Promise<string>} The path to the created temporary directory.
   */
  async setup() {
    try {
      const tempDirPrefix = path.join(os.tmpdir(), 'perf-impact-analyzer-');
      this.#workDir = await fs.mkdtemp(tempDirPrefix);
      logger.debug(`Created temporary work directory: ${logger.style.path(this.#workDir)}`);
      return this.#workDir;
    } catch (error) {
      logger.error('Failed to create temporary directory.');
      throw new Error(`Could not create temporary directory: ${error.message}`);
    }
  }

  /**
   * Clones the local repository into the temporary work directory.
   * Using a local clone is significantly faster than a remote clone and avoids
   * network issues. It ensures a clean copy for each analysis run.
   *
   * @throws {Error} If the temporary directory has not been set up or if cloning fails.
   */
  async clone() {
    if (!this.#workDir) {
      throw new Error('Temporary directory not set up. Call setup() before clone().');
    }

    logger.debug(`Cloning local repository from ${logger.style.path(this.#repoPath)} into ${logger.style.path(this.#workDir)}`);

    // Use shelljs for robust command execution.
    // The --local flag optimizes for cloning from a local path.
    const result = shell.exec(`git clone --local "${this.#repoPath}" .`, {
      cwd: this.#workDir,
      silent: !process.env.DEBUG, // Show output only in debug mode
    });

    if (result.code !== 0) {
      throw new Error(`Git clone failed with exit code ${result.code}: ${result.stderr}`);
    }

    logger.debug('Local clone completed successfully.');
  }

  /**
   * Checks out a specific Git ref (branch, tag, or commit hash).
   *
   * @param {string} ref - The Git ref to check out.
   * @throws {Error} If the temporary directory has not been set up or if checkout fails.
   */
  async checkout(ref) {
    if (!this.#workDir) {
      throw new Error('Temporary directory not set up. Call setup() before checkout().');
    }

    logger.debug(`Checking out ref: ${logger.style.ref(ref)}`);

    // Fetch is necessary to ensure all refs (especially from remotes) are available.
    // Pruning removes stale remote-tracking branches.
    const fetchResult = shell.exec('git fetch --all --prune', {
      cwd: this.#workDir,
      silent: !process.env.DEBUG,
    });
    if (fetchResult.code !== 0) {
      logger.warn(`'git fetch' failed. Checkout of '${ref}' may fail if it's a new remote branch.`);
    }

    // Use `git checkout` which works for branches, tags, and commit hashes.
    const checkoutResult = shell.exec(`git checkout ${ref}`, {
      cwd: this.#workDir,
      silent: !process.env.DEBUG,
    });

    if (checkoutResult.code !== 0) {
      throw new Error(`Git checkout of ref '${ref}' failed: ${checkoutResult.stderr}`);
    }

    logger.debug(`Successfully checked out ref: ${logger.style.ref(ref)}`);
  }

  /**
   * Retrieves information about the current HEAD commit.
   *
   * @returns {Promise<{sha: string, message: string}>} An object containing the commit hash (short) and message.
   * @throws {Error} If the temporary directory has not been set up or if the git command fails.
   */
  async getCommitInfo() {
    if (!this.#workDir) {
      throw new Error('Temporary directory not set up. Call setup() before getCommitInfo().');
    }

    // Use a custom format to get the short hash and subject on one line.
    // Using a unique separator `|||` to reliably split the output.
    const format = '%h|||%s';
    const result = shell.exec(`git log -1 --pretty=format:"${format}"`, {
      cwd: this.#workDir,
      silent: true, // Always silent for data retrieval
    });

    if (result.code !== 0 || !result.stdout) {
      throw new Error(`Failed to get commit information: ${result.stderr}`);
    }

    const [sha, message] = result.stdout.trim().split('|||');

    if (!sha || !message) {
      throw new Error('Could not parse commit information from git log output.');
    }

    return { sha, message };
  }

  /**
   * Removes the temporary work directory and all its contents.
   * This should be called after the analysis is complete to clean up resources.
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (!this.#workDir) {
      logger.debug('No work directory to clean up.');
      return;
    }

    logger.debug(`Cleaning up temporary directory: ${logger.style.path(this.#workDir)}`);
    try {
      await fs.rm(this.#workDir, { recursive: true, force: true });
      logger.debug('Cleanup successful.');
      this.#workDir = null;
    } catch (error) {
      // Log a warning instead of throwing an error, as cleanup failure is
      // usually not a critical error that should halt the entire process.
      logger.warn(`Failed to clean up temporary directory ${this.#workDir}: ${error.message}`);
    }
  }

  /**
   * Gets the path to the current working directory for the Git repository.
   * @returns {string|null} The path to the work directory, or null if not set up.
   */
  getWorkDir() {
    return this.#workDir;
  }
}

export default GitHandler;