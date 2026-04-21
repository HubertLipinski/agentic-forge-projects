/**
 * src/cli.js
 *
 * This is the main entry point for the Docker Image Pruner command-line application.
 * It uses 'yargs' to parse command-line arguments and options, configures the
 * application's behavior based on user input (e.g., interactive mode, dry-run),
 * and orchestrates the overall workflow by invoking the prune engine.
 *
 * @module cli
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { runPruneEngine } from './core/prune-engine.js';

/**
 * Parses a size string (e.g., "500MB", "2GB") into bytes.
 * Supports units: B, KB, MB, GB, TB (case-insensitive).
 * If no unit is specified, it defaults to bytes.
 *
 * @param {string} sizeString - The size string to parse.
 * @returns {number} The size in bytes.
 * @throws {Error} If the size string format is invalid.
 */
function parseSizeToBytes(sizeString) {
  if (!sizeString) return 0;

  const sizeRegex = /^(\d+(\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i;
  const match = sizeString.match(sizeRegex);

  if (!match) {
    throw new Error(`Invalid size format: "${sizeString}". Use a number followed by B, KB, MB, GB, or TB (e.g., "500MB").`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[3] ?? 'B').toUpperCase();

  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };

  return value * units[unit];
}

/**
 * Configures and runs the yargs-based CLI.
 * This function defines all available commands, options, and their behaviors,
 * then parses the command-line arguments and triggers the main application logic.
 */
export async function main() {
  const yargsInstance = yargs(hideBin(process.argv));

  yargsInstance
    .scriptName('prune-images')
    .usage(`Usage: $0 [options]`)
    .epilogue(`For more information, find the documentation at ${chalk.underline('https://github.com/your-username/docker-image-pruner')}`)
    .command(
      '$0', // Default command
      'Intelligently prune local Docker images.',
      (yargs) => {
        // --- Mode Options ---
        yargs
          .option('interactive', {
            alias: 'i',
            type: 'boolean',
            description: 'Run in interactive mode to select images for deletion.',
            default: false,
          })
          .option('dry-run', {
            alias: 'd',
            type: 'boolean',
            description: 'Show which images would be pruned without deleting them.',
            default: false,
          })
          .conflicts('interactive', 'dry-run');

        // --- Filtering Options ---
        yargs
          .option('age', {
            alias: 'a',
            type: 'number',
            description: 'Filter images older than a specified number of days (e.g., 30).',
            nargs: 1,
          })
          .option('size', {
            alias: 's',
            type: 'string',
            description: 'Filter images larger than a specified size (e.g., "1GB", "500MB").',
            nargs: 1,
          })
          .option('name', {
            alias: 'n',
            type: 'string',
            description: 'Filter images by repository/tag using wildcards (e.g., "my-app:*", "*:latest").',
            nargs: 1,
          });

        // --- Sorting Options ---
        yargs
          .option('sort-by', {
            type: 'string',
            description: 'Sort candidate images by a specific field.',
            choices: ['size', 'name', 'date'],
            default: 'size',
          })
          .option('sort-order', {
            type: 'string',
            description: 'Set the sort order.',
            choices: ['asc', 'desc'],
            default: 'desc',
          });
      },
      async (argv) => {
        // This is the handler for the default command
        try {
          const options = {
            interactive: argv.interactive,
            dryRun: argv.dryRun,
            filters: {
              ageDays: argv.age,
              minSizeBytes: argv.size ? parseSizeToBytes(argv.size) : 0,
              namePattern: argv.name,
            },
            sort: {
              key: argv.sortBy,
              order: argv.sortOrder,
            },
          };

          // If no mode is specified, default to interactive mode unless filters are present.
          // This provides a safe, user-friendly default behavior.
          if (!argv.interactive && !argv.dryRun && !argv.age && !argv.size && !argv.name) {
            options.interactive = true;
            console.log(chalk.blue('No filters or modes specified. Running in interactive mode by default.'));
            console.log(chalk.blue('Use --help to see all options.\n'));
          }

          await runPruneEngine(options);
        } catch (error) {
          console.error(chalk.red.bold(`\nError: ${error.message}`));
          process.exit(1);
        }
      }
    )
    .help()
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .strict() // Report errors for unknown options
    .wrap(yargsInstance.terminalWidth())
    .parse();
}