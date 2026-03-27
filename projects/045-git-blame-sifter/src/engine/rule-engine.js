/**
 * @file src/engine/rule-engine.js
 * @module engine/rule-engine
 * @description Core logic that applies a set of configured rules to a given
 * commit to determine if it's trivial.
 */

import { performance } from 'node:perf_hooks';
import { authorRule } from '../rules/author-rule.js';
import { commitMessageRule } from '../rules/commit-message-rule.js';
import { diffTrivialityRule } from '../rules/diff-triviality-rule.js';

/**
 * A cache to store the final triviality result for a commit.
 * This prevents re-evaluating the same commit if it appears multiple times
 * in a blame analysis (e.g., for different lines in the same file).
 * The key is the commit hash.
 * @type {Map<string, {isTrivial: boolean, reason: string|null}>}
 */
const resultCache = new Map();

/**
 * A registry of available rules that the engine can execute.
 * The order of rules can impact performance. Rules that are computationally
 * cheap and likely to yield a positive result should come first.
 * For example, checking an author list or commit message regex is much
 * faster than performing a git diff.
 *
 * @type {Array<{name: string, rule: Function}>}
 */
const RULE_REGISTRY = [
  { name: 'authorRule', rule: authorRule },
  { name: 'commitMessageRule', rule: commitMessageRule },
  { name: 'diffTrivialityRule', rule: diffTrivialityRule },
];

/**
 * The Rule Engine is responsible for evaluating a commit against a set of
 * configured rules to determine if it represents a trivial change.
 *
 * It executes rules sequentially. If any rule positively identifies a commit
 * as trivial, the engine short-circuits and returns immediately, providing
 * the reason from the successful rule. This is an optimization to avoid
 * running expensive rules (like diff analysis) if a cheaper rule (like
 * a commit message check) has already confirmed triviality.
 *
 * @async
 * @function runRuleEngine
 * @param {object} commit - The commit object from the blame parser. Must include a `hash` property.
 * @param {object} context - The context object containing configuration and other shared data.
 * @param {object} context.config - The merged application configuration.
 * @param {string} context.repoPath - The absolute path to the repository being analyzed.
 * @returns {Promise<{isTrivial: boolean, reason: string|null}>} An object indicating if the commit is trivial and the reason why.
 */
export async function runRuleEngine(commit, context) {
  // --- Input Validation ---
  if (!commit?.hash) {
    // This is a critical error. The engine cannot function without a commit hash.
    throw new Error('[RuleEngine] A commit object with a valid "hash" property is required.');
  }
  if (!context?.config || !context?.repoPath) {
    // Context is essential for rules to access configuration and repository path.
    throw new Error('[RuleEngine] A context object with "config" and "repoPath" is required.');
  }

  // --- Cache Lookup ---
  if (resultCache.has(commit.hash)) {
    return resultCache.get(commit.hash);
  }

  // --- Rule Execution ---
  for (const { name, rule } of RULE_REGISTRY) {
    const startTime = performance.now();
    try {
      // Each rule is an async function that returns { isTrivial: boolean, reason: string|null }
      const result = await rule(commit, context);

      // --- Short-Circuit Logic ---
      // If a rule positively identifies the commit as trivial, we can stop processing.
      if (result?.isTrivial === true) {
        const finalResult = {
          isTrivial: true,
          reason: result.reason ?? `Identified by ${name}.`,
        };
        resultCache.set(commit.hash, finalResult);
        return finalResult;
      }

      // Handle cases where a rule fails internally but doesn't throw.
      // We log this but continue, as other rules might still apply.
      // The rule itself is responsible for logging the specific error.
      if (result?.isTrivial === false && result?.reason?.startsWith('Rule failed to execute')) {
        console.warn(`[RuleEngine] Rule '${name}' failed on commit ${commit.hash} but did not throw. Reason: ${result.reason}`);
      }

    } catch (error) {
      // If a rule throws an unexpected error, log it and treat the commit as non-trivial
      // to be safe. This prevents the entire analysis from halting due to a single faulty rule.
      console.error(`[RuleEngine] Unhandled exception in rule '${name}' for commit ${commit.hash}: ${error.message}`);
      // We don't cache failure results, as they might be transient (e.g., I/O error).
      return {
        isTrivial: false,
        reason: `Rule '${name}' encountered a critical error.`,
      };
    } finally {
        const duration = (performance.now() - startTime).toFixed(2);
        // Optional: Add a debug flag to show these logs. For now, they are commented out.
        // console.log(`[RuleEngine] Rule '${name}' on ${commit.hash} took ${duration}ms`);
    }
  }

  // --- Final Result ---
  // If no rule identified the commit as trivial, it is considered substantive.
  const finalResult = { isTrivial: false, reason: null };
  resultCache.set(commit.hash, finalResult);
  return finalResult;
}

/**
 * Clears all internal caches used by the rule engine and its underlying rules.
 * This is primarily useful for testing or long-running processes to prevent memory leaks.
 */
export function clearRuleEngineCache() {
  resultCache.clear();
  // We might need to call clear functions from individual rules if they manage their own caches.
  // For now, this is a placeholder for a more robust cache management system.
  // e.g., commitMessageRule.clearCache();
  console.log('[RuleEngine] All caches have been cleared.');
}