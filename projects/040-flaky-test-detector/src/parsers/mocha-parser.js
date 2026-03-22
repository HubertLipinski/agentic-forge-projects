/**
 * @file src/parsers/mocha-parser.js
 * @description Implements the test output parsing logic for Mocha's default 'spec' reporter.
 * This parser is designed to extract test case results from the standard output of a Mocha test run.
 */

import { PARSER_PATTERNS, TEST_STATUS } from '../config/constants.js';

/**
 * Parses the output of a Mocha test run to extract individual test results.
 * It uses a regular expression to find lines that indicate a test has passed or failed.
 * Mocha's 'spec' reporter prefixes passing tests with a checkmark and failing tests
 * with a number (e.g., '1)').
 *
 * @param {string} output - The combined stdout and stderr from the test command execution.
 * @returns {Array<object>} An array of test result objects, where each object has a
 * `name` (string) and `status` ('passed' or 'failed').
 */
const parse = (output) => {
  if (typeof output !== 'string' || !output) {
    // Defensive check for invalid or empty input.
    return [];
  }

  // Use a global flag with the regex to find all matches in the output.
  const mochaRegex = new RegExp(PARSER_PATTERNS.mocha, 'g');
  const results = [];
  let match;

  while ((match = mochaRegex.exec(output)) !== null) {
    // The regex is designed to have a named capture group 'testName'.
    const testName = match.groups?.testName?.trim();

    if (!testName) {
      // This case should be rare if the regex is correct, but it's a good safeguard.
      continue;
    }

    // Determine status based on the prefix of the matched line.
    // Mocha's spec reporter uses ✓ or ✔ for pass, and a number like '1)' for fail.
    const trimmedMatch = match[0].trim();
    const isPass = trimmedMatch.startsWith('✓') || trimmedMatch.startsWith('✔');

    const status = isPass ? TEST_STATUS.PASSED : TEST_STATUS.FAILED;

    results.push({
      name: testName,
      status,
    });
  }

  return results;
};

/**
 * The Mocha parser object, conforming to the parser interface.
 * It provides a `parse` function to process test runner output.
 *
 * @type {{ parse: (output: string) => Array<{name: string, status: string}> }}
 */
const mochaParser = {
  parse,
};

export default mochaParser;