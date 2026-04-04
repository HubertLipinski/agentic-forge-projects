import { execa } from 'execa';
import semver from 'semver';
import logger from '../ui/logger.js';

/**
 * A custom error class for Git-related operations.
 * This allows for more specific error handling in the main application logic.
 */
class GitError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {import('execa').ExecaError} [cause] - The original error from execa.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'GitError';
    this.cause = cause; // The original execa error, if available.
  }
}

/**
 * Executes a Git command using execa and handles common errors.
 *
 * @param {string[]} args - An array of arguments for the git command.
 * @param {import('execa').Options} [options={}] - Options to pass to execa.
 * @returns {Promise<import('execa').ExecaReturnValue>} The result from execa.
 * @throws {GitError} If the Git command fails.
 */
async function runGit(args, options = {}) {
  try {
    // By default, we don't want to inherit stdio as we capture stdout.
    // We also want to strip final newlines for easier processing.
    const defaultOptions = {
      stripFinalNewline: true,
    };
    return await execa('git', args, { ...defaultOptions, ...options });
  } catch (error) {
    // Intercept execa errors to provide more context.
    // `error.shortMessage` is a concise summary of the command failure.
    // `error.stderr` contains the actual error output from Git.
    const errorMessage = `Git command failed: ${error.shortMessage}\n${error.stderr || ''}`.trim();
    logger.error(`Failed to execute: git ${args.join(' ')}`);
    throw new GitError(errorMessage, error);
  }
}

/**
 * Fetches the most recent SemVer tag from the repository.
 * It uses `git describe --tags --abbrev=0` which is the most reliable way.
 * If no tags are found, it returns null.
 *
 * @returns {Promise<string|null>} The latest SemVer tag as a string, or null if no tags exist.
 */
export async function getLatestSemVerTag() {
  try {
    // `git tag -l --sort=-v:refname` lists all tags sorted by version.
    // We then find the first one that is a valid semver string.
    const { stdout } = await runGit(['tag', '-l', '--sort=-v:refname']);
    const tags = stdout.split('\n');

    for (const tag of tags) {
      if (semver.valid(tag)) {
        logger.info(`Found latest SemVer tag: ${tag}`);
        return tag;
      }
    }

    logger.warn('No valid SemVer tags found in the repository.');
    return null;
  } catch (error) {
    // A common case is a repository with no tags at all. `git tag` might fail
    // or return empty output depending on the Git version. We treat this as "no tag found".
    if (error instanceof GitError && (error.cause?.exitCode === 128 || error.cause?.stdout === '')) {
      logger.warn('No tags found in the repository.');
      return null;
    }
    // Re-throw other, more serious errors.
    throw error;
  }
}

/**
 * Retrieves the commit history since a specific Git reference (e.g., a tag).
 * If `fromRef` is null or undefined, it fetches the entire commit history.
 *
 * @param {string|null} fromRef - The Git ref (tag or commit hash) to start the log from.
 * @returns {Promise<string>} A string containing the raw Git log output.
 */
export async function getCommitLog(fromRef) {
  const range = fromRef ? `${fromRef}..HEAD` : 'HEAD';
  logger.info(`Fetching commit history for range: ${range}`);

  // The format `%B%n%n--GIT-COMMIT-BOUNDARY--` is used to reliably split commits.
  // `%B` includes the full commit message body.
  const args = ['log', range, '--format=%B%n%n--GIT-COMMIT-BOUNDARY--'];

  const { stdout } = await runGit(args);
  return stdout;
}

/**
 * Creates a new annotated Git tag.
 *
 * @param {string} tagName - The name of the tag to create (e.g., 'v1.2.3').
 * @param {string} annotationMessage - The message for the annotated tag (often the changelog).
 * @returns {Promise<void>} A promise that resolves when the tag is created.
 */
export async function createTag(tagName, annotationMessage) {
  logger.info(`Creating annotated tag: ${tagName}`);
  const args = ['tag', '-a', tagName, '-m', annotationMessage];
  await runGit(args);
  logger.success(`Successfully created tag '${tagName}'`);
}

/**
 * Pushes a specific Git tag to a remote repository.
 *
 * @param {string} tagName - The name of the tag to push.
 * @param {string} remote - The name of the remote to push to (e.g., 'origin').
 * @returns {Promise<void>} A promise that resolves when the push is complete.
 */
export async function pushTag(tagName, remote) {
  logger.info(`Pushing tag '${tagName}' to remote '${remote}'...`);
  const args = ['push', remote, tagName];
  await runGit(args);
  logger.success(`Successfully pushed tag '${tagName}' to '${remote}'`);
}

/**
 * Checks if the working directory is clean (no uncommitted changes).
 *
 * @returns {Promise<boolean>} True if the working directory is clean, false otherwise.
 */
export async function isWorkingDirClean() {
  try {
    const { stdout } = await runGit(['status', '--porcelain']);
    return stdout === '';
  } catch (error) {
    // If `git status` fails for some reason, we cannot assume the directory is clean.
    logger.error('Could not determine git status. Aborting to prevent unexpected behavior.');
    throw error;
  }
}