/**
 * @file src/rules/author-rule.js
 * @module rules/author-rule
 * @description Implements a rule to identify trivial commits by matching the
 * commit author's name or email against a configurable exclusion list.
 */

/**
 * The author rule function.
 * It checks if a commit's author name or email is present in the configured `ignoreAuthors` list.
 * The check is case-insensitive.
 *
 * @async
 * @function authorRule
 * @param {object} commit - The commit object from the blame parser.
 * @param {string} commit.author - The author's name.
 * @param {string} commit['author-mail'] - The author's email address.
 * @param {object} context - The context object containing configuration.
 * @param {object} context.config - The application's merged configuration.
 * @param {string[]} [context.config.ignoreAuthors] - An array of author names or emails to ignore.
 * @returns {Promise<{isTrivial: boolean, reason: string|null}>} An object indicating if the commit is trivial and why.
 */
async function authorRule(commit, context) {
  const ignoreList = context?.config?.ignoreAuthors;

  // If the rule is not configured or the list is empty, it cannot determine triviality.
  if (!ignoreList || !Array.isArray(ignoreList) || ignoreList.length === 0) {
    return { isTrivial: false, reason: null };
  }

  // Defensive check for required commit properties.
  // The blame parser should always provide these.
  const authorName = commit?.author;
  const authorEmail = commit?.['author-mail'];

  if (!authorName && !authorEmail) {
    // This is an unusual case, but we handle it gracefully.
    // We cannot match, so the commit is not considered trivial by this rule.
    console.warn(`[AuthorRule] Commit ${commit.hash} is missing author name and email. Cannot apply rule.`);
    return { isTrivial: false, reason: 'Missing author information' };
  }

  // For efficient, case-insensitive lookup, we can create a Set of lowercased ignored authors.
  // This is a micro-optimization that pays off if the ignore list is large.
  const lowercasedIgnoreSet = new Set(ignoreList.map(item => String(item).toLowerCase()));

  // Check if the author's name is in the ignore list.
  if (authorName && lowercasedIgnoreSet.has(authorName.toLowerCase())) {
    return {
      isTrivial: true,
      reason: `Author name "${authorName}" is in the ignore list.`,
    };
  }

  // Check if the author's email (without the < >) is in the ignore list.
  if (authorEmail) {
    // The blame parser includes angle brackets in the email (e.g., `<user@example.com>`).
    // We should be robust and handle cases with or without them.
    const cleanEmail = authorEmail.replace(/^<|>$/g, '');
    if (lowercasedIgnoreSet.has(cleanEmail.toLowerCase())) {
      return {
        isTrivial: true,
        reason: `Author email "${cleanEmail}" is in the ignore list.`,
      };
    }
  }

  // If no match was found, the commit is not trivial according to this rule.
  return { isTrivial: false, reason: null };
}

export { authorRule };