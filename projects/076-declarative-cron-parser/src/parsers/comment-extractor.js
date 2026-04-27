/**
 * @file src/parsers/comment-extractor.js
 * @description Core logic to read file contents and extract cron schedule directives from comments using regular expressions.
 */

import { resolve } from 'node:path';
import { readFileContent } from '../utils/file-reader.js';
import { isValidCron } from '../utils/cron-validator.js';

/**
 * @typedef {object} CronSchedule
 * @property {string} schedule - The 5-part cron schedule string (e.g., "0 5 * * *").
 * @property {string} command - The command to be executed.
 * @property {string} sourceFile - The absolute path to the source file where the schedule was found.
 * @property {number} sourceLine - The line number in the source file where the schedule was found.
 */

/**
 * A custom error class for parsing-related failures.
 */
class ParserError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Additional options.
   * @param {string} [options.filePath] The file path that was being parsed.
   * @param {number} [options.lineNumber] The line number where the error occurred.
   * @param {Error} [options.cause] The original error that was caught.
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'ParserError';
    if (options.filePath) this.filePath = options.filePath;
    if (options.lineNumber) this.lineNumber = options.lineNumber;
    if (options.cause) this.cause = options.cause;
  }
}

/**
 * Regular expression to find declarative cron comments.
 * It looks for a line starting with optional whitespace, a comment marker,
 * the `@cron:` directive, the 5-part cron schedule, and the command.
 *
 * - `^`: Start of the line.
 * - `\s*`: Optional leading whitespace.
 * - `(?:#|//|\/\*|--|<!--)`: Non-capturing group for common comment syntaxes.
 *   - `#`: Python, Ruby, Shell, etc.
 *   - `//`: JavaScript, Java, C++, Go, etc.
 *   - `\/\*`: CSS, multi-line JS/C++ (start).
 *   - `--`: SQL, Haskell, etc.
 *   - `<!--`: HTML, XML.
 * - `\s*`: Whitespace after comment marker.
 * - `@cron:`: The required directive.
 * - `\s+`: At least one space after the directive.
 * - `((?:[^\s]+\s+){4}[^\s]+)`: Capturing group 1 (the schedule).
 *   - `(?:[^\s]+\s+){4}`: Four instances of (non-whitespace chars followed by one or more spaces).
 *   - `[^\s]+`: The fifth part of the cron schedule.
 * - `\s+`: At least one space separating the schedule and command.
 * - `(.+)`: Capturing group 2 (the command). This captures the rest of the line.
 * - `(?:\s*\*\/|\s*-->)?`: Optional closing comment syntax (for `/*` and `<!--`).
 * - `\s*`: Optional trailing whitespace.
 * - `$`: End of the line.
 *
 * @private
 * @type {RegExp}
 */
const CRON_COMMENT_REGEX = /^\s*(?:#|--|\/\/|\/\*|<!--)\s*@cron:\s+((?:[^\s]+\s+){4}[^\s]+)\s+(.+?)(?:\s*\*\/|\s*-->)?\s*$/;

/**
 * Parses a single line of text to find a cron directive.
 *
 * @private
 * @param {string} line - The line of text to parse.
 * @param {string} filePath - The absolute path of the file being parsed.
 * @param {number} lineNumber - The line number within the file.
 * @returns {CronSchedule | null} A CronSchedule object if a valid directive is found, otherwise null.
 * @throws {ParserError} If a directive is found but the cron schedule is syntactically invalid.
 */
function parseLineForCron(line, filePath, lineNumber) {
  const match = line.match(CRON_COMMENT_REGEX);
  if (!match) {
    return null;
  }

  const [, schedule, command] = match;

  if (!isValidCron(schedule)) {
    throw new ParserError(
      `Invalid cron schedule format: "${schedule}"`, {
        filePath,
        lineNumber,
      }
    );
  }

  return {
    schedule,
    command: command.trim(),
    sourceFile: filePath,
    sourceLine: lineNumber,
  };
}

/**
 * Extracts all valid cron schedule directives from the content of a single file.
 *
 * @param {string} fileContent - The full string content of the file.
 * @param {string} filePath - The absolute path to the file, used for context in results and errors.
 * @returns {CronSchedule[]} An array of found CronSchedule objects. The array will be empty if no directives are found.
 * @throws {ParserError} If a line contains a malformed cron directive.
 */
export function extractSchedulesFromFileContent(fileContent, filePath) {
  if (typeof fileContent !== 'string') {
    throw new TypeError('fileContent must be a string.');
  }
  if (typeof filePath !== 'string' || !filePath) {
    throw new TypeError('filePath must be a non-empty string.');
  }

  const absolutePath = resolve(filePath);
  const lines = fileContent.split(/\r?\n/);
  const schedules = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i];

    try {
      const schedule = parseLineForCron(line, absolutePath, lineNumber);
      if (schedule) {
        schedules.push(schedule);
      }
    } catch (error) {
      // Re-throw parser errors to be handled by the orchestrator, preserving context.
      if (error instanceof ParserError) {
        throw error;
      }
      // Wrap unexpected errors for consistent error handling.
      throw new ParserError(
        `An unexpected error occurred while parsing line ${lineNumber}`, {
          filePath: absolutePath,
          lineNumber,
          cause: error,
        }
      );
    }
  }

  return schedules;
}

/**
 * Reads a file and extracts all cron schedule directives from its content.
 * This is a convenience function that combines reading and parsing.
 *
 * @param {string} filePath - The path to the file to read and parse.
 * @returns {Promise<CronSchedule[]>} A promise that resolves to an array of found CronSchedule objects.
 * @throws {FileError} If the file cannot be read.
 * @throws {ParserError} If the file content contains a malformed cron directive.
 */
export async function extractSchedulesFromFile(filePath) {
  const content = await readFileContent(filePath);
  return extractSchedulesFromFileContent(content, filePath);
}