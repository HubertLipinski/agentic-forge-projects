import { Readable } from 'node:stream';
import { parser } from 'conventional-commits-parser';
import { getCommitLog } from '../git/wrapper.js';
import logger from '../ui/logger.js';

/**
 * @typedef {import('conventional-commits-parser').Commit} ConventionalCommit
 *
 * Represents a parsed Conventional Commit.
 * @property {string} type - The type of the commit (e.g., 'feat', 'fix').
 * @property {string|null} scope - The scope of the commit.
 * @property {string} subject - The subject line of the commit.
 * @property {string|null} body - The body of the commit.
 * @property {string|null} footer - The footer of the commit.
 * @property {object[]} notes - Array of notes, especially for BREAKING CHANGE.
 * @property {string} header - The full header line.
 * @property {string} raw - The raw commit message string.
 */

/**
 * A custom error class for commit parsing failures.
 */
class CommitParseError extends Error {
  /**
   * @param {string} message - The error message.
   * @param {Error} [cause] - The original error that caused this one.
   */
  constructor(message, cause) {
    super(message);
    this.name = 'CommitParseError';
    this.cause = cause;
  }
}

/**
 * Parses a raw Git log string into an array of structured Conventional Commit objects.
 * It streams the raw log through the `conventional-commits-parser`.
 *
 * @param {string} rawLog - The raw string output from `git log`.
 * @returns {Promise<ConventionalCommit[]>} A promise that resolves to an array of parsed commit objects.
 * @throws {CommitParseError} If the stream encounters an error during parsing.
 */
async function parseCommitLog(rawLog) {
  if (!rawLog || typeof rawLog !== 'string') {
    return [];
  }

  const commits = [];
  const stream = Readable.from(rawLog);

  // The parser expects commits to be separated by a specific delimiter.
  // Our `getCommitLog` function in `git/wrapper.js` uses '--GIT-COMMIT-BOUNDARY--'.
  const parserStream = stream.pipe(parser({
    // The noteKeywords array is crucial for identifying breaking changes.
    noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
    // The separator used in `getCommitLog`
    separator: '\n\n--GIT-COMMIT-BOUNDARY--',
  }));

  return new Promise((resolve, reject) => {
    parserStream.on('data', (commit) => {
      // The parser might emit empty objects for non-conventional commits or malformed messages.
      // We filter these out to ensure we only process valid commit structures.
      if (commit.type && commit.subject) {
        // Add the raw commit message to the object for potential use in changelogs.
        // The parser doesn't include this by default.
        const rawMessage = `${commit.header}\n\n${commit.body || ''}\n\n${commit.footer || ''}`.trim();
        commits.push({ ...commit, raw: rawMessage });
      }
    });

    parserStream.on('error', (err) => {
      const error = new CommitParseError('Failed to parse commit stream.', err);
      logger.error(error.message);
      reject(error);
    });

    parserStream.on('end', () => {
      logger.info(`Parsed ${commits.length} conventional commits.`);
      resolve(commits);
    });
  });
}

/**
 * Fetches and parses all conventional commits since the last SemVer tag.
 * This function orchestrates fetching the raw log and then parsing it.
 *
 * @param {string|null} latestTag - The most recent SemVer tag. If null, all commits are fetched.
 * @returns {Promise<ConventionalCommit[]>} A promise that resolves to an array of parsed commit objects.
 */
export async function getAndParseCommits(latestTag) {
  try {
    const rawLog = await getCommitLog(latestTag);
    if (!rawLog.trim()) {
      logger.warn('No new commits found since the last tag.');
      return [];
    }
    return await parseCommitLog(rawLog);
  } catch (error) {
    // If the error is already one of our custom types, re-throw it.
    // Otherwise, wrap it for consistent error handling upstream.
    if (error instanceof CommitParseError || error.name === 'GitError') {
      throw error;
    }
    throw new CommitParseError(`An unexpected error occurred while getting and parsing commits: ${error.message}`, error);
  }
}