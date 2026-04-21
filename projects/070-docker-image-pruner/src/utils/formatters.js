/**
 * src/utils/formatters.js
 *
 * This module provides utility functions for formatting data for display in the CLI.
 * It leverages external libraries like 'filesize' for human-readable byte conversion
 * and 'dayjs' for flexible date and time formatting.
 *
 * @module utils/formatters
 */

import { filesize } from 'filesize';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

// Extend dayjs with the relativeTime plugin to format dates like "3 days ago"
dayjs.extend(relativeTime);

/**
 * Formats a numeric byte value into a human-readable string (e.g., 1024 -> "1 KB").
 * Uses the 'filesize' library for accurate and standardized formatting.
 *
 * @param {number} bytes - The number of bytes to format.
 * @returns {string} A human-readable string representation of the size.
 *                   Returns '0 B' if the input is not a valid number or is less than 0.
 */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) {
    return '0 B';
  }
  return filesize(bytes, { base: 2, standard: 'jedec' });
}

/**
 * Formats a Unix timestamp (in seconds) into a relative time string (e.g., "3 days ago").
 * Uses the 'dayjs' library with the relativeTime plugin.
 *
 * @param {number} unixTimestamp - The Unix timestamp in seconds.
 * @returns {string} A string representing the relative time from now.
 *                   Returns 'Invalid date' if the timestamp is not a valid number.
 */
export function formatRelativeTime(unixTimestamp) {
  if (typeof unixTimestamp !== 'number' || isNaN(unixTimestamp)) {
    return 'Invalid date';
  }
  // dayjs expects milliseconds, so we multiply the Unix timestamp by 1000.
  return dayjs.unix(unixTimestamp).fromNow();
}

/**
 * Formats a Unix timestamp (in seconds) into an absolute date string (e.g., "YYYY-MM-DD").
 *
 * @param {number} unixTimestamp - The Unix timestamp in seconds.
 * @param {string} [format='YYYY-MM-DD HH:mm:ss'] - The desired output format string for dayjs.
 * @returns {string} A formatted date string.
 *                   Returns 'Invalid date' if the timestamp is not a valid number.
 */
export function formatAbsoluteDate(unixTimestamp, format = 'YYYY-MM-DD HH:mm:ss') {
  if (typeof unixTimestamp !== 'number' || isNaN(unixTimestamp)) {
    return 'Invalid date';
  }
  return dayjs.unix(unixTimestamp).format(format);
}

/**
 * Truncates a string to a maximum length, appending an ellipsis if truncated.
 *
 * @param {string} str - The string to truncate.
 * @param {number} maxLength - The maximum allowed length of the string.
 * @returns {string} The truncated string, or the original string if it's within the max length.
 */
export function truncateString(str, maxLength) {
  if (typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLength) {
    return str;
  }
  return `${str.slice(0, maxLength - 1)}…`;
}

/**
 * Formats an array of image repository tags for display.
 * If the array is empty or contains '<none>:<none>', it returns a placeholder.
 * Otherwise, it joins the tags with a comma.
 *
 * @param {string[]} repoTags - An array of repository tags (e.g., ["ubuntu:22.04"]).
 * @returns {string} A formatted string of tags, or a placeholder for untagged images.
 */
export function formatRepoTags(repoTags) {
  if (!Array.isArray(repoTags) || repoTags.length === 0 || repoTags[0] === '<none>:<none>') {
    return '(untagged)';
  }
  return repoTags.join(', ');
}