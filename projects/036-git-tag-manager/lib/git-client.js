/**
 * @file lib/git-client.js
 * @description A wrapper around 'execa' to execute Git commands.
 * This module abstracts away the command execution, handles stdout/stderr parsing,
 * and manages error states for operations like fetching, listing, pushing,
 * and deleting tags. It provides a clean, async/await-based API for interacting
 * with a Git repository.
 */

import { execa } from 'execa';
import { printWarning } from './ui-helpers.js';

/**
 * A custom error class for Git-related failures.
 * This helps in distinguishing Git command errors from other application errors.
 */
class GitClientError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {import('execa').ExecaError} [cause] - The original execa error.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'GitClientError';
    this.cause = cause;
    // Expose the short message for concise error reporting
    this.shortMessage = cause?.shortMessage ?? message;
  }
}

/**
 * Executes a Git command using execa and handles common error patterns.
 * @private
 * @param {string[]} args - An array of arguments for the git command.
 * @param {import('execa').Options} [options={}] - Options to pass to execa.
 * @returns {Promise<import('execa').ExecaReturnValue>} A promise that resolves with the command result.
 * @throws {GitClientError} If the Git command fails.
 */
async function runGitCommand(args, options = {}) {
  try {
    // By default, reject if the command exits with a non-zero code.
    // The `stripFinalNewline` option is useful for parsing stdout.
    const result = await execa('git', args, { stripFinalNewline: true, ...options });
    return result;
  } catch (error) {
    // Wrap execa errors in our custom error type for better context.
    // The message includes stderr if available, which is often the most useful part.
    const errorMessage = error.stderr || error.shortMessage || 'An unknown Git error occurred.';
    throw new GitClientError(`Git command failed: git ${args.join(' ')}\n${errorMessage}`, error);
  }
}

/**
 * Fetches tags from one or more remotes and prunes deleted tags locally.
 * Also fetches local tags.
 * @param {string[]} [remotes=[]] - An array of remote names to fetch from.
 * @param {boolean} [prune=true] - Whether to prune tags that no longer exist on the remote.
 * @returns {Promise<Set<string>>} A promise that resolves to a Set of all unique tag names.
 */
export async function fetchTags(remotes = [], prune = true) {
  // Fetch from all specified remotes.
  for (const remote of remotes) {
    const fetchArgs = ['fetch', remote, '--tags'];
    if (prune) {
      fetchArgs.push('--prune-tags');
    }
    try {
      await runGitCommand(fetchArgs);
    } catch (error) {
      // A failure to fetch from one remote shouldn't stop the whole process.
      // Warn the user and continue.
      printWarning(`Could not fetch from remote '${remote}'. It may be offline or misconfigured. Error: ${error.shortMessage}`);
    }
  }

  // List all local tags. After fetching, this includes tags from all remotes.
  const { stdout } = await runGitCommand(['tag', '--list']);
  const tags = stdout ? stdout.split('\n') : [];
  return new Set(tags);
}

/**
 * Retrieves detailed information for a list of tags.
 * @param {string[]} tags - An array of tag names.
 * @returns {Promise<Array<{tag: string, commit: string, author: string, date: string}>>}
 *          A promise that resolves to an array of tag detail objects.
 */
export async function getTagDetails(tags) {
  if (tags.length === 0) {
    return [];
  }

  // Use a custom format to get all required info in one command.
  // The `%(trailers:unfold)` part is a modern way to get the tagger date if it's an annotated tag.
  // `%(refname:short)` is the tag name.
  // `%(objectname:short)` is the commit hash.
  // `%(authorname)` and `%(authordate:iso)` refer to the commit author.
  const format = '%(refname:short)%00%(objectname:short)%00%(authorname)%00%(authordate:iso)%00';
  const args = ['tag', '--list', ...tags, `--format=${format}`];

  const { stdout } = await runGitCommand(args);

  if (!stdout) {
    return [];
  }

  return stdout.split('\0\0').filter(Boolean).map(entry => {
    const [tag, commit, author, date] = entry.split('\0');
    return { tag, commit, author, date };
  });
}

/**
 * Deletes a tag from the local repository.
 * @param {string} tag - The name of the tag to delete.
 * @returns {Promise<void>}
 */
export async function deleteLocalTag(tag) {
  await runGitCommand(['tag', '--delete', tag]);
}

/**
 * Deletes a tag from a specified remote repository.
 * @param {string} remote - The name of the remote.
 * @param {string} tag - The name of the tag to delete.
 * @returns {Promise<void>}
 */
export async function deleteRemoteTag(remote, tag) {
  // The syntax for deleting a remote tag is `git push <remote> :<tag>`
  await runGitCommand(['push', remote, `:${tag}`]);
}

/**
 * Creates a new lightweight tag on a specific commit in the local repository.
 * @param {string} tag - The name of the tag to create.
 * @param {string} commit - The commit hash or reference to tag.
 * @returns {Promise<void>}
 */
export async function createLocalTag(tag, commit) {
  await runGitCommand(['tag', tag, commit]);
}

/**
 * Pushes a specific tag to a remote repository.
 * @param {string} remote - The name of the remote.
 * @param {string} tag - The name of the tag to push.
 * @param {boolean} [force=false] - If true, uses '--force' to overwrite the remote tag if it exists.
 * @returns {Promise<void>}
 */
export async function pushTag(remote, tag, force = false) {
  const args = ['push', remote, tag];
  if (force) {
    args.push('--force');
  }
  await runGitCommand(args);
}

/**
 * Resolves a commit-ish reference (like 'HEAD', a branch name, or a partial hash)
 * to its full commit hash.
 * @param {string} commitIsh - The reference to resolve.
 * @returns {Promise<string>} A promise that resolves to the full commit hash.
 * @throws {GitClientError} If the reference is invalid or cannot be resolved.
 */
export async function validateCommit(commitIsh) {
  try {
    const { stdout } = await runGitCommand(['rev-parse', '--verify', `${commitIsh}^{commit}`]);
    return stdout;
  } catch (error) {
    throw new GitClientError(`Invalid commit reference: '${commitIsh}'.`, error);
  }
}

/**
 * Finds the commit hash that a given tag points to.
 * @param {string} tag - The tag name.
 * @returns {Promise<string>} A promise that resolves to the commit hash.
 * @throws {GitClientError} If the tag does not exist.
 */
export async function getCommitForTag(tag) {
  try {
    // `^{}` dereferences the tag to the commit object it points to.
    const { stdout } = await runGitCommand(['rev-parse', `${tag}^{}`]);
    return stdout;
  } catch (error) {
    throw new GitClientError(`Could not find commit for tag '${tag}'. It may not exist locally.`, error);
  }
}