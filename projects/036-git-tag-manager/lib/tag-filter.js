/**
 * @file lib/tag-filter.js
 * @description Core filtering logic using the 'semver' package.
 * This module provides functions to parse, validate, and compare Git tags
 * against user-provided semantic versioning ranges. It is designed to
 * gracefully handle tags that do not conform to semver standards by
 * simply excluding them from the results.
 */

import semver from 'semver';

/**
 * Cleans a tag name to make it a valid semantic version string.
 * It primarily removes a leading 'v' if present, as `semver.valid()`
 * does not consider 'v1.0.0' to be a valid version string, but '1.0.0' is.
 *
 * @param {string} tagName - The raw tag name (e.g., 'v1.2.3' or 'release-2.4.5').
 * @returns {string} The cleaned tag name, suitable for semver parsing.
 */
function cleanTagName(tagName) {
  if (typeof tagName !== 'string' || tagName.length === 0) {
    return '';
  }
  // Remove a leading 'v' if it's followed by a digit (e.g., v1, v2.0)
  // but not if it's part of a word (e.g., 'version').
  return tagName.startsWith('v') && tagName.length > 1 && !isNaN(parseInt(tagName[1], 10))
    ? tagName.slice(1)
    : tagName;
}

/**
 * Filters a list of tags based on a semantic versioning range and sorts the result.
 * Tags that are not valid semantic versions are silently ignored.
 *
 * @param {string[]} tags - An array of tag names to filter.
 * @param {string} range - A semver range string (e.g., '>=1.0.0 <2.0.0', '1.x', '*').
 * @param {'asc' | 'desc' | null} [sortOrder=null] - The desired sort order.
 *        'asc' for ascending, 'desc' for descending. If null, no sorting is performed.
 * @returns {string[]} An array of original tag names that match the range, optionally sorted.
 */
export function filterTagsBySemver(tags, range, sortOrder = null) {
  if (!Array.isArray(tags)) {
    throw new TypeError('Input `tags` must be an array of strings.');
  }
  if (typeof range !== 'string') {
    throw new TypeError('Input `range` must be a string.');
  }

  const matchingTags = tags.filter(originalTag => {
    const cleanedTag = cleanTagName(originalTag);
    const validVersion = semver.valid(cleanedTag);

    // If the tag is not a valid semver, it cannot satisfy any range.
    if (!validVersion) {
      return false;
    }

    // `semver.satisfies` checks if the version meets the range criteria.
    // The `includePrerelease` option is important for ranges like '>=2.0.0-alpha'.
    return semver.satisfies(validVersion, range, { includePrerelease: true });
  });

  if (sortOrder) {
    // The `semver.compare` function is used as the comparator.
    // It returns -1, 0, or 1, which is compatible with `Array.prototype.sort`.
    // We clean the tags again inside the sort comparator to ensure correct comparison.
    matchingTags.sort((a, b) => {
      const cleanA = cleanTagName(a);
      const cleanB = cleanTagName(b);

      // We can assume they are valid semver strings because they passed the filter.
      const comparison = semver.compare(cleanA, cleanB);

      // For descending order, we reverse the comparison result.
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  return matchingTags;
}

/**
 * Checks if a given tag name is a valid semantic version.
 * This is a convenience function that encapsulates the cleaning logic.
 *
 * @param {string} tagName - The tag name to validate.
 * @returns {boolean} True if the tag is a valid semver string, false otherwise.
 */
export function isValidSemverTag(tagName) {
  const cleanedTag = cleanTagName(tagName);
  // `semver.valid()` returns the parsed version string on success, or null on failure.
  // We coerce this to a boolean.
  return !!semver.valid(cleanedTag);
}