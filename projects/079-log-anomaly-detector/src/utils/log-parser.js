/**
 * @file src/utils/log-parser.js
 * @description A utility to parse incoming log lines, extracting timestamps, levels,
 * and normalizing messages to create structural patterns.
 *
 * This parser is designed to be robust against common log formats. It uses a series
 * of regular expressions to identify and extract structured data, then normalizes
 * the remaining message to create a consistent pattern for anomaly detection.
 */

// A collection of regular expressions to match common timestamp formats.
// Ordered from more specific to more general to improve matching accuracy.
const TIMESTAMP_REGEXPS = [
  /(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,9}Z?)/, // ISO 8601 with optional Z
  /(?<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/, // YYYY-MM-DD HH:MM:SS
  /(?<timestamp>\w{3} \d{1,2} \d{2}:\d{2}:\d{2})/, // e.g., "Jan 5 02:54:21" (syslog)
];

// A regex to match common log level indicators. Case-insensitive.
const LEVEL_REGEXP = /(?<level>TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)/i;

// Regex patterns for common data types to be replaced with placeholders.
// This is the core of message normalization for pattern generation.
const NORMALIZATION_PATTERNS = [
  // UUIDs (e.g., 123e4567-e89b-12d3-a456-426614174000)
  { regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, placeholder: '<UUID>' },
  // Email addresses
  { regex: /[\w.-]+@[\w.-]+\.\w+/g, placeholder: '<EMAIL>' },
  // IP Addresses (IPv4 and IPv6)
  { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, placeholder: '<IP_ADDRESS>' },
  // URLs/URIs
  { regex: /(?:https?|ftp):\/\/[^\s/$.?#].[^\s]*/gi, placeholder: '<URL>' },
  // File paths (Unix-like and Windows)
  { regex: /(?:\/[a-zA-Z0-9_.-]+)+|([a-zA-Z]:\\[\\\S|*\S]?.*)/g, placeholder: '<PATH>' },
  // Hexadecimal values (e.g., 0xdeadbeef)
  { regex: /0x[0-9a-fA-F]+/g, placeholder: '<HEX>' },
  // Numbers (integers and floats, handles negative numbers)
  { regex: /-?\b\d+(\.\d+)?\b/g, placeholder: '<NUM>' },
];

/**
 * Extracts the timestamp from a log line using a series of regex patterns.
 * @param {string} line - The raw log line.
 * @returns {Date|null} A Date object if a timestamp is found, otherwise null.
 */
function extractTimestamp(line) {
  for (const regex of TIMESTAMP_REGEXPS) {
    const match = line.match(regex);
    if (match?.groups?.timestamp) {
      const date = new Date(match.groups.timestamp);
      // Check if the date is valid. `new Date('invalid')` returns an invalid Date object.
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  return null;
}

/**
 * Extracts the log level from a log line.
 * @param {string} line - The raw log line.
 * @returns {string|null} The log level in uppercase (e.g., "INFO", "ERROR"), or null if not found.
 */
function extractLevel(line) {
  const match = line.match(LEVEL_REGEXP);
  return match?.groups?.level?.toUpperCase() ?? null;
}

/**
 * Normalizes a log message by replacing variable parts (like numbers, UUIDs, IPs)
 * with static placeholders. This helps in identifying the structural pattern of the message.
 *
 * @param {string} message - The log message content.
 * @returns {string} The normalized message string, which serves as the pattern.
 */
function normalizeMessage(message) {
  let normalized = message;
  for (const { regex, placeholder } of NORMALIZATION_PATTERNS) {
    normalized = normalized.replace(regex, placeholder);
  }
  // Collapse multiple whitespace characters into a single space for consistency.
  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Parses a single raw log line into a structured object.
 * It extracts timestamp and level, then normalizes the rest of the message to create a pattern.
 *
 * @param {string} line - The raw log line to parse.
 * @returns {object} A structured log object containing:
 *  - {string} originalLine: The original, unmodified log line.
 *  - {Date} timestamp: The extracted timestamp, or the current time if none is found.
 *  - {string|null} level: The extracted log level, or null.
 *  - {string} message: The log message, with timestamp and level removed.
 *  - {string} pattern: A normalized version of the message for pattern matching.
 */
export function parseLogLine(line) {
  if (typeof line !== 'string' || line.trim() === '') {
    return null;
  }

  const originalLine = line;
  let message = line;

  const timestamp = extractTimestamp(message);
  if (timestamp) {
    // Remove the matched timestamp part to clean up the message for further parsing.
    // We do a simple string replacement, which is safe as we matched it.
    for (const regex of TIMESTAMP_REGEXPS) {
        const match = message.match(regex);
        if (match) {
            message = message.replace(match[0], '');
            break;
        }
    }
  }

  const level = extractLevel(message);
  if (level) {
    // Remove the matched level part.
    const match = message.match(LEVEL_REGEXP);
    if (match) {
        message = message.replace(match[0], '');
    }
  }

  // Clean up the remaining message by removing extra whitespace, brackets, etc.
  const cleanedMessage = message.replace(/[\[\]():-]/g, ' ').trim();
  const pattern = normalizeMessage(cleanedMessage);

  return {
    originalLine,
    timestamp: timestamp ?? new Date(), // Fallback to current time if no timestamp is found
    level,
    message: cleanedMessage,
    pattern,
  };
}