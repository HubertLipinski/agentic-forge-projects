import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { ArrayMergeStrategy } from './merge.js';

/**
 * @file Defines the command-line interface using 'yargs'. Parses arguments for
 * input files (with glob support), output file, watch mode, and merge strategies.
 */

/**
 * Parses command-line arguments and provides a structured configuration object.
 * This function encapsulates all CLI-related logic using `yargs`.
 *
 * @param {string[]} argv - The command-line arguments, typically `process.argv`.
 * @returns {Promise<object>} A promise that resolves with the parsed arguments object.
 * The object includes properties like `inputs`, `output`, `watch`, `verbose`, and `arrayMerge`.
 */
export async function parseCliArgs(argv = process.argv) {
  const yargsInstance = yargs(hideBin(argv));

  return yargsInstance
    .usage('Usage: $0 [options] <input-files...>')
    .example(
      '$0 -o merged.json base.json env/development.json5',
      'Merge two specific files into merged.json'
    )
    .example(
      '$0 -o config.json "configs/**/*.json"',
      'Merge all .json files in the configs directory using a glob pattern'
    )
    .example(
      '$0 -w --array-merge replace "src/**/*.json"',
      'Watch and re-merge files on change, replacing arrays instead of concatenating'
    )
    .command(
      '$0 <inputs...>',
      'Merge JSON/JSON5 files into a single output file.',
      (y) => {
        y.positional('inputs', {
          describe:
            'One or more input files or glob patterns to merge. The order of files determines merge precedence (later files override earlier ones).',
          type: 'string',
        });
      }
    )
    .options({
      output: {
        alias: 'o',
        describe:
          'Path to the output file. If not specified, the merged JSON will be printed to stdout.',
        type: 'string',
        normalize: true, // Automatically resolves the path
      },
      'array-merge': {
        alias: 'a',
        describe: 'Strategy for merging arrays.',
        choices: Object.values(ArrayMergeStrategy),
        default: ArrayMergeStrategy.CONCAT,
      },
      watch: {
        alias: 'w',
        describe: 'Watch input files for changes and re-merge automatically.',
        type: 'boolean',
        default: false,
      },
      verbose: {
        alias: 'v',
        describe: 'Enable verbose logging for debugging.',
        type: 'boolean',
        default: false,
      },
      'pretty-print': {
        alias: 'p',
        describe:
          'Indent the output JSON for readability. Specify the number of spaces for indentation.',
        type: 'number',
        default: 2, // A common default for pretty-printing JSON
        coerce: (val) => (val >= 0 ? val : 2), // Ensure non-negative integer
      },
    })
    .help()
    .alias('help', 'h')
    .version(false) // Disable default version flag, can be added later if needed
    .wrap(yargsInstance.terminalWidth())
    .epilogue(
      'For more information, visit the project repository at https://github.com/your-username/json-file-merger'
    )
    .strict() // Report errors for unknown options
    .fail((msg, err, y) => {
      // Custom failure handler for better error messages
      if (err) {
        // Preserve stack trace for actual errors
        console.error(err.stack || err.message);
      } else {
        console.error(`Error: ${msg}\n`);
        y.showHelp();
      }
      process.exit(1);
    })
    .parseAsync();
}