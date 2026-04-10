/**
 * @file src/config/validator.js
 * @description Implements validation logic for the configuration file schema to catch errors early.
 *
 * This module defines the expected structure of the `auto-merge.yml` configuration
 * and provides a function to validate a given configuration object against this schema.
 * It ensures that all required fields are present and that values are of the correct type
 * and within the expected range (e.g., for merge strategies).
 * This early validation prevents runtime errors and provides clear, actionable feedback
 * to the user if their configuration is invalid.
 */

import logger from '../utils/logger.js';

/**
 * A set of valid merge strategies supported by the GitHub API.
 * @type {Set<string>}
 */
const VALID_MERGE_STRATEGIES = new Set(['merge', 'squash', 'rebase']);

/**
 * A set of valid check policies.
 * 'all' requires all checks to pass.
 * 'stable' requires all required checks to pass and all others to be either passing or neutral.
 * @type {Set<string>}
 */
const VALID_CHECK_POLICIES = new Set(['all', 'stable']);

/**
 * Validates a single rule object against the defined schema.
 *
 * @param {object} rule - The rule object to validate.
 * @param {number} index - The index of the rule in the configuration array, for logging purposes.
 * @returns {string[]} A list of validation error messages. An empty array indicates a valid rule.
 */
function validateRule(rule, index) {
  const errors = [];
  const ruleIdentifier = `Rule #${index + 1}`;

  if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
    errors.push(`${ruleIdentifier} must be an object.`);
    // If it's not an object, further checks are pointless.
    return errors;
  }

  // Validate 'when' condition (must be an array of strings)
  if (!Array.isArray(rule.when) || rule.when.some(item => typeof item !== 'string')) {
    errors.push(`${ruleIdentifier}: 'when' condition must be an array of strings (labels, author, etc.).`);
  } else if (rule.when.length === 0) {
    errors.push(`${ruleIdentifier}: 'when' condition cannot be an empty array.`);
  }

  // Validate 'merge' strategy (optional, but must be valid if present)
  if (rule.merge !== undefined) {
    if (typeof rule.merge !== 'string' || !VALID_MERGE_STRATEGIES.has(rule.merge)) {
      const validStrategies = Array.from(VALID_MERGE_STRATEGIES).join(', ');
      errors.push(`${ruleIdentifier}: 'merge' strategy must be one of [${validStrategies}]. Found '${rule.merge}'.`);
    }
  }

  // Validate 'checks' policy (optional, but must be valid if present)
  if (rule.checks !== undefined) {
    if (typeof rule.checks !== 'string' || !VALID_CHECK_POLICIES.has(rule.checks)) {
      const validPolicies = Array.from(VALID_CHECK_POLICIES).join(', ');
      errors.push(`${ruleIdentifier}: 'checks' policy must be one of [${validPolicies}]. Found '${rule.checks}'.`);
    }
  }

  return errors;
}

/**
 * Validates the entire configuration object.
 *
 * It checks for the presence and type of the top-level `rules` array
 * and then validates each rule within that array.
 *
 * @param {object} config - The configuration object parsed from the YAML file.
 * @returns {{isValid: boolean, errors: string[]}} An object containing a boolean indicating validity
 * and an array of error messages.
 */
export function validateConfig(config) {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return {
      isValid: false,
      errors: ['Configuration must be a YAML object.'],
    };
  }

  if (!Array.isArray(config.rules)) {
    return {
      isValid: false,
      errors: ["Configuration must contain a top-level 'rules' key with an array of merge rules."],
    };
  }

  if (config.rules.length === 0) {
    logger.warn('Configuration file is valid but contains no rules. No pull requests will be merged.');
    return { isValid: true, errors: [] };
  }

  const allErrors = config.rules.flatMap((rule, index) => validateRule(rule, index));

  if (allErrors.length > 0) {
    return { isValid: false, errors: allErrors };
  }

  return { isValid: true, errors: [] };
}