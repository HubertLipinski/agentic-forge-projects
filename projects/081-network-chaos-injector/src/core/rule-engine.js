/**
 * @file src/core/rule-engine.js
 * @description Matches incoming intercepted requests against user-defined rules (host, path, method) to determine if chaos should be applied.
 * This engine supports matching by string, regular expression, or a wildcard function.
 *
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

/**
 * Checks if a request property (e.g., hostname, pathname) matches a rule's target value.
 * The target value can be a string, a RegExp, a function, or undefined (which always matches).
 *
 * @param {string} requestValue - The actual value from the intercepted request (e.g., 'api.example.com').
 * @param {string | RegExp | Function | undefined} ruleValue - The target value from the rule configuration.
 * @returns {boolean} `true` if the value matches the rule, `false` otherwise.
 */
function matches(requestValue, ruleValue) {
  // If the rule value is not defined, it's a wildcard and matches everything.
  if (ruleValue === undefined) {
    return true;
  }

  // If the rule value is a RegExp, test it against the request value.
  if (ruleValue instanceof RegExp) {
    return ruleValue.test(requestValue);
  }

  // If the rule value is a function, call it with the request value.
  // It's expected to return a boolean.
  if (typeof ruleValue === 'function') {
    // We assume the function is a simple predicate and does not throw.
    // Invalid function behavior should be caught during config validation if possible,
    // but here we treat a non-boolean return as a non-match.
    return ruleValue(requestValue) === true;
  }

  // If the rule value is a string, perform an exact, case-sensitive match.
  if (typeof ruleValue === 'string') {
    return requestValue === ruleValue;
  }

  // If the rule value is of any other type, it's considered a non-match.
  // This case should ideally be prevented by the config validator.
  return false;
}

/**
 * Finds the first rule in a list that matches the given request details.
 * Rules are evaluated in the order they appear in the array. The first match wins.
 *
 * @param {Array<object>} rules - An array of chaos rule objects. Each rule must have a `target` property.
 * @param {URL} url - The URL object of the outgoing request.
 * @param {string} method - The HTTP method of the outgoing request (e.g., 'GET', 'POST').
 * @returns {object | null} The matching rule object, or `null` if no rules match.
 */
export function findMatchingRule(rules, url, method) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return null;
  }

  // The URL object provides parsed and normalized components.
  const requestDetails = {
    host: url.hostname,
    method: method.toUpperCase(),
    path: url.pathname,
  };

  for (const rule of rules) {
    // A rule is considered valid for matching if it has a `target` object.
    // This check is a safeguard; `config-validator` should enforce this structure.
    if (!rule || typeof rule.target !== 'object' || rule.target === null) {
      continue;
    }

    const { target } = rule;

    // A rule matches if all its defined target properties match the request.
    const hostMatches = matches(requestDetails.host, target.host);
    const methodMatches = matches(requestDetails.method, target.method);
    const pathMatches = matches(requestDetails.path, target.path);

    if (hostMatches && methodMatches && pathMatches) {
      // This is the first rule that matches all its specified criteria.
      return rule;
    }
  }

  // If the loop completes without finding any matches, return null.
  return null;
}