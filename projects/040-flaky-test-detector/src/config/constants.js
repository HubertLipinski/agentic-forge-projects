/**
 * @file src/config/constants.js
 * @description Defines default configuration values, regex patterns for parsers,
 * and other static constants used throughout the application.
 */

/**
 * The default name for the configuration file.
 * The config loader will search for this file in the current working directory.
 * @type {string}
 */
export const CONFIG_FILE_NAME = 'flaky-detector.config.js';

/**
 * Regular expression patterns for parsing test runner output.
 * These are used to identify individual test cases and their outcomes (pass/fail).
 * The regex must contain a named capture group `testName` for the test title.
 */
export const PARSER_PATTERNS = {
  /**
   * Regex for Jest's default reporter.
   * Matches lines like:
   * `✓ should pass consistently (5ms)`
   * `✕ should fail randomly (3ms)`
   */
  jest: /^\s*(?:✓|✔|✕|✖)\s+(?<testName>.+?)\s*(?:\(\d+m?s\))?$/m,

  /**
   * Regex for Mocha's default 'spec' reporter.
   * Matches lines like:
   * `  ✓ should be a stable test`
   * `  1) should be a flaky test`
   */
  mocha: /^\s*(?:✓|✔|\d+\))\s+(?<testName>.+)$/m,
};

/**
 * Default configuration values for the application.
 * These are used as a fallback when values are not provided via CLI arguments
 * or a configuration file.
 */
export const DEFAULT_CONFIG = {
  /**
   * The command to execute the test suite.
   * This is a required field and must be provided by the user.
   * @type {string | null}
   */
  command: null,

  /**
   * The number of times to run the test command.
   * @type {number}
   */
  runs: 10,

  /**
   * The number of test runs to execute in parallel.
   * @type {number}
   */
  parallel: 1,

  /**
   * The name of the test runner parser to use.
   * Supported values are keys from `PARSER_PATTERNS`.
   * @type {'jest' | 'mocha'}
   */
  parser: 'jest',

  /**
   * The current working directory from which to run the command.
   * Defaults to the directory where the CLI tool is invoked.
   * @type {string}
   */
  cwd: process.cwd(),

  /**
   * The threshold for a test to be considered flaky.
   * A test is flaky if its success rate is less than 100% but greater than this value.
   * For example, with a threshold of 0, any test that passes at least once and fails at least once is flaky.
   * @type {number}
   */
  flakyThreshold: 0,

  /**
   * The threshold for a test to be considered a failure.
   * A test is a consistent failure if its success rate is less than or equal to this value.
   * @type {number}
   */
  failureThreshold: 0,

  /**
   * Whether to run in interactive mode, prompting for configuration.
   * @type {boolean}
   */
  interactive: false,

  /**
   * Whether to exit immediately upon the first test run failure.
   * @type {boolean}
   */
  exitOnFirstFailure: false,
};

/**
 * Enumeration of possible test statuses.
 * @enum {string}
 */
export const TEST_STATUS = {
  PASSED: 'passed',
  FAILED: 'failed',
  UNKNOWN: 'unknown',
};

/**
 * Enumeration of possible test run outcomes.
 * @enum {string}
 */
export const RUN_OUTCOME = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  CANCELLED: 'cancelled',
};

/**
 * Enumeration of possible final test classifications based on aggregated results.
 * @enum {string}
 */
export const TEST_CLASSIFICATION = {
  STABLE: 'stable',
  FLAKY: 'flaky',
  FAILURE: 'failure',
};