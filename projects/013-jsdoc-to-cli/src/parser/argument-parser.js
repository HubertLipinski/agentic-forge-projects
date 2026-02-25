/**
 * @file src/parser/argument-parser.js
 * @description Wrapper around 'yargs-parser' to parse `process.argv`
 * into a key-value object of arguments, configured for this tool's needs.
 */

import yargsParser from 'yargs-parser';

/**
 * Parses the raw command-line arguments from `process.argv` into a structured object.
 *
 * This function serves as a dedicated wrapper around `yargs-parser`, pre-configured
 * for the specific needs of `jsdoc-to-cli`. It handles the raw `process.argv` array,
 * which typically includes the node executable and script path, and extracts only
 * the relevant user-provided arguments.
 *
 * The configuration is set to:
 * - Automatically convert kebab-case flags (e.g., `--my-var`) to camelCase keys (`myVar`).
 * - Treat all arguments that do not start with a hyphen as positional arguments,
 *   which are stored in the `_` array.
 *
 * @param {string[]} argv - The array of command-line arguments, typically `process.argv`.
 * @returns {import('yargs-parser').Arguments} A parsed arguments object.
 *   - `_`: An array of positional arguments (e.g., file path, function name).
 *   - Other keys are the camelCased flags provided by the user.
 *   - Example: `['--my-flag', 'value']` becomes `{ _: [], myFlag: 'value' }`.
 */
export function parseCliArgs(argv) {
  // `process.argv` contains `[node, script, ...args]`. We only want the `...args`.
  // Slicing at index 2 removes the node executable path and the script path.
  const cliArgs = argv.slice(2);

  // Configure yargs-parser to suit our needs.
  const options = {
    // `camel-case-expansion` is crucial. It converts `--my-var` to `myVar` in the output object.
    configuration: {
      'camel-case-expansion': true,
    },
  };

  // yargs-parser is synchronous and robust, so a try/catch is generally not
  // necessary for its core parsing logic unless we add complex configurations
  // that could throw errors. For basic parsing, it's safe.
  const parsedArgs = yargsParser(cliArgs, options);

  return parsedArgs;
}