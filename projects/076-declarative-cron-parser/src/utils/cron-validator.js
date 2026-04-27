/**
 * @file src/utils/cron-validator.js
 * @description A lightweight utility to validate the structure and ranges of a cron expression string.
 * This module provides a function to check if a given string is a syntactically valid
 * standard 5-part cron expression. It does not validate semantics (e.g., February 30th).
 */

/**
 * Defines the valid range for each part of a cron expression.
 * The order is significant: [minute, hour, day of month, month, day of week].
 * @private
 * @type {Readonly<Array<{min: number, max: number}>>}
 */
const CRON_PART_RANGES = Object.freeze([
  { min: 0, max: 59 }, // Minute
  { min: 0, max: 23 }, // Hour
  { min: 1, max: 31 }, // Day of Month
  { min: 1, max: 12 }, // Month
  { min: 0, max: 7 }, // Day of Week (0 and 7 are both Sunday)
]);

/**
 * A regular expression to validate the allowed characters and structure of a single cron part.
 * It allows:
 * - `*` (asterisk)
 * - `?` (question mark, for day of month/week)
 * - `L` (last, for day of month/week)
 * - `W` (weekday, for day of month)
 * - `#` (nth day, for day of week)
 * - Digits (0-9)
 * - `,` (comma for lists)
 * - `-` (hyphen for ranges)
 * - `/` (slash for steps)
 *
 * This regex is intentionally permissive on combinations (e.g., `*,/`),
 * as the `validateCronPart` function performs more detailed structural checks.
 * @private
 * @type {RegExp}
 */
const CRON_PART_CHARS_REGEX = /^[\d*?,L W#/-]+$/;

/**
 * Validates a single part of a cron expression (e.g., the "minutes" part).
 *
 * @private
 * @param {string} part - The cron part string to validate (e.g., "0-5", "*/15").
 * @param {{min: number, max: number}} range - The valid min/max values for this part.
 * @returns {boolean} `true` if the part is valid, `false` otherwise.
 */
function validateCronPart(part, range) {
  if (!CRON_PART_CHARS_REGEX.test(part)) {
    return false;
  }

  // Split by comma for list validation (e.g., "1,5,10")
  const subParts = part.split(',');

  for (const subPart of subParts) {
    // Handle step values (e.g., "*/15", "0-30/5")
    const stepSplit = subPart.split('/');
    if (stepSplit.length > 2) {
      return false; // Invalid format like "*/15/2"
    }

    const valuePart = stepSplit[0];
    const stepValue = stepSplit[1];

    if (stepValue !== undefined && !/^\d+$/.test(stepValue)) {
      return false; // Step value must be a positive integer
    }

    // Handle range values (e.g., "1-5")
    const rangeSplit = valuePart.split('-');
    if (rangeSplit.length > 2) {
      return false; // Invalid format like "1-5-10"
    }

    // Validate each component of the range (or the single value)
    for (const singleValue of rangeSplit) {
      // Allow '*' but not as part of a multi-character value like "1*"
      if (singleValue === '*') {
        if (singleValue.length > 1) return false;
        continue;
      }

      // Allow special characters for day-of-month and day-of-week
      // Note: This check is basic and doesn't enforce which part they are in.
      // The overall structure check is sufficient for our parsing needs.
      if (/[?LW#]/.test(singleValue)) {
        continue;
      }

      // If not a special character, it must be a number within the valid range.
      if (!/^\d+$/.test(singleValue)) {
        return false; // Contains non-digit characters
      }

      const num = parseInt(singleValue, 10);
      if (num < range.min || num > range.max) {
        return false; // Number is out of the allowed range
      }
    }

    // If it's a range, ensure the start is not greater than the end
    if (rangeSplit.length === 2) {
      const start = parseInt(rangeSplit[0], 10);
      const end = parseInt(rangeSplit[1], 10);
      if (!isNaN(start) && !isNaN(end) && start > end) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validates a standard 5-part cron expression string.
 *
 * This function checks for:
 * 1. The correct number of parts (exactly 5).
 * 2. Valid characters within each part.
 * 3. Valid numerical ranges for each part (e.g., minutes 0-59).
 *
 * It does not validate extended cron syntax (like `@daily`) or semantic correctness
 * (e.g., `30 2 31 2 *` for "Feb 31st"), as most cron daemons handle these gracefully.
 *
 * @param {string} expression - The cron expression to validate.
 * @returns {boolean} `true` if the expression is syntactically valid, `false` otherwise.
 *
 * @example
 * isValidCron("0 5 * * *") // => true
 * isValidCron("*/15 0,12 1-15 * 1-5") // => true
 * isValidCron("60 * * * *") // => false (minute out of range)
 * isValidCron("0 5 * *") // => false (not enough parts)
 * isValidCron("invalid") // => false
 */
export function isValidCron(expression) {
  if (typeof expression !== 'string') {
    return false;
  }

  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return false;
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const range = CRON_PART_RANGES[i];
    if (!validateCronPart(part, range)) {
      return false;
    }
  }

  return true;
}