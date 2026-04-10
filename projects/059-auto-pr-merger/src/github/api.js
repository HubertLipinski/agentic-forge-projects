/**
 * @file src/github/api.js
 * @description Contains functions for interacting with the GitHub API, such as fetching pull requests, checking statuses, and performing merges.
 *
 * This module abstracts the underlying Octokit calls into a set of application-specific
 * functions. Each function is designed to perform a distinct action against the GitHub API,
 * such as fetching open pull requests, retrieving their detailed status (including checks and reviews),
 * and merging them. This abstraction layer simplifies the core logic in `processor.js` and
 * centralizes all GitHub API interactions, making them easier to manage, test, and debug.
 * Proper error handling is implemented to gracefully manage API failures and rate limiting.
 */

import { getOctokitClient } from './client.js';
import logger from '../utils/logger.js';

/**
 * Fetches all open pull requests for a given repository.
 *
 * @param {object} context - The repository context.
 * @param {string} context.owner - The owner of the repository.
 * @param {string} context.repo - The name of the repository.
 * @returns {Promise<object[]>} A promise that resolves to an array of pull request objects.
 * @throws {Error} If the API call fails.
 */
export async function fetchOpenPullRequests({ owner, repo }) {
  const octokit = getOctokitClient();
  logger.info(`Fetching open pull requests for ${owner}/${repo}...`);

  try {
    const { data: pullRequests } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'open',
      per_page: 100, // Fetch up to 100 PRs, a reasonable limit for an automation tool.
    });
    logger.info(`Found ${pullRequests.length} open pull request(s).`);
    return pullRequests;
  } catch (error) {
    logger.error(`Failed to fetch open pull requests for ${owner}/${repo}.`, error);
    throw new Error(`API error while fetching pull requests: ${error.message}`);
  }
}

/**
 * Fetches detailed information for a single pull request, including CI check runs and review status.
 * This combined data is crucial for making an accurate merge decision.
 *
 * @param {object} context - The repository context.
 * @param {string} context.owner - The owner of the repository.
 * @param {string} context.repo - The name of the repository.
 * @param {number} pullNumber - The number of the pull request.
 * @param {string} headSha - The SHA of the head commit of the pull request.
 * @returns {Promise<{
 *   checkRuns: object[],
 *   reviews: object[],
 *   isDraft: boolean,
 *   mergeableState: string
 * }>} An object containing detailed status information.
 * @throws {Error} If any of the API calls fail.
 */
export async function getPullRequestDetails({ owner, repo, pullNumber, headSha }) {
  const octokit = getOctokitClient();
  logger.info(`Fetching details for PR #${pullNumber} (SHA: ${headSha})...`);

  try {
    // Use Promise.all to fetch details concurrently for better performance.
    const [checkRunsResponse, reviewsResponse, prDataResponse] = await Promise.all([
      // Fetch check runs associated with the specific head SHA.
      octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: headSha,
        per_page: 100,
      }),
      // Fetch reviews for the pull request.
      octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }),
      // Fetch the PR data itself to get draft status and mergeable_state.
      octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      }),
    ]);

    const details = {
      checkRuns: checkRunsResponse.data.check_runs,
      reviews: reviewsResponse.data,
      isDraft: prDataResponse.data.draft,
      // The mergeable_state indicates if there are conflicts, if checks are pending, etc.
      // It's a more reliable indicator than the simple `mergeable` boolean.
      // See: https://docs.github.com/en/graphql/reference/enums#mergestatestatus
      mergeableState: prDataResponse.data.mergeable_state,
    };

    logger.info(`Fetched details for PR #${pullNumber}: ${details.checkRuns.length} checks, ${details.reviews.length} reviews, draft=${details.isDraft}, mergeable_state=${details.mergeableState}`);
    return details;
  } catch (error) {
    logger.error(`Failed to fetch details for PR #${pullNumber}.`, error);
    throw new Error(`API error while fetching details for PR #${pullNumber}: ${error.message}`);
  }
}

/**
 * Merges a pull request using the specified method.
 *
 * @param {object} context - The repository context.
 * @param {string} context.owner - The owner of the repository.
 * @param {string} context.repo - The name of the repository.
 * @param {number} pullNumber - The number of the pull request to merge.
 * @param {string} headSha - The expected SHA of the head commit. Merging will fail if it doesn't match, preventing race conditions.
 * @param {string} mergeMethod - The merge strategy to use ('merge', 'squash', or 'rebase').
 * @returns {Promise<{sha: string, message: string}>} A promise that resolves with the result of the merge operation.
 * @throws {Error} If the merge API call fails.
 */
export async function mergePullRequest({ owner, repo, pullNumber, headSha, mergeMethod }) {
  const octokit = getOctokitClient();
  logger.info(`Attempting to merge PR #${pullNumber} using '${mergeMethod}' strategy...`);

  try {
    const { data } = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: mergeMethod,
      // Providing the expected head SHA ensures we are merging the exact version of the code we evaluated.
      sha: headSha,
    });

    if (data.merged) {
      logger.success(`Successfully merged PR #${pullNumber}. New commit SHA: ${data.sha}`);
      return { sha: data.sha, message: data.message };
    }

    // This case should be rare, but we handle it defensively.
    const failureMessage = `GitHub API reported merge failed for PR #${pullNumber}: ${data.message}`;
    logger.warn(failureMessage);
    // We throw an error to ensure the calling process knows the merge was unsuccessful.
    throw new Error(failureMessage);
  } catch (error) {
    // The Octokit client throws detailed errors. We log it and re-throw a more specific error.
    const errorMessage = `Failed to merge PR #${pullNumber}. API response: ${error.message}`;
    logger.error(errorMessage, error);
    throw new Error(errorMessage);
  }
}