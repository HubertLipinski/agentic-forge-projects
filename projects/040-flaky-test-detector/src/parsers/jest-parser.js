/**
 * @file src/parsers/jest-parser.js
 * @description Implements the test output parsing logic for Jest's default reporter.
 * This parser is designed to extract test case results from the standard output of a Jest test run.
 */

import { PARSER_PATTERNS, TEST_STATUS } from '../config/constants.js';

/**
 * Parses the output of a Jest test run to extract individual test results.
 * It uses a regular expression to find lines that indicate a test has passed or failed,
 * and extracts the test name from those lines.
 *
 * @param {string} output - The combined stdout and stderr from the test command execution.
 * @returns {Array<object>} An array of test result objects, where each object has a
 * `name` (string) and `status` ('passed' or 'failed').
 */
const parse = (output) => {
  if (typeof output !== 'string') {
    // Defensive check for invalid input type.
    return [];
  }

  // Use a global flag with the regex to find all matches in the output.
  const jestRegex = new RegExp(PARSER_PATTERNS.jest, 'g');
  const results = [];
  let match;

  while ((match = jestRegex.exec(output)) !== null) {
    // The regex is designed to have a named capture group 'testName'.
    const testName = match.groups?.testName?.trim();

    if (!testName) {
      // This case should be rare if the regex is correct, but it's a good safeguard.
      continue;
    }

    // Determine status based on the icon at the start of the matched line.
    // Jest uses ✓ or ✔ for pass, and ✕ or ✖ for fail.
    const status = match[0].trim().startsWith('✓') || match[0].trim().startsWith('✔')
      ? TEST_STATUS.PASSED
      : TEST_STATUS.FAILED;

    results.push({
      name: testName,
      status,
    });
  }

  return results;
};

/**
 * The Jest parser object, conforming to the parser interface.
 * It provides a `parse` function to process test runner output.
 *
 * @type {{ parse: (output: string) => Array<{name: string, status: string}> }}
 */
const jestParser = {
  parse,
};

export default jestParser;