/**
 * @file src/core/matcher.js
 * @description The core logic for evaluating a single pull request against the configured set of rules (labels, author, CI checks).
 *
 * This module contains the functions that form the heart of the decision-making process.
 * It takes a pull request and its associated details (like CI check runs and reviews)
 * and evaluates them against a specific rule from the user's configuration.
 * The functions here are pure and deterministic, making them easy to test and reason about.
 * They check for matching labels, authors, branch patterns, and CI status, ultimately
 * returning a clear "match" or "no match" result with detailed reasons.
 */

import { minimatch } from 'minimatch';
import logger from '../utils/logger.js';

/**
 * Checks if a pull request's author matches any of the author patterns in a rule.
 *
 * @param {string} prAuthor - The username of the pull request author.
 * @param {string[]} ruleConditions - The list of conditions from the rule's 'when' block.
 * @returns {{match: boolean, matchedAuthor?: string}} An object indicating if a match was found and which author pattern matched.
 */
function matchAuthor(prAuthor, ruleConditions) {
  const authorPatterns = ruleConditions
    .filter(cond => cond.startsWith('author:'))
    .map(cond => cond.substring('author:'.length));

  if (authorPatterns.length === 0) {
    return { match: false };
  }

  const matchedAuthor = authorPatterns.find(pattern => minimatch(prAuthor, pattern, { nocomment: true }));

  return {
    match: !!matchedAuthor,
    matchedAuthor,
  };
}

/**
 * Checks if a pull request has all the required labels specified in a rule.
 *
 * @param {string[]} prLabels - An array of label names on the pull request.
 * @param {string[]} ruleConditions - The list of conditions from the rule's 'when' block.
 * @returns {{match: boolean, requiredLabels: string[], missingLabels: string[]}} An object indicating the match status and any missing labels.
 */
function matchLabels(prLabels, ruleConditions) {
  const requiredLabels = ruleConditions
    .filter(cond => cond.startsWith('label:'))
    .map(cond => cond.substring('label:'.length));

  if (requiredLabels.length === 0) {
    return { match: false, requiredLabels: [], missingLabels: [] };
  }

  const prLabelSet = new Set(prLabels);
  const missingLabels = requiredLabels.filter(label => !prLabelSet.has(label));

  return {
    match: missingLabels.length === 0,
    requiredLabels,
    missingLabels,
  };
}

/**
 * Checks if a pull request's head and base branches match the patterns in a rule.
 *
 * @param {string} headBranch - The name of the pull request's head branch.
 * @param {string} baseBranch - The name of the pull request's base branch.
 * @param {string[]} ruleConditions - The list of conditions from the rule's 'when' block.
 * @returns {{match: boolean, matchedPattern?: string}} An object indicating if a match was found.
 */
function matchBranches(headBranch, baseBranch, ruleConditions) {
  const branchPatterns = ruleConditions
    .filter(cond => cond.startsWith('branch:'))
    .map(cond => cond.substring('branch:'.length));

  if (branchPatterns.length === 0) {
    return { match: false };
  }

  for (const pattern of branchPatterns) {
    const [headPattern, basePattern] = pattern.includes('<-')
      ? pattern.split('<-', 2)
      : [pattern, '*']; // If no `<-`, pattern applies to head, base can be anything.

    const headMatch = minimatch(headBranch, headPattern.trim(), { nocomment: true });
    const baseMatch = minimatch(baseBranch, basePattern.trim(), { nocomment: true });

    if (headMatch && baseMatch) {
      return { match: true, matchedPattern: pattern };
    }
  }

  return { match: false };
}

/**
 * Evaluates the CI/CD check runs against the rule's policy.
 *
 * - 'all': All checks must have a conclusion of 'success'.
 * - 'stable': All *required* checks must be 'success'. Non-required checks can be 'success', 'skipped', or 'neutral'. No checks can be 'failure', 'action_required', etc.
 *
 * @param {object[]} checkRuns - An array of check run objects from the GitHub API.
 * @param {string} checkPolicy - The policy to apply ('all' or 'stable').
 * @returns {{passed: boolean, reason: string}} An object indicating if the checks passed the policy and a reason for failure.
 */
