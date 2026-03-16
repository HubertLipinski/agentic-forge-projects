/**
 * src/core/branch-lister.js
 *
 * This module contains the main logic for fetching, enriching, and filtering
 * local Git branches. It acts as the core data provider for the application,
 * preparing a structured list of branches that can be presented to the user
 * or passed to the deletion module.
 *
 * @module core/branch-lister
 */

import { getLocalBranches, checkIsRepo } from '../utils/git.js';
import { isStale } from '../utils/date.js';

/**
 * @typedef {import('../utils/git.js').GitBranchInfo} GitBranchInfo
 */

/**
 * @typedef {'merged' | 'stale' | 'protected' | 'current' | 'active'} BranchStatus
 *   - 'merged': The branch is fully merged into the current branch.
 *   - 'stale': The branch has not been updated in a while (based on a threshold).
 *   - 'protected': The branch is in the exclusion list.
 *   - 'current': This is the currently checked-out branch.
 *   - 'active': An unmerged, non-stale branch.
 */

/**
 * @typedef {GitBranchInfo & { status: BranchStatus, daysSinceCommit: number }} EnrichedBranchInfo
 *   An enriched branch object containing calculated status and age.
 */

/**
 * @typedef {object} BranchFilters
 * @property {boolean} [includeMerged=true] - Whether to include merged branches in the result.
 * @property {boolean} [includeStale=true] - Whether to include stale branches in the result.
 */

/**
 * @typedef {object} ListerOptions
 * @property {number} staleThresholdInDays - Number of days for a branch to be considered stale.
 * @property {string[]} exclusionList - A list of branch names to protect from any action.
 */

/**
 * Determines the status of a branch based on its properties and the defined rules.
 * The order of checks is important as it defines the priority of statuses.
 *
 * @param {GitBranchInfo} branch - The basic branch information.
 * @param {ListerOptions} options - The lister configuration options.
 * @returns {BranchStatus} The calculated status of the branch.
 */
function getBranchStatus(branch, options) {
  const { staleThresholdInDays, exclusionList } = options;

  if (branch.isCurrent) {
    return 'current';
  }
  if (exclusionList.includes(branch.name)) {
    return 'protected';
  }
  if (branch.isMerged) {
    return 'merged';
  }
  if (isStale(branch.lastCommitDate, staleThresholdInDays)) {
    return 'stale';
  }

  return 'active';
}

/**
 * Fetches all local branches and enriches them with status and age information.
 * This function serves as the primary data source for the application's logic.
 *
 * @param {ListerOptions} options - Configuration for staleness and exclusions.
 * @returns {Promise<EnrichedBranchInfo[]>} A promise that resolves to an array of enriched branch objects.
 * @throws {Error} If it fails to fetch branch information from Git.
 */
async function getEnrichedBranches(options) {
  try {
    const rawBranches = await getLocalBranches();
    const enrichedBranches = rawBranches.map(branch => {
      const status = getBranchStatus(branch, options);
      return {
        ...branch,
        status,
      };
    });
    return enrichedBranches;
  } catch (error) {
    // Re-throw with a more context-specific message for the consumer.
    throw new Error(`Failed to retrieve and process branch list: ${error.message}`);
  }
}

/**
 * Fetches and filters local Git branches based on specified criteria.
 * It ensures the current directory is a Git repository before proceeding.
 *
 * This is the main exported function of the module, orchestrating the fetching,
 * enrichment, and filtering of branches.
 *
 * @param {ListerOptions} options - Configuration for staleness and exclusions.
 * @param {BranchFilters} filters - Criteria for filtering the branches to be returned.
 * @returns {Promise<EnrichedBranchInfo[]>} A promise that resolves to a filtered list of deletable branches.
 */
export async function getDeletableBranches(options, filters) {
  // Pre-flight check to ensure we are in a git repository.
  // This provides a user-friendly error early in the process.
  checkIsRepo();

  const allBranches = await getEnrichedBranches(options);

  const { includeMerged = true, includeStale = true } = filters;

  const deletableBranches = allBranches.filter(branch => {
    // Never include 'current' or 'protected' branches in the deletable list.
    if (branch.status === 'current' || branch.status === 'protected') {
      return false;
    }

    const isMergedMatch = includeMerged && branch.status === 'merged';
    const isStaleMatch = includeStale && branch.status === 'stale';

    return isMergedMatch || isStaleMatch;
  });

  // Sort the results for consistent and predictable output.
  // Merged branches are often higher priority for deletion, so they come first.
  deletableBranches.sort((a, b) => {
    if (a.status === 'merged' && b.status !== 'merged') return -1;
    if (a.status !== 'merged' && b.status === 'merged') return 1;
    // For branches with the same status, sort by name alphabetically.
    return a.name.localeCompare(b.name);
  });

  return deletableBranches;
}