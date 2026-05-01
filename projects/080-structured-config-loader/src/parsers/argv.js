'use strict';

import yargsParser from 'yargs-parser';

/**
 * Parses command-line arguments into a structured configuration object.
 *
 * This function leverages `yargs-parser` to handle the complex logic of parsing
 * command-line arguments, including dot notation for nested objects, automatic
 * type coercion (e.g., 'true' -> true, '123' -> 123), and array handling.
 *
 * The `yargs-parser` library is well-suited for this task as it automatically
 * converts arguments like `--db.host=localhost` into a nested object:
 * `{ db: { host: 'localhost' } }`.
 *
 * @param {object} options - Configuration options for parsing arguments.
 * @param {string[]} [options.args=process.argv.slice(2)] - An array of command-line arguments to parse.
 *   Defaults to the process's arguments, excluding the node executable and script path.
 * @param {object} [options.yargsParserConfig={}] - A configuration object to pass directly to `yargs-parser`.
 *   This allows for advanced customization, such as defining aliases, defaults, or coercions.
 *   See `yargs-parser` documentation for all available options.
 *   By default, it enables dot-notation parsing.
 *
 * @returns {Promise<object>} A promise that resolves to the parsed configuration object.
 *   The function is async to maintain a consistent interface with other parsers,
 *   even though its core logic is synchronous.
 */
export async function parseArgv({
  args = process.argv.slice(2),
  yargsParserConfig = {},
}) {
  // Default configuration for yargs-parser to ensure it meets our needs.
  // - 'dot-notation': true (default) is crucial for creating nested objects from flags like --db.port=5432.
  // - We merge user-provided config over our defaults to allow customization.
  const config = {
    // Sensible defaults that can be overridden by the user.
    'dot-notation': true,
    // Add any other library-specific defaults here if needed in the future.
    ...yargsParserConfig,
  };

  try {
    // yargs-parser returns a parsed object.
    // The first property, '_', contains all non-option arguments (e.g., file paths).
    // We are only interested in the key-value option arguments for configuration.
    const { _, ...argvConfig } = yargsParser(args, config);

    // The result is already a structured object with coerced types,
    // so no further processing is needed.
    return argvConfig;
  } catch (error) {
    // While yargs-parser itself doesn't typically throw for parsing errors
    // (it just flags them), we wrap this in a try/catch for robustness in case
    // of unexpected issues or future library changes.
    // This is more of a defensive measure.
    throw new Error(`Failed to parse command-line arguments: ${error.message}`, {
      cause: error,
    });
  }
}