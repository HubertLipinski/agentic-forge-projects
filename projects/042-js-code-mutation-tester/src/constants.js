/**
 * constants.js
 *
 * This file centralizes constant values used throughout the application.
 * By defining them in one place, we ensure consistency and make future
 * updates easier. These constants include default configuration settings,
 * mutation statuses, and other fixed values that govern the application's behavior.
 */

/**
 * An enumeration of possible statuses for a mutant after a test run.
 * Using a frozen object provides a lightweight, immutable enum-like structure.
 *
 * - KILLED: The test suite failed, meaning the mutation was successfully detected.
 * - SURVIVED: The test suite passed, meaning the mutation was not detected.
 * - TIMED_OUT: The test run exceeded the configured timeout limit. This is often treated as a "KILLED" status.
 * - PENDING: The mutant has been generated but not yet tested.
 * - ERROR: An unexpected error occurred during the test run for this mutant.
 *
 * @type {Readonly<{KILLED: string, SURVIVED: string, TIMED_OUT: string, PENDING: string, ERROR: string}>}
 */
export const MUTANT_STATUS = Object.freeze({
  KILLED: 'Killed',
  SURVIVED: 'Survived',
  TIMED_OUT: 'TimedOut',
  PENDING: 'Pending',
  ERROR: 'Error',
});

/**
 * An enumeration for the different types of mutators.
 * This helps in categorizing and potentially filtering mutators based on how they operate.
 *
 * - AST_NODE: The mutator operates on a specific type of node in the Abstract Syntax Tree.
 *
 * @type {Readonly<{AST_NODE: string}>}
 */
export const MUTATION_TYPE = Object.freeze({
  AST_NODE: 'AstNode',
});

/**
 * The default configuration for the mutation tester.
 * These values are used as a fallback if no configuration is provided
 * in `package.json`, `.mutationrc.json`, or via CLI arguments.
 *
 * @property {string[]} sourceFiles - Glob patterns for source files to be mutated.
 * @property {string[]} testFiles - Glob patterns for test files to execute.
 * @property {string} testCommand - The command to run the test suite.
 * @property {string[]} ignorePatterns - Glob patterns for files/directories to ignore.
 * @property {number} concurrency - The number of parallel test runners to use. Defaults to the number of CPU cores.
 * @property {number} timeout - The timeout for a single test run in milliseconds.
 * @property {string[]} mutators - A list of mutator names to enable.
 * @property {object} reporter - Configuration for the console reporter.
 * @property {boolean} reporter.showDiff - Whether to display a diff for surviving mutants.
 */
export const DEFAULT_CONFIG = Object.freeze({
  sourceFiles: ['src/**/*.js'],
  testFiles: ['test/**/*.js', 'tests/**/*.js', '**/*.spec.js', '**/*.test.js'],
  testCommand: 'npm test',
  ignorePatterns: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '*.config.js',
  ],
  concurrency: null, // Will be replaced by os.cpus().length in the engine
  timeout: 5000,
  mutators: [
    'BinaryExpression',
    'LogicalExpression',
    'StringLiteral',
    // 'ArrowFunctionExpression' // Example of a disabled-by-default mutator
  ],
  reporter: {
    showDiff: true,
  },
});

/**
 * The name of the configuration file that `cosmiconfig` will search for.
 * This is used to identify the `mutation` property in `package.json` or
 * files like `.mutationrc.json`.
 *
 * @type {string}
 */
export const CONFIG_MODULE_NAME = 'mutation';