function evaluateChecks(checkRuns, checkPolicy) {
  if (checkRuns.length === 0) {
    return { passed: true, reason: 'No check runs found.' };
  }

  const failingConclusions = new Set(['failure', 'action_required', 'cancelled', 'stale', 'timed_out']);
  const pendingStatuses = new Set(['queued', 'in_progress', 'pending']);
  const allowedStableConclusions = new Set(['success', 'skipped', 'neutral']);

  for (const check of checkRuns) {
    // Any pending check is an immediate failure for merging.
    if (pendingStatuses.has(check.status?.toLowerCase())) {
      return { passed: false, reason: `Pending check found: '${check.name}' has status '${check.status}'.` };
    }

    // Any explicitly failing conclusion is an immediate failure.
    if (failingConclusions.has(check.conclusion?.toLowerCase())) {
      return { passed: false, reason: `Failing check found: '${check.name}' has conclusion '${check.conclusion}'.` };
    }

    if (checkPolicy === 'all' && check.conclusion?.toLowerCase() !== 'success') {
      return { passed: false, reason: `Check '${check.name}' did not succeed (conclusion: ${check.conclusion}) as required by 'all' policy.` };
    }

    if (checkPolicy === 'stable' && !allowedStableConclusions.has(check.conclusion?.toLowerCase())) {
      return { passed: false, reason: `Check '${check.name}' has an unstable conclusion '${check.conclusion}' which is not allowed by 'stable' policy.` };
    }
  }

  return { passed: true, reason: 'All checks passed the required policy.' };
}

/**
 * The main matcher function that evaluates a pull request against a single rule.
 *
 * This function orchestrates the various matching sub-functions (author, labels, branches)
 * and evaluates CI checks. It determines if a PR is a candidate for merging under a given rule.
 *
 * @param {object} pullRequest - The pull request object from the GitHub API.
 * @param {object} details - The detailed status of the PR (checks, reviews, etc.).
 * @param {object} rule - A single rule object from the configuration.
 * @returns {Promise<{
 *   isMatch: boolean,
 *   mergeMethod: string,
 *   reasons: string[]
 * }>} A promise that resolves to a match result object.
 */
export async function evaluatePullRequest(pullRequest, details, rule) {
  const prNumber = pullRequest.number;
  const reasons = [];

  // --- Pre-condition checks ---
  if (details.isDraft) {
    reasons.push(`PR #${prNumber} is a draft.`);
    return { isMatch: false, mergeMethod: rule.merge, reasons };
  }

  // The 'unstable' state means there are merge conflicts.
  if (details.mergeableState === 'unstable') {
    reasons.push(`PR #${prNumber} has merge conflicts.`);
    return { isMatch: false, mergeMethod: rule.merge, reasons };
  }

  // 'blocked' means failing checks or required reviews are missing.
  if (details.mergeableState === 'blocked') {
    reasons.push(`PR #${prNumber} is blocked (failing checks or missing required reviews).`);
    // Continue evaluation to provide more specific reasons below.
  }

  // --- Rule condition matching ---
  const prLabels = pullRequest.labels.map(label => label.name);
  const prAuthor = pullRequest.user.login;
  const prHeadBranch = pullRequest.head.ref;
  const prBaseBranch = pullRequest.base.ref;

  const authorResult = matchAuthor(prAuthor, rule.when);
  const labelResult = matchLabels(prLabels, rule.when);
  const branchResult = matchBranches(prHeadBranch, prBaseBranch, rule.when);

  // A PR must match at least one of the specified 'when' condition types.
  if (!authorResult.match && !labelResult.match && !branchResult.match) {
    reasons.push(`PR #${prNumber} does not match any 'when' conditions for this rule.`);
    return { isMatch: false, mergeMethod: rule.merge, reasons };
  }

  if (authorResult.match) {
    reasons.push(`Author '${prAuthor}' matches pattern '${authorResult.matchedAuthor}'.`);
  }
  if (labelResult.match) {
    reasons.push(`All required labels found: [${labelResult.requiredLabels.join(', ')}].`);
  } else if (labelResult.requiredLabels.length > 0) {
    reasons.push(`Missing required labels: [${labelResult.missingLabels.join(', ')}].`);
    return { isMatch: false, mergeMethod: rule.merge, reasons };
  }
  if (branchResult.match) {
    reasons.push(`Branches '${prHeadBranch} <- ${prBaseBranch}' match pattern '${branchResult.matchedPattern}'.`);
  }

  // --- CI/CD Status Check ---
  const checksResult = evaluateChecks(details.checkRuns, rule.checks);
  if (!checksResult.passed) {
    reasons.push(`CI checks do not meet the '${rule.checks}' policy: ${checksResult.reason}`);
    return { isMatch: false, mergeMethod: rule.merge, reasons };
  }
  reasons.push(`CI checks passed the '${rule.checks}' policy.`);

  // --- Final Decision ---
  // If we've reached this point, all conditions have been met.
  logger.info(`PR #${prNumber} is a match for rule with conditions: [${rule.when.join(', ')}]`);
  return {
    isMatch: true,
    mergeMethod: rule.merge,
    reasons,
  };
}