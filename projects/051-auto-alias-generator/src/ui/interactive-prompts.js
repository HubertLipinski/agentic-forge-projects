import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * @fileoverview Uses 'inquirer' to present suggested aliases to the user
 * in an interactive checklist, allowing them to select which ones to keep.
 * This module is responsible for the primary user interaction part of the CLI.
 */

/**
 * Formats a single alias suggestion for display in the Inquirer checklist.
 * It creates a visually appealing string showing the alias, the original command,
 * and its frequency count.
 *
 * Example output:
 *   gs   (23x)  -> git status
 *
 * @param {object} suggestion - The suggestion object.
 * @param {string} suggestion.alias - The suggested alias (e.g., 'gs').
 * @param {string} suggestion.command - The original command (e.g., 'git status').
 * @param {number} suggestion.count - The frequency of the command.
 * @returns {string} A formatted string for the checklist.
 */
function formatSuggestionForDisplay({ alias, command, count }) {
  // Use chalk to color-code the different parts of the suggestion
  const aliasPart = chalk.bold.cyan(alias.padEnd(6)); // Padded for alignment
  const countPart = chalk.dim(`(${String(count).padStart(3, ' ')}x)`);
  const commandPart = chalk.white(command);

  return `${aliasPart} ${countPart} ${chalk.dim('->')} ${commandPart}`;
}

/**
 * Presents the user with an interactive checklist of alias suggestions.
 * The user can select which aliases they wish to generate.
 *
 * @param {Array<{command: string, alias: string, count: number}>} suggestions - An array of suggested aliases.
 * @returns {Promise<Array<{command: string, alias: string, count: number}>>} A promise that resolves to an array containing only the aliases selected by the user.
 * @throws {Error} If the prompt is cancelled by the user (e.g., Ctrl+C).
 */
export async function promptUserForSelection(suggestions) {
  if (!Array.isArray(suggestions)) {
    throw new Error('Input "suggestions" must be an array.');
  }

  if (suggestions.length === 0) {
    console.log(chalk.yellow('No new alias suggestions to display. Your workflow might already be optimized!'));
    return [];
  }

  // Map suggestions to the format required by Inquirer's 'choices' array.
  // We store the original suggestion object in the 'value' property.
  const choices = suggestions.map(suggestion => ({
    name: formatSuggestionForDisplay(suggestion),
    value: suggestion,
    checked: true, // All suggestions are selected by default for convenience
  }));

  try {
    const { selectedAliases } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedAliases',
        message: 'Select the aliases you want to create (all are selected by default):\n',
        choices,
        pageSize: Math.min(choices.length, process.stdout.rows - 3, 15), // Dynamic page size, max 15
        loop: false, // Prevents looping from top to bottom
        // Custom separator to provide a clean visual break.
        // Using `inquirer.Separator` ensures it's not a selectable item.
        // The empty line adds vertical spacing for readability.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        separator: new inquirer.Separator(' '),
      },
    ]);

    // The 'selectedAliases' will be an array of the 'value' objects from the choices.
    return selectedAliases;
  } catch (error) {
    // Inquirer throws an error if the user cancels the prompt (e.g., with Ctrl+C).
    // We'll catch it to provide a cleaner exit message.
    if (error.isTtyError) {
      // This typically means the prompt could not be rendered.
      throw new Error('Could not render interactive prompt in this terminal.');
    }
    // For user cancellation, we can simply exit gracefully.
    console.log(chalk.red('\n\nAlias selection cancelled. Exiting.'));
    // Return an empty array or exit, depending on desired flow.
    // Returning empty array is safer for the calling function.
    return [];
  }
}