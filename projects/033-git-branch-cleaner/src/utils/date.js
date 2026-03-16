/**
 * src/utils/date.js
 *
 * This module provides date-related utility functions for the Git Branch Cleaner.
 * It leverages the 'date-fns' library to handle date parsing and calculations
 * in a robust and reliable way.
 *
 * @module utils/date
 */

import { differenceInDays, parseISO, isValid } from 'date-fns';

/**
 * Calculates the number of days that have passed since a given ISO 8601 date string.
 *
 * This function is used to determine the age of a branch based on its last commit date.
 * It safely parses the date string and returns the difference in calendar days from now.
 *
 * @param {string} isoDateString - The date of the last commit in ISO 8601 format (e.g., '2023-10-27 10:00:00 -0700').
 * @returns {number} The number of days since the given date. Returns -1 if the date string is invalid.
 * @throws {Error} If the input is not a string.
 */
export function getDaysSince(isoDateString) {
  if (typeof isoDateString !== 'string') {
    throw new Error('Invalid input: isoDateString must be a string.');
  }

  // parseISO is robust and can handle the format provided by git's committerdate:iso8601
  const date = parseISO(isoDateString);

  if (!isValid(date)) {
    // This provides a clear failure case for upstream consumers to handle,
    // preventing NaN from propagating through the application.
    console.warn(`Warning: Could not parse invalid date string: "${isoDateString}"`);
    return -1;
  }

  const now = new Date();
  return differenceInDays(now, date);
}

/**
 * Checks if a branch is "stale" by comparing its age in days against a given threshold.
 *
 * A branch is considered stale if the number of days since its last commit is
 * greater than or equal to the specified `staleThresholdInDays`.
 *
 * @param {string} lastCommitDate - The ISO 8601 date string of the branch's last commit.
 * @param {number} staleThresholdInDays - The number of days to use as the staleness threshold.
 * @returns {boolean} `true` if the branch is stale, `false` otherwise.
 */
export function isStale(lastCommitDate, staleThresholdInDays) {
  if (typeof staleThresholdInDays !== 'number' || staleThresholdInDays < 0) {
    throw new Error('Invalid staleThresholdInDays: must be a non-negative number.');
  }

  const daysSinceCommit = getDaysSince(lastCommitDate);

  // If the date was invalid, or if the threshold is 0 (meaning never stale),
  // we treat the branch as not stale.
  if (daysSinceCommit < 0 || staleThresholdInDays === 0) {
    return false;
  }

  return daysSinceCommit >= staleThresholdInDays;
}