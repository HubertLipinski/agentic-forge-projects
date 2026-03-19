/**
 * @file lib/ui-helpers.js
 * @description Contains functions for building user interfaces using 'chalk' for
 * colored output and 'inquirer' for interactive prompts, like tag selection
 * lists and confirmation dialogs. This module centralizes all console I/O to
 * ensure a consistent look and feel across the CLI.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';

/**
 * Prints an informational message to the console.
 * Typically used for status updates, progress, and general feedback.
 * @param {string} message - The message to print.
 */
export function printInfo(message) {
  console.log(chalk.blue('i ') + message);
}

/**
 * Prints a success message to the console.
 * Typically used to confirm that an operation completed successfully.
 * @param {string} message - The message to print.
 */
export function printSuccess(message) {
  console.log(chalk.green('✔ ') + message);
}

/**
 * Prints a warning message to the console.
 * Typically used for non-critical issues or potential problems.
 * @param {string} message - The message to print.
 */
export function printWarning(message) {
  console.log(chalk.yellow('⚠ ') + message);
}

/**
 * Prints an error message to the console.
 * Typically used for critical failures that may halt execution.
 * @param {string} message - The message to print.
 */
export function printError(message) {
  console.error(chalk.red('✖ ') + message);
}

/**
 * Renders a table to the console with headers and rows.
 * Automatically calculates column widths to align content.
 *
 * @param {string[]} headers - An array of strings for the table header.
 * @param {string[][]} rows - An array of arrays, where each inner array is a row.
 */
export function printTable(headers, rows) {
  if (!headers?.length || !rows?.length) {
    printInfo('No data to display in table.');
    return;
  }

  // Calculate the maximum width for each column
  const columnWidths = headers.map((header, i) =>
    Math.max(
      chalk.stripColor(header).length,
      ...rows.map(row => chalk.stripColor(row[i] ?? '').length)
    )
  );

  // Function to pad a string to a given width
  const pad = (str, width) => str + ' '.repeat(Math.max(0, width - chalk.stripColor(str).length));

  // Print header
  const headerLine = headers.map((h, i) => pad(h, columnWidths[i])).join('  ');
  console.log('\n' + headerLine);

  // Print separator
  const separatorLine = columnWidths.map(w => '─'.repeat(w)).join('  ');
  console.log(chalk.dim(separatorLine));

  // Print rows
  rows.forEach(row => {
    const rowLine = row.map((cell, i) => pad(cell ?? '', columnWidths[i])).join('  ');
    console.log(rowLine);
  });

  console.log(''); // Add a blank line for spacing
}

/**
 * Prompts the user with a yes/no confirmation question.
 *
 * @param {string} message - The question to ask the user.
 * @param {boolean} [defaultChoice=false] - The default answer if the user just presses Enter.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the user confirms, `false` otherwise.
 */
export async function promptForConfirmation(message, defaultChoice = false) {
  try {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultChoice,
      },
    ]);
    return confirmed;
  } catch (error) {
    // Handle cases where the prompt might be interrupted (e.g., Ctrl+C)
    printWarning('\nConfirmation prompt cancelled.');
    return false;
  }
}

/**
 * Displays a checklist of tags and prompts the user to select which ones to process.
 *
 * @param {string[]} tags - A list of tag names to display as choices.
 * @param {string} message - The message to display above the checklist.
 * @returns {Promise<string[]>} A promise that resolves to an array of the selected tag names.
 */
export async function promptForTagSelection(tags, message) {
  if (!tags?.length) {
    return [];
  }

  try {
    const { selectedTags } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedTags',
        message,
        choices: tags.map(tag => ({ name: tag, value: tag })),
        pageSize: Math.min(tags.length, 15), // Show up to 15 items at once
        // Provides a hint to the user on how to interact with the list.
        suffix: chalk.dim(' (Press <space> to select, <a> to toggle all, <i> to invert selection)'),
      },
    ]);
    return selectedTags;
  } catch (error) {
    printWarning('\nTag selection prompt cancelled.');
    return [];
  }
}