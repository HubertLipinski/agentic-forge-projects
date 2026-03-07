#!/usr/bin/env node

/**
 * @fileoverview The command-line interface (CLI) for the RSS Feed Aggregator.
 *
 * This script uses 'yargs' to parse command-line arguments, orchestrates the
 * feed aggregation process by calling the core library function, and prints the
 * final JSON output to standard output. It also handles errors gracefully and
 * provides user-friendly feedback.
 *
 * @module src/cli
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { aggregateFeeds } from './core/aggregator.js';
import { DEFAULT_REQUEST_TIMEOUT } from './utils/constants.js';

/**
 * The main asynchronous function that runs the CLI.
 *
 * It configures yargs for argument parsing, invokes the feed aggregator,
 * and handles the output and error reporting.
 *
 * @returns {Promise<void>} A promise that resolves when the CLI has finished execution.
 */
async function main() {
  // 1. Configure yargs for argument parsing.
  const argv = await yargs(hideBin(process.argv))
    .usage('Usage: $0 [options] <feedUrl1> [feedUrl2] ...')
    .scriptName('aggregate-feeds')
    .command('$0 <urls...>', 'Fetch and aggregate one or more RSS/Atom feeds', (yargs) => {
      yargs.positional('urls', {
        describe: 'A space-separated list of feed URLs to aggregate',
        type: 'string',
      });
    })
    .option('timeout', {
      alias: 't',
      type: 'number',
      description: 'Request timeout in milliseconds for fetching each feed.',
      default: DEFAULT_REQUEST_TIMEOUT,
    })
    .option('pretty', {
      alias: 'p',
      type: 'boolean',
      description: 'Output JSON in a human-readable (pretty-printed) format.',
      default: false,
    })
    .demandCommand(1, 'You must provide at least one feed URL.')
    .help('h')
    .alias('h', 'help')
    .alias('v', 'version')
    .epilogue('For more information, visit https://github.com/your-username/rss-feed-aggregator')
    .strict() // Report errors for unknown options
    .parseAsync();

  // 2. Extract arguments for the aggregator function.
  const { urls: feedUrls, timeout, pretty } = argv;

  try {
    // 3. Call the core aggregation logic.
    const { items, errors } = await aggregateFeeds(feedUrls, { timeout });

    // 4. Handle and report any errors that occurred during aggregation.
    if (errors.length > 0) {
      console.error('Encountered errors while processing some feeds:');
      for (const error of errors) {
        console.error(`- Failed to process ${error.url}: ${error.reason}`);
      }
      // A non-zero exit code indicates partial failure.
      // We still proceed to print successful items.
      process.exitCode = 1;
    }

    // 5. Format and print the final JSON output to stdout.
    const output = {
      items,
      // Include errors in the final JSON output for programmatic consumers of the CLI.
      errors,
    };

    const jsonString = pretty
      ? JSON.stringify(output, null, 2) // Pretty-print with 2-space indentation
      : JSON.stringify(output);

    console.log(jsonString);

  } catch (error) {
    // 6. Handle catastrophic errors (e.g., invalid input, unhandled exceptions).
    console.error(`A critical error occurred: ${error.message}`);
    process.exit(1); // Exit with a failure code.
  }
}

// Execute the main function and handle any top-level unhandled promise rejections.
main().catch((error) => {
  console.error('An unexpected error terminated the application:', error);
  process.exit(1);
});