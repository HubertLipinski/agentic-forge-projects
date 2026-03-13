/**
 * @file src/utils.js
 * @description Utility functions for formatting data for the Process Health Checker.
 * @author Your Name <your.email@example.com>
 * @license MIT
 */

/**
 * The number of bytes in one megabyte.
 * @constant {number}
 */
const BYTES_IN_MB = 1024 * 1024;

/**
 * Formats a duration in seconds into a human-readable HH:MM:SS string.
 *
 * @param {number} totalSeconds - The total duration in seconds. Must be a non-negative number.
 * @returns {string} The formatted time string (e.g., "01:23:45"). Returns "00:00:00" for invalid input.
 */
export function formatUptime(totalSeconds) {
  const seconds = Math.floor(totalSeconds ?? 0);

  if (!Number.isFinite(seconds) || seconds < 0) {
    // Defensive check for invalid input types or negative numbers
    return '00:00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const pad = (num) => String(num).padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
}

/**
 * Formats a memory size in bytes into a string with megabytes (MB),
 * rounded to two decimal places.
 *
 * @param {number} bytes - The memory size in bytes. Must be a non-negative number.
 * @returns {string} The formatted memory string (e.g., "123.45 MB"). Returns "0.00 MB" for invalid input.
 */
export function formatMemory(bytes) {
  const numBytes = bytes ?? 0;

  if (!Number.isFinite(numBytes) || numBytes < 0) {
    // Defensive check for invalid input types or negative numbers
    return '0.00 MB';
  }

  const megabytes = numBytes / BYTES_IN_MB;
  return `${megabytes.toFixed(2)} MB`;
}