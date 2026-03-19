/**
 * @file lib/commands/list.js
 * @description Implements the 'list' command for the Git Tag Manager CLI.
 * This command fetches tags from local and remote repositories, filters them
 * based on a semantic versioning range, and displays the results in a
 * formatted table.
 */

import chalk from 'chalk';
import { fetchTags, getTagDetails } from '../git-client.js';
import { filterTagsBySemver } from '../tag-filter.js';
import { printError, printInfo, printTable } from '../ui-helpers.js';

/**
 * Command configuration for yargs.
 * Defines the command, its description, and its options.
 * @type {import('yargs').CommandModule}
 */
export const command = 'list [remotes..]';
export const describe = 'List tags matching a semver range from local and/or remotes';

/**
 * Builds the yargs options for the 'list' command.
 * @param {import('yargs').Argv} yargs - The yargs instance.
 * @returns {import('yargs').Argv} The configured yargs instance.
 */
export function builder(yargs) {
  return yargs
    .positional('remotes', {
      describe: 'A list of remote names to fetch tags from (e.g., origin upstream)',
      type: 'string',
      default: [],
    })
    .option('range', {
      alias: 'r',
      describe: 'A semantic versioning range (e.g., ">=1.0.0 <2.0.0", "1.x")',
      type: 'string',
      default: '*',
    })
    .option('sort', {
      describe: 'Sort tags by semver in ascending (asc) or descending (desc) order',
      type: 'string',
      choices: ['asc', 'desc'],
      default: 'desc',
    })
    .option('details', {
      alias: 'd',
      describe: 'Show detailed information (commit hash, author, date)',
      type: 'boolean',
      default: false,
    });
}

/**
 * The main handler for the 'list' command.
 * Orchestrates fetching, filtering, and displaying tags.
 * @param {object} argv - The parsed command-line arguments from yargs.
 * @returns {Promise<void>}
 */
export async function handler(argv) {
  try {
    const { remotes, range, sort, details } = argv;

    printInfo(`Fetching tags from local repository and ${remotes.length} remote(s)...`);
    const allTags = await fetchTags(remotes);

    if (allTags.size === 0) {
      printInfo('No tags found locally or on the specified remotes.');
      return;
    }

    const filteredTags = filterTagsBySemver(Array.from(allTags), range, sort);

    if (filteredTags.length === 0) {
      printInfo(`No tags found matching the semver range: ${chalk.cyan(range)}`);
      return;
    }

    await displayTags(filteredTags, details);
  } catch (error) {
    printError(`Failed to list tags: ${error.message}`);
    // For debugging purposes, log the full error in a non-production environment
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Displays the list of tags in a formatted table.
 * Fetches detailed information if requested.
 * @param {string[]} tags - An array of tag names to display.
 * @param {boolean} showDetails - Whether to fetch and display detailed tag info.
 * @returns {Promise<void>}
 */
async function displayTags(tags, showDetails) {
  if (!showDetails) {
    printSimpleTagList(tags);
    return;
  }

  printInfo('Fetching tag details...');
  const tagDetails = await getTagDetails(tags);

  const headers = [
    chalk.bold('Tag'),
    chalk.bold('Commit'),
    chalk.bold('Author'),
    chalk.bold('Date'),
  ];

  const rows = tagDetails.map(detail => [
    chalk.cyan(detail.tag),
    chalk.yellow(detail.commit),
    detail.author,
    chalk.gray(detail.date),
  ]);

  printTable(headers, rows);
  printInfo(`Displayed ${rows.length} tag(s) with details.`);
}

/**
 * Prints a simple, single-column list of tags.
 * @param {string[]} tags - An array of tag names to print.
 */
function printSimpleTagList(tags) {
  console.log(chalk.bold('\nMatching Tags:'));
  tags.forEach(tag => console.log(`  ${chalk.cyan(tag)}`));
  printInfo(`\nFound ${tags.length} matching tag(s). Use --details for more info.`);
}