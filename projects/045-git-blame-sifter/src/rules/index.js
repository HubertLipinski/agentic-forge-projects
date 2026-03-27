/**
 * @file src/rules/index.js
 * @module rules
 * @description Aggregates and exports all available filtering rules for consumption by the rule engine.
 *
 * This file serves as a central registry for all rule implementations. By exporting
 * them as a structured collection, it allows the rule engine to be decoupled from
 * the specific rule implementations. Adding a new rule simply involves creating
 * its file, implementing the rule logic, and then adding it to the `AVAILABLE_RULES`
 * array in this file.
 */

import { authorRule } from './author-rule.js';
import { commitMessageRule } from './commit-message-rule.js';
import { diffTrivialityRule } from './diff-triviality-rule.js';

/**
 * An array of available rule objects. Each object contains a unique name for the rule
 * and a reference to the rule's implementation function.
 *
 * The order of rules in this array can be significant for performance. Rules that are
 * computationally inexpensive and have a high probability of identifying a trivial
 * commit should be placed earlier in the array. This allows the rule engine to
 * short-circuit its evaluation, avoiding more costly checks (like diff analysis)
 * when possible.
 *
 * Current Order Rationale:
 * 1. `authorRule`: Very fast. A simple check against a pre-configured list.
 * 2. `commitMessageRule`: Fast. Involves a `git show` command, but it's highly
 *    optimized to fetch only the commit summary and is cached. Regex matching is quick.
 * 3. `diffTrivialityRule`: Potentially slow. Involves fetching file content for two
 *    revisions and performing a diff. This is the most expensive check and should
 *    run last.
 *
 * @type {Array<{name: string, rule: Function}>}
 */
export const AVAILABLE_RULES = [
  {
    name: 'authorRule',
    rule: authorRule,
  },
  {
    name: 'commitMessageRule',
    rule: commitMessageRule,
  },
  {
    name: 'diffTrivialityRule',
    rule: diffTrivialityRule,
  },
];

/**
 * A map of rule names to their corresponding functions for direct access if needed.
 * This can be useful for scenarios where rules need to be invoked by name.
 *
 * @type {Map<string, Function>}
 */
export const RULE_MAP = new Map(
  AVAILABLE_RULES.map(rule => [rule.name, rule.rule])
);