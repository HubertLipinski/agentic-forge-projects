import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { sub, formatISO } from 'date-fns';
import ora from 'ora';
import chalk from 'chalk';

import { fetchPullRequests } from '../git/pr-fetcher.js';
import { calculateMetrics } from '../metrics/calculator.js';
import { aggregateMetrics } from '../metrics/aggregator.js';
import { renderSummaryTable } from '../ui/table.js';

/**
 * The main application logic. It orchestrates the process of fetching,
 * calculating, and displaying PR metrics.
 *
 * @param {object} argv - The parsed command-line arguments from yargs.
 */
async function run(argv) {
  const { since, until, author, path } = argv;

  const spinner = ora('Analyzing git repository...').start();

  try {
    // 1. Fetch Data
    spinner.text = 'Fetching merged pull requests...';
    const prs = await fetchPullRequests({
      since,
      until,
      author,
      cwd: path,
    });
    spinner.succeed(
      `Found ${prs.length} merged pull request(s) in the specified period.`,
    );

    // 2. Calculate Metrics
    spinner.start('Calculating metrics for each pull request...');
    const calculatedPrs = calculateMetrics(prs);
    spinner.succeed('Metrics calculation complete.');

    // 3. Aggregate Results
    spinner.start('Aggregating results into a summary report...');
    const summary = aggregateMetrics(calculatedPrs);
    spinner.succeed('Aggregation complete.');

    // 4. Render Output
    spinner.stop();
    renderSummaryTable(summary, { since, until, author });
  } catch (error) {
    spinner.fail(chalk.red('An error occurred during analysis.'));
    // The `exec` utility provides detailed error messages.
    // We log the error message directly for user-friendly feedback.
    console.error(`\n${chalk.red.bold('Error Details:')}\n${error.message}`);
    // Exit with a non-zero code to indicate failure, useful for scripting.
    process.exit(1);
  }
}

/**
 * Configures and initializes the yargs command-line interface.
 *
 * @returns {object} The yargs instance, ready to be parsed.
 */
export function setupCli() {
  // Get today's date and the date 30 days ago for default values.
  // Using end of today to ensure all of today's merges are included.
  const defaultUntilDate = new Date();
  defaultUntilDate.setHours(23, 59, 59, 999);
  const defaultSinceDate = sub(defaultUntilDate, { days: 30 });

  return yargs(hideBin(process.argv))
    .command(
      '$0',
      'Analyze a git repository to generate key performance metrics for pull requests.',
      (yargs) => {
        // Define the options for the default command
        return yargs
          .option('since', {
            alias: 's',
            type: 'string',
            description: 'The start date for the analysis (YYYY-MM-DD).',
            default: formatISO(defaultSinceDate, { representation: 'date' }),
            coerce: (arg) => {
              const date = new Date(arg);
              if (isNaN(date.getTime())) {
                throw new Error('Invalid `since` date format. Please use YYYY-MM-DD.');
              }
              // Set to the beginning of the day
              date.setHours(0, 0, 0, 0);
              return formatISO(date);
            },
          })
          .option('until', {
            alias: 'u',
            type: 'string',
            description: 'The end date for the analysis (YYYY-MM-DD).',
            default: formatISO(defaultUntilDate, { representation: 'date' }),
            coerce: (arg) => {
              const date = new Date(arg);
              if (isNaN(date.getTime())) {
                throw new Error('Invalid `until` date format. Please use YYYY-MM-DD.');
              }
              // Set to the end of the day
              date.setHours(23, 59, 59, 999);
              return formatISO(date);
            },
          })
          .option('author', {
            alias: 'a',
            type: 'string',
            description: 'Filter pull requests by a specific author\'s email or name.',
          })
          .option('path', {
            alias: 'p',
            type: 'string',
            description: 'Path to the local git repository.',
            default: process.cwd(),
          });
      },
      (argv) => {
        // The handler function for the command
        run(argv);
      },
    )
    .alias('help', 'h')
    .alias('version', 'v')
    .epilogue(
      `For more information, find the documentation at ${chalk.underline(
        'https://github.com/your-username/git-pr-metrics', // Placeholder URL
      )}`,
    )
    .strict() // Report errors for unknown options
    .wrap(yargs.terminalWidth()) // Adjust help text to terminal width
    .fail((msg, err, yargs) => {
      // Custom failure handler for better error messages
      if (err) {
        // Re-throw errors from `coerce` or other internal yargs issues
        throw err;
      }
      console.error(chalk.red.bold('Error:') + ` ${msg}\n`);
      console.error(
        `Run '${chalk.cyan('git-pr-metrics --help')}' for a list of available options.`,
      );
      process.exit(1);
    });
}