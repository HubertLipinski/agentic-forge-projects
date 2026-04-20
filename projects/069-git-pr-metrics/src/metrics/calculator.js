/**
 * @file src/metrics/calculator.js
 * @description Contains the business logic for calculating key metrics from parsed pull request data.
 * This module takes enriched PR data and computes derived metrics for each individual PR.
 */

import { differenceInHours } from 'date-fns';

/**
 * Calculates derived metrics for a single pull request.
 *
 * This function takes a raw PR data object (enriched with commit and diff info)
 * and computes key performance indicators such as time-to-merge, PR size, and code churn.
 *
 * @param {object} pr - The enriched pull request data object from `pr-fetcher`.
 *   It must contain at least:
 *   - `prNumber`: The pull request number.
 *   - `firstCommitAt`: A Date object for the first commit on the PR branch.
 *   - `mergedAt`: A Date object for when the PR was merged.
 *   - `additions`: The number of lines added.
 *   - `deletions`: The number of lines deleted.
 * @returns {object|null} An object containing the calculated metrics for the PR,
 *   or `null` if the input PR object is invalid or missing required date fields.
 *   The returned object includes:
 *   - `prNumber`: The original PR number for identification.
 *   - `timeToMergeHours`: The total time in hours from the first commit to merge.
 *   - `prSize`: A qualitative size label ('XS', 'S', 'M', 'L', 'XL').
 *   - `totalChanges`: The sum of additions and deletions.
 *   - `codeChurn`: The net change in lines of code (additions - deletions).
 *   - `additions`: The original additions count.
 *   - `deletions`: The original deletions count.
 *   - `mergedAt`: The original merge date.
 */
function calculatePrMetrics(pr) {
  // Defensive check: Ensure the PR object and its critical date properties are valid.
  // This prevents errors if a PR's history is unusual (e.g., missing commit dates).
  if (!pr?.firstCommitAt || !pr?.mergedAt) {
    console.warn(
      `[Warning] Skipping metrics for PR #${pr.prNumber} due to missing date information.`,
    );
    return null;
  }

  // Calculate Time to Merge: The duration from the very first commit on the branch
  // until the PR is merged. This represents the full lifecycle of the feature or fix.
  // We use `differenceInHours` for a practical and commonly used unit.
  const timeToMergeHours = differenceInHours(pr.mergedAt, pr.firstCommitAt);

  // Calculate total changes and code churn.
  const totalChanges = pr.additions + pr.deletions;
  const codeChurn = pr.additions - pr.deletions;

  // Categorize PR Size based on the total number of lines changed (additions + deletions).
  // These thresholds are common industry starting points but could be made configurable.
  const prSize = getPrSizeLabel(totalChanges);

  return {
    prNumber: pr.prNumber,
    title: pr.title,
    timeToMergeHours,
    prSize,
    totalChanges,
    codeChurn,
    additions: pr.additions,
    deletions: pr.deletions,
    mergedAt: pr.mergedAt,
  };
}

/**
 * Processes an array of pull requests and calculates metrics for each one.
 *
 * This function serves as the main entry point for the calculator module. It iterates
 * over a list of PRs, applies the `calculatePrMetrics` function to each, and returns
*  a new array containing the results. It gracefully filters out any PRs that
 * could not be processed due to invalid or missing data.
 *
 * @param {Array<object>} prs - An array of enriched PR data objects from `pr-fetcher`.
 * @returns {Array<object>} An array of PRs with their calculated metrics.
 *   Each object in the array is the result from `calculatePrMetrics`.
 * @throws {Error} If the input `prs` is not an array.
 */
export function calculateMetrics(prs) {
  if (!Array.isArray(prs)) {
    throw new Error('Invalid input: Expected an array of pull requests.');
  }

  return prs
    .map(calculatePrMetrics)
    // Filter out any null results, which occur for PRs with incomplete data.
    // This ensures the aggregator only receives valid, processable metric objects.
    .filter(Boolean);
}

/**
 * Determines a qualitative size label for a pull request based on the total lines changed.
 *
 * @private
 * @param {number} totalChanges - The sum of lines added and deleted.
 * @returns {string} A size label ('XS', 'S', 'M', 'L', 'XL').
 */
function getPrSizeLabel(totalChanges) {
  if (totalChanges < 10) return 'XS'; // Trivial changes (e.g., typos, docs)
  if (totalChanges < 50) return 'S'; // Small, focused changes
  if (totalChanges < 250) return 'M'; // Medium-sized features or refactors
  if (totalChanges < 1000) return 'L'; // Large features, significant refactoring
  return 'XL'; // Extra-large, potentially needs to be split
}