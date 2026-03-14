/**
 * @fileoverview Parses command-line arguments using 'yargs-parser' to extract
 * configuration and flags for the snapshot testing process. This module provides
 * a single, memoized source of truth for CLI arguments, ensuring they are parsed
 * only once per process execution.
 */

import yargsParser from 'yargs-parser';

/**
 * A memoized variable to store the parsed command-line arguments.
 * This prevents re-parsing `process.argv` multiple times within the same run,
 * which is inefficient and unnecessary. It is initialized as `null` and populated
 * on the first call to `getParsedArgs`.
 *
 * @type {Object | null}
 */
let parsedArgs = null;

/**
 * Parses the command-line arguments from `process.argv` using `yargs-parser`.
 * This function is designed to be called only once and its result memoized.
 *
 * It configures `yargs-parser` to correctly handle the specific flags used by
 * this project, such as `--update-snapshots` and its alias `-u`.
 *
 * @returns {Object} The parsed arguments object from `yargs-parser`.
 */
function parseProcessArgs() {
  // `process.argv.slice(2)` removes the first two elements, which are typically
  // the path to the Node.js executable and the path to the script being run.
  const args = process.argv.slice(2);

  // Configure `yargs-parser` to understand our specific needs.
  // - `alias`: Maps '-u' to 'update-snapshots'.
  // - `boolean`: Ensures 'update-snapshots' is treated as a boolean flag.
  //   If `--update-snapshots` is present, its value will be `true`, otherwise `false`.
  const options = {
    alias: {
      'update-snapshots': ['u'],
    },
    boolean: ['update-snapshots'],
  };

  return yargsParser(args, options);
}

/**
 * Retrieves the parsed command-line arguments.
 *
 * On the first call, it parses `process.argv` and caches the result.
 * Subsequent calls return the cached result, avoiding redundant parsing.
 * This pattern is known as memoization and ensures consistent and efficient
 * access to CLI flags throughout the application's lifecycle.
 *
 * @returns {Object} The memoized, parsed arguments object.
 * @property {boolean} updateSnapshots - True if `--update-snapshots` or `-u` flag is present.
 */
export function getParsedArgs() {
  if (parsedArgs === null) {
    parsedArgs = parseProcessArgs();
  }
  return parsedArgs;
}

/**
 * A convenience function that directly checks if the snapshot update flag
 * (`--update-snapshots` or `-u`) was passed in the command-line arguments.
 *
 * @returns {boolean} `true` if the update flag is set, otherwise `false`.
 */
export function isUpdateMode() {
  const args = getParsedArgs();
  // The property name is camelCased by yargs-parser from 'update-snapshots'.
  return args.updateSnapshots === true;
}