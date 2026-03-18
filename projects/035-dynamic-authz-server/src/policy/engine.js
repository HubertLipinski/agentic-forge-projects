/**
 * @file src/policy/engine.js
 * @description The core authorization engine. It takes a policy set, user attributes,
 * and resource attributes, and evaluates them using 'json-logic-js' to return
 * an 'allow' or 'deny' decision.
 */

import jsonLogic from 'json-logic-js';
import logger from '../utils/logger.js';

/**
 * Represents the final decision of the authorization engine.
 * @typedef {'allow' | 'deny'} Decision
 */

/**
 * Represents the outcome of a policy evaluation.
 * @typedef {object} EvaluationResult
 * @property {Decision} decision - The final authorization decision ('allow' or 'deny').
 * @property {string | null} matchedPolicyId - The ID of the policy that determined the outcome, or null if no policy matched.
 * @property {string[]} reasons - An array of human-readable strings explaining the decision, useful for audit logging.
 */

/**
 * The core authorization engine that evaluates policies against a given context.
 *
 * The engine follows a "deny by default" principle. If no policies match the
 * request context, the decision will be 'deny'.
 *
 * It iterates through a set of policies and evaluates them in order. The first
 * policy that explicitly returns `true` (allow) or `false` (deny) from its
 * condition will determine the outcome.
 *
 * @param {object} params - The parameters for the authorization check.
 * @param {Array<object>} params.policies - An array of policy objects to evaluate. Each object should have an `id`, `description`, and a `condition` property.
 * @param {object} params.context - The combined context data, including user, resource, and action attributes.
 * @param {import('pino').Logger} [params.requestLogger=logger] - An optional request-specific logger instance.
 * @returns {EvaluationResult} The result of the policy evaluation.
 */
function evaluatePolicies({ policies, context, requestLogger = logger }) {
  if (!Array.isArray(policies) || policies.length === 0) {
    requestLogger.info('Authorization denied: No policies provided or available for evaluation.');
    return {
      decision: 'deny',
      matchedPolicyId: null,
      reasons: ['Default deny: No policies were available to evaluate.'],
    };
  }

  requestLogger.debug({ count: policies.length, context }, 'Starting policy evaluation.');

  for (const policy of policies) {
    // Basic validation for the policy object structure.
    if (!policy || typeof policy.id !== 'string' || typeof policy.condition !== 'object') {
      requestLogger.warn({ policyId: policy?.id }, 'Skipping malformed policy during evaluation.');
      continue;
    }

    try {
      const result = jsonLogic.apply(policy.condition, context);

      // json-logic can return truthy/falsy values, not just booleans.
      // We explicitly check for `true` to grant access. Anything else,
      // including `false`, `null`, `[]`, `0`, etc., is not an explicit allow.
      if (result === true) {
        const reason = `Allowed by policy "${policy.id}": ${policy.description || 'No description'}.`;
        requestLogger.info({ policyId: policy.id, context }, reason);
        return {
          decision: 'allow',
          matchedPolicyId: policy.id,
          reasons: [reason],
        };
      }

      // We log when a policy is evaluated but doesn't result in an explicit 'allow'.
      // This is useful for debugging why a request might be denied.
      requestLogger.trace(
        { policyId: policy.id, result },
        `Policy evaluated but did not result in an explicit allow.`,
      );
    } catch (error) {
      // This catches errors within json-logic-js, e.g., if a custom operation
      // throws an error or if the rule is fundamentally broken in a way that
      // the library can't handle gracefully.
      requestLogger.error(
        { policyId: policy.id, err: error.message, context },
        'Error occurred during evaluation of a policy condition. Treating as non-match.',
      );
      // Continue to the next policy, treating the errored one as a non-match.
    }
  }

  // If the loop completes without any policy explicitly allowing the request,
  // we deny it by default.
  const reason = 'Default deny: No policy explicitly allowed the request.';
  requestLogger.info({ context }, reason);
  return {
    decision: 'deny',
    matchedPolicyId: null,
    reasons: [reason],
  };
}

export { evaluatePolicies };