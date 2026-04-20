/**
 * @file src/git/pr-fetcher.js
 * @description Orchestrates git commands to fetch all merged PRs within a given date range and author filter.
 */

import { exec } from '../utils/exec.js';
import {
  GIT_LOG_FORMAT,
  GIT_LOG_ENTRY_SEPARATOR,
  parseLog,
} from '../parser/log-parser.js';
import { parseDiffStat } from '../parser/diff-parser.js';

/**
 * Fetches and parses merged pull requests from the local git repository within a specified date range and for a specific author.
 *
 * This is the main orchestrator function. It performs the following steps:
 * 1.  Constructs and executes a `git log` command to find merge commits that match the criteria.
 * 2.  Parses the raw log output into a structured array of PR objects.
 * 3.  For each PR, it fetches additional details:
 *     a. The date of the first commit in the PR's branch.
 *     b. The diff statistics (additions, deletions) for the PR.
 * 4.  Returns the enriched array of PR data, ready for metric calculation.
 *
 * @param {object} options - The options for fetching PRs.
 * @param {string} options.since - The start date for the analysis (ISO 8601 format string).
 * @param {string} options.until - The end date for the analysis (ISO 8601 format string).
 * @param {string} [options.author] - Optional git author to filter by.
 * @param {string} [options.cwd=process.cwd()] - The working directory to run git commands in.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of enriched PR data objects.
 * @throws {Error} If git commands fail or parsing encounters an issue.
 */
export async function fetchPullRequests({ since, until, author, cwd }) {
  const logCommand = buildLogCommand({ since, until, author });
  const logOutput = await exec(logCommand, { cwd });

  if (!logOutput) {
    return []; // No commits found, return empty array.
  }

  const basePrs = parseLog(logOutput);

  // Sequentially fetch additional data for each PR to avoid overwhelming the system
  // with too many concurrent `git` processes. A `for...of` loop is used for its
  // natural handling of `await` in a loop.
  const enrichedPrs = [];
  for (const pr of basePrs) {
    // Skip PRs that don't have a valid headSha, as we cannot get diffs or first commit dates.
    if (!pr.headSha) {
      // This might happen for unusual merge commits or corrupted history.
      // console.warn(`Skipping PR #${pr.prNumber} due to missing head SHA.`);
      continue;
    }

    try {
      const [firstCommitDate, diffStat] = await Promise.all([
        getFirstCommitDate(pr.baseSha, pr.headSha, { cwd }),
        getDiffStat(pr.baseSha, pr.headSha, { cwd }),
      ]);

      enrichedPrs.push({
        ...pr,
        firstCommitAt: firstCommitDate,
        ...diffStat,
      });
    } catch (error) {
      // Log a warning but continue processing other PRs. This makes the tool resilient
      // to issues with a single PR's history (e.g., a rebased and force-pushed branch).
      console.warn(
        `[Warning] Failed to fetch full details for PR #${pr.prNumber}. It will be excluded. Error: ${error.message}`,
      );
    }
  }

  return enrichedPrs;
}

/**
 * Constructs the `git log` command with all necessary filters and formatting.
 *
 * @private
 * @param {object} options - The filter options.
 * @param {string} options.since - The start date.
 * @param {string} options.until - The end date.
 * @param {string} [options.author] - The author to filter by.
 * @returns {string} The complete `git log` command string.
 */
function buildLogCommand({ since, until, author }) {
  // We use `git log` on the `main` or `master` branch to find merge commits.
  // The `--merges` flag is crucial as it filters for commits with more than one parent.
  let command = `git log --merges --since="${since}" --until="${until}"`;

  // If an author is specified, filter commits by that author.
  // This filters by the author of the *merge commit*, which is typically the person who merged the PR.
  if (author) {
    command += ` --author="${author}"`;
  }

  // Append the custom format string. This is the most important part for machine-readability.
  // The separators are designed to be unambiguous and robust.
  command += ` --format="${GIT_LOG_FORMAT}${GIT_LOG_ENTRY_SEPARATOR}"`;

  return command;
}

/**
 * Fetches the date of the first commit on a feature branch.
 * This is used to calculate "Time to First Review".
 *
 * It works by finding the list of commits that are on the feature branch (`headSha`)
 * but not on the base branch (`baseSha`), then getting the author date of the very first one.
 *
 * @private
 * @param {string} baseSha - The SHA of the base branch (e.g., `main`).
 * @param {string} headSha - The SHA of the head of the feature branch that was merged.
 * @param {object} options - Execution options.
 * @param {string} options.cwd - The working directory.
 * @returns {Promise<Date|null>} A promise that resolves to the Date of the first commit, or null if it can't be determined.
 */
async function getFirstCommitDate(baseSha, headSha, { cwd }) {
  // `git rev-list --reverse` lists commits in reverse chronological order (oldest first).
  // `${baseSha}..${headSha}` is the range of commits in `headSha` but not in `baseSha`.
  // `| head -n 1` takes only the first commit from that list (the oldest one).
  const firstCommitShaCommand = `git rev-list --reverse ${baseSha}..${headSha} | head -n 1`;
  const firstCommitSha = await exec(firstCommitShaCommand, { cwd });

  if (!firstCommitSha) {
    // This can happen if the branch history is unusual, e.g., a branch merged with no new commits.
    return null;
  }

  // Now, get the author date of that specific commit.
  // `%ai` gives the author date in strict ISO 8601 format.
  const commitDateCommand = `git show -s --format=%ai ${firstCommitSha}`;
  const dateString = await exec(commitDateCommand, { cwd });

  return dateString ? new Date(dateString) : null;
}

/**
 * Fetches the diff statistics (additions, deletions, files changed) for a given commit range.
 *
 * @private
 * @param {string} baseSha - The SHA of the base commit.
 * @param {string} headSha - The SHA of the head commit.
 * @param {object} options - Execution options.
 * @param {string} options.cwd - The working directory.
 * @returns {Promise<object>} A promise that resolves to an object with `{ additions, deletions, filesChanged }`.
 */
async function getDiffStat(baseSha, headSha, { cwd }) {
  // `git diff --stat` provides a summary of changes.
  // The range `${baseSha}...${headSha}` shows the diff of all changes introduced by the feature branch.
  // The three-dot syntax is important here: it shows changes on the second branch that are not on the first.
  const diffCommand = `git diff --stat ${baseSha}...${headSha}`;
  const diffOutput = await exec(diffCommand, { cwd });

  return parseDiffStat(diffOutput);
}