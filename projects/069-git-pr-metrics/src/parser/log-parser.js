/**
 * @file src/parser/log-parser.js
 * @description Parses the output of `git log` with custom format specifiers into structured JavaScript objects representing pull requests.
 */

/**
 * A custom, machine-readable format string for `git log`.
 * This format is designed to be easily and reliably parsed.
 *
 * Each log entry is separated by `__PR_END__`.
 * Each field within an entry is separated by `__FIELD_SEP__`.
 *
 * The fields are:
 * 1.  `%H`: Commit hash (SHA) of the merge commit.
 * 2.  `%an`: Author name of the merge commit.
 * 3.  `%ae`: Author email of the merge commit.
 * 4.  `%ai`: Author date (ISO 8601 format) of the merge commit.
 * 5.  `%s`: Subject (title) of the merge commit.
 * 6.  `%b`: Body of the merge commit message.
 * 7.  `%p`: Parent hashes. For a merge commit, this will be two hashes.
 *
 * @constant {string}
 */
export const GIT_LOG_FORMAT = [
  '%H', // 1. Commit hash
  '%an', // 2. Author name
  '%ae', // 3. Author email
  '%ai', // 4. Author date (merge date)
  '%s', // 5. Subject (PR title)
  '%b', // 6. Body
  '%p', // 7. Parent hashes
].join('%x1f'); // Use a non-printable character (Unit Separator) as a field separator.

/**
 * A unique string to mark the end of a single log entry.
 * This ensures reliable splitting of log entries, even if commit messages contain unusual characters.
 * @constant {string}
 */
export const GIT_LOG_ENTRY_SEPARATOR = '%x1e'; // Use Record Separator character.

/**
 * A regular expression to extract the Pull Request number from a commit subject line.
 * It specifically looks for patterns like `(#123)` or `(GH-123)` which are common
 * conventions for squash-and-merge or merge commits from platforms like GitHub.
 *
 * Captures the numeric part of the PR identifier.
 * - `\(#(\d+)\)`: Matches `(#123)` and captures `123`.
 * - `\(GH-(\d+)\)`: Matches `(GH-123)` and captures `123`.
 * - `Merge pull request #(\d+)`: Matches GitHub's default merge commit message.
 *
 * @constant {RegExp}
 */
const PR_NUMBER_REGEX =
  /(?:Merge pull request #|pull request #|#|\(GH-)(\d+)/;

/**
 * Parses the raw string output from `git log` into an array of structured PR objects.
 *
 * @param {string} logOutput The raw string from a `git log` command, formatted according to `GIT_LOG_FORMAT`.
 * @returns {Array<object>} An array of PR data objects. Each object represents a merged PR
 *   and contains structured information. Returns an empty array if the log output is empty or invalid.
 * @throws {Error} If the log output is not a string.
 */
export function parseLog(logOutput) {
  if (typeof logOutput !== 'string') {
    throw new Error('Invalid input: logOutput must be a string.');
  }

  if (!logOutput.trim()) {
    return [];
  }

  // Split the raw log string into individual commit entries.
  // The filter(Boolean) step removes any empty strings that might result from splitting,
  // for instance, if the log output ends with the separator.
  const entries = logOutput.split(GIT_LOG_ENTRY_SEPARATOR).filter(Boolean);

  const prs = entries.map((entry) => {
    // Split each entry into its constituent fields.
    const [
      mergeCommitHash,
      authorName,
      authorEmail,
      mergedAt,
      subject,
      body,
      parentHashes,
    ] = entry.trim().split('\x1f');

    // Extract the PR number from the subject line using the regex.
    const prNumberMatch = subject.match(PR_NUMBER_REGEX);
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : null;

    // For a merge commit, there are typically two parent hashes.
    // The first is the target branch, and the second is the source branch head.
    const [baseSha, headSha] = (parentHashes || '').split(' ');

    return {
      prNumber,
      title: subject,
      author: {
        name: authorName,
        email: authorEmail,
      },
      mergedAt: new Date(mergedAt),
      mergeCommitHash,
      baseSha,
      headSha,
      body,
    };
  });

  // Filter out any commits that couldn't be identified as PRs (i.e., no prNumber).
  // This helps exclude direct commits to the main branch that might be caught by the log command.
  return prs.filter((pr) => pr.prNumber !== null);
}