/**
 * src/core/branch-deleter.js
 *
 * This module is responsible for the logic of deleting Git branches. It provides
 * a structured way to process a list of branches for deletion, handling both
 * normal and force-delete scenarios. It uses the underlying Git utilities
 * and provides clear, actionable results for each attempted deletion.
 *
 * @module core/branch-deleter
 */

import { deleteBranch as gitDeleteBranch } from '../utils/git.js';

/**
 * @typedef {import('./branch-lister.js').EnrichedBranchInfo} EnrichedBranchInfo
 */

/**
 * @typedef {object} DeletionResult
 * @property {string} branchName - The name of the branch that was targeted for deletion.
 * @property {boolean} success - Whether the deletion was successful.
 * @property {string} message - A message describing the outcome (e.g., success message or error reason).
 */

/**
 * @typedef {object} DeletionOptions
 * @property {boolean} force - Whether to use force-delete (`-D`) for unmerged branches.
 * @property {boolean} dryRun - If true, simulate deletion without making any changes.
 */

/**
 * Performs a pre-deletion check to ensure a branch is safe to delete.
 * This function encapsulates the business logic for when a branch can be deleted
 * based on its status and the provided options.
 *
 * @param {EnrichedBranchInfo} branch - The branch to check.
 * @param {DeletionOptions} options - The deletion options, specifically `force`.
 * @returns {{canDelete: boolean, reason: string | null}} An object indicating if deletion is permitted and why.
 */
function checkCanDelete(branch, { force }) {
  // These statuses are pre-filtered by `getDeletableBranches`, but this serves as a robust safeguard.
  if (branch.status === 'protected' || branch.status === 'current') {
    return {
      canDelete: false,
      reason: `Branch is ${branch.status} and cannot be deleted.`,
    };
  }

  // Merged branches are always safe to delete with a standard delete command.
  if (branch.status === 'merged') {
    return { canDelete: true, reason: null };
  }

  // For any other status (e.g., 'stale', 'active'), deletion requires the --force flag
  // because they are not fully merged into the current HEAD.
  if (!force) {
    return {
      canDelete: false,
      reason:
        "Branch is not fully merged. Use the '--force' flag to delete it.",
    };
  }

  // If the force flag is present, unmerged branches can be deleted.
  return { canDelete: true, reason: null };
}

/**
 * Processes a list of branches and attempts to delete each one according to the specified options.
 * It handles dry runs, pre-deletion safety checks, and aggregates the results.
 *
 * This is the main exported function of the module.
 *
 * @param {EnrichedBranchInfo[]} branchesToDelete - An array of enriched branch objects to be deleted.
 * @param {DeletionOptions} options - Configuration for the deletion process (force, dryRun).
 * @returns {Promise<DeletionResult[]>} A promise that resolves to an array of deletion result objects.
 */
export async function deleteBranches(branchesToDelete, options) {
  const { dryRun = false, force = false } = options;
  const results = [];

  for (const branch of branchesToDelete) {
    const { canDelete, reason } = checkCanDelete(branch, { force });

    if (!canDelete) {
      results.push({
        branchName: branch.name,
        success: false,
        message: reason ?? 'Deletion not permitted for an unknown reason.',
      });
      continue;
    }

    if (dryRun) {
      const deleteType = branch.status === 'merged' ? 'delete' : 'force-delete';
      results.push({
        branchName: branch.name,
        success: true, // In a dry run, "success" means it *would* be deleted.
        message: `[DRY RUN] Would ${deleteType} branch '${branch.name}'.`,
      });
      continue;
    }

    try {
      // For merged branches, `force` is false. For stale/unmerged, `force` is true (as per `checkCanDelete`).
      const useForceDelete = branch.status !== 'merged' && force;
      const result = gitDeleteBranch(branch.name, useForceDelete);

      results.push({
        branchName: branch.name,
        success: result.success,
        message: result.message,
      });
    } catch (error) {
      // This catches unexpected errors from the deletion utility itself, though `gitDeleteBranch` is designed to not throw.
      results.push({
        branchName: branch.name,
        success: false,
        message: `An unexpected error occurred: ${error.message}`,
      });
    }
  }

  return results;
}