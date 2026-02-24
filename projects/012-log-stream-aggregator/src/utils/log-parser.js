/**
 * @file src/utils/log-parser.js
 * @description A module to parse unstructured log lines and enrich them with metadata.
 *
 * This utility takes a raw log line string and a source identifier, then transforms
 * them into a structured JSON object. It enriches the data with a unique ID,
 * a standardized timestamp, and information about the log's origin.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Parses a raw log line, enriches it with metadata, and returns a structured
 * log object.
 *
 * The function attempts to parse the input line as JSON. If successful, it merges
 * the parsed JSON object with the standard enrichment metadata. If the line is not
 * valid JSON, it treats the entire line as a `message` string.
 *
 * Enrichment includes:
 * - A unique identifier (`id`) for each log entry.
 * - An ISO 8601 timestamp (`timestamp`).
 * - The source of the log (`source`).
 * - The original, raw log line (`raw`).
 *
 * @param {string} line - The raw, unstructured log line to parse.
 * @param {string} source - The identifier for the log's origin (e.g., file path, 'stdin', 'tcp:port').
 * @returns {object} A structured log object.
 */
export function parseAndEnrich(line, source) {
  const enrichment = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    source,
    raw: line,
  };

  try {
    // Attempt to parse the line as JSON. This allows the aggregator to handle
    // streams that are already producing structured (JSON) logs.
    const parsedJson = JSON.parse(line);

    // If parsing succeeds and the result is an object (not null, a number, etc.),
    // merge it with our enrichment data. The original parsed data takes precedence
    // in case of key conflicts, except for our core enrichment fields.
    if (typeof parsedJson === 'object' && parsedJson !== null) {
      return {
        ...parsedJson,
        ...enrichment, // Ensure our metadata overwrites any conflicting keys.
      };
    }
  } catch (error) {
    // The line is not valid JSON, which is a common case. We'll proceed to
    // treat it as a simple message string. We don't need to log this error
    // as it's an expected part of the parsing logic.
  }

  // If the line is not JSON or not a JSON object, treat the whole line as the message.
  return {
    ...enrichment,
    message: line,
  };
}