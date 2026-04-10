/**
 * @file src/core/processor.js
 * @description The main processing engine. Fetches all open pull requests for a repo and uses the matcher to identify candidates for merging.
 *
 * This module orchestrates the entire auto-merging process. It fetches open pull requests,
 * iterates through them, and for each PR, evaluates it against the set of configured rules.
 * It uses a concurrency queue (`p-queue`) to process PRs in parallel without overwhelming
 * the GitHub API and hitting rate limits. It also handles the final merge action for
 * matched PRs, respecting the dry-run mode.
 */

import PQueue from 'p-queue';
import logger from '../utils/logger.js';
import { fetchOpenPullRequests, getPullRequestDetails, mergePullRequest } from '../github/api.js';
import { evaluatePullRequest } from './matcher.js';

/**
 * Processes a single pull request against all configured rules.
 * It fetches detailed PR status and then evaluates each rule sequentially.
 * If a match is found, it either performs the merge or logs it in dry-run mode.
 *
 * @param {object} pullRequest - The pull request object from the API.
 * @param {object} context - The operational context.
 * @param {string} context.owner - The repository owner.
 * @param {string} context.repo - The repository name.
 * @param {object[]} context.rules - The array of configured merge rules.
 * @param {boolean} context.dryRun - If true, no merge will be performed.
 * @returns {Promise<{merged: boolean, prNumber: number, reason: string}>} A promise that resolves with the processing result.
 */
async function processSinglePullRequest(pullRequest, context) {
  const { owner, repo, rules, dryRun } = context;
  const prNumber = pullRequest.number;
  const headSha = pullRequest.head.sha;

  logger.info(`Processing PR #${prNumber}: "${pullRequest.title}"`);

  let details;
  try {
    details = await getPullRequestDetails({ owner, repo, pullNumber: prNumber, headSha });
  } catch (error) {
    logger.warn(`Could not retrieve details for PR #${prNumber}. Skipping. Reason: ${error.message}`);
    return { merged: false, prNumber, reason: 'Failed to fetch details' };
  }

  for (const rule of rules) {
    const { isMatch, mergeMethod, reasons } = await evaluatePullRequest(pullRequest, details, rule);

    if (isMatch) {
      const logPrefix = dryRun ? 'DRY-RUN' : 'MERGE';
      const actionVerb = dryRun ? 'would be merged' : 'will be merged';
      const message = `PR #${prNumber} matched rule [${rule.when.join(', ')}] and ${actionVerb} with strategy '${mergeMethod}'.`;

      logger.log(logPrefix, message);
      reasons.forEach(reason => logger.log(logPrefix, `  - ${reason}`));

      if (!dryRun) {
        try {
          await mergePullRequest({ owner, repo, pullNumber: prNumber, headSha, mergeMethod });
          return { merged: true, prNumber, reason: `Merged with strategy '${mergeMethod}'` };
        } catch (error) {
          // Error is already logged by the API function.
          // We stop processing further rules for this PR as the merge attempt failed.
          return { merged: false, prNumber, reason: `Merge attempt failed: ${error.message}` };
        }
      } else {
        // In dry-run mode, once a match is found, we don't need to check other rules.
        return { merged: false, prNumber, reason: `Dry-run: Matched rule with strategy '${mergeMethod}'` };
      }
    }
  }

  // If no rules matched after checking all of them.
  logger.info(`PR #${prNumber} did not match any merge rules. Skipping.`);
  return { merged: false, prNumber, reason: 'No matching rules' };
}

/**
 * The main processing function.
 * Fetches all open pull requests and processes them concurrently against the configuration.
 *
 * @param {object} options - The main options for the processor.
 * @param {string} options.owner - The owner of the repository.
 * @param {string} options.repo - The name of the repository.
 * @param {object} options.config - The loaded and validated configuration object.
 * @param {boolean} [options.dryRun=false] - If true, simulate merges without performing them.
 * @param {number} [options.concurrency=5] - The number of PRs to process concurrently.
 * @returns {Promise<{
 *   total: number,
 *   merged: number,
 *   skipped: number,
 *   failed: number
 * }>} A summary of the processing results.
 */
export async function processRepository(options) {
  const { owner, repo, config, dryRun = false, concurrency = 5 } = options;

  if (!owner || !repo) {
    throw new Error('Repository owner and name must be provided.');
  }

  if (!config || !Array.isArray(config.rules)) {
    throw new Error('A valid configuration object with rules must be provided.');
  }

  logger.info(`Starting auto-merge process for ${owner}/${repo}`);
  if (dryRun) {
    logger.log('DRY-RUN', 'Dry-run mode is enabled. No pull requests will be merged.');
  }

  let pullRequests;
  try {
    pullRequests = await fetchOpenPullRequests({ owner, repo });
  } catch (error) {
    // Error is already logged by the API function.
    // We cannot proceed without the list of PRs.
    return { total: 0, merged: 0, skipped: 0, failed: 1 };
  }

  if (pullRequests.length === 0) {
    logger.info('No open pull requests to process. Exiting.');
    return { total: 0, merged: 0, skipped: 0, failed: 0 };
  }

  const queue = new PQueue({ concurrency });
  const results = [];

  const context = { owner, repo, rules: config.rules, dryRun };

  pullRequests.forEach(pr => {
    queue.add(async () => {
      const result = await processSinglePullRequest(pr, context);
      results.push(result);
    });
  });

  await queue.onIdle();

  const summary = {
    total: pullRequests.length,
    merged: results.filter(r => r.merged).length,
    skipped: results.filter(r => !r.merged && !r.reason.startsWith('Merge attempt failed')).length,
    failed: results.filter(r => r.reason.startsWith('Merge attempt failed')).length,
  };

  logger.info('--- Processing Summary ---');
  logger.info(`Total pull requests processed: ${summary.total}`);
  if (dryRun) {
    const wouldMergeCount = results.filter(r => r.reason.startsWith('Dry-run')).length;
    logger.log('DRY-RUN', `Pull requests that would be merged: ${wouldMergeCount}`);
  } else {
    logger.success(`Successfully merged: ${summary.merged}`);
  }
  logger.info(`Skipped (no match or pre-condition fail): ${summary.skipped}`);
  if (summary.failed > 0) {
    logger.error(`Failed to merge: ${summary.failed}`);
  }
  logger.info('--------------------------');

  return summary;
}