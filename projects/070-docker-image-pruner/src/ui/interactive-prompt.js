/**
 * src/ui/interactive-prompt.js
 *
 * This module is responsible for handling the interactive user session. It uses the
 * 'inquirer' library to present a list of prunable Docker images to the user,
 * allowing them to select which ones to delete via a checkbox interface.
 *
 * @module ui/interactive-prompt
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { formatBytes, formatRelativeTime, formatRepoTags, truncateString } from '../utils/formatters.js';

/**
 * Creates a formatted string for an image to be displayed as a choice in the prompt.
 * The string includes the image ID, size, creation date, and repository tags,
 * all formatted for readability and aligned in columns.
 *
 * @param {object} image - The image object to format.
 * @returns {string} A formatted string representing the image choice.
 */
function formatImageChoice(image) {
  const id = chalk.cyan(image.id);
  const size = chalk.magenta(formatBytes(image.size).padEnd(9));
  const created = chalk.blue(formatRelativeTime(image.created).padEnd(15));
  const tags = chalk.green(truncateString(formatRepoTags(image.repoTags), 50));

  return `${id} | Size: ${size} | Created: ${created} | Tags: ${tags}`;
}

/**
 * Presents an interactive prompt to the user to select which images to prune.
 *
 * It takes a list of candidate images, formats them for display, and uses
 * 'inquirer' to show a checkbox list. The function returns the subset of
 * images that the user has selected for deletion.
 *
 * @param {Array<object>} candidateImages - An array of image objects that are candidates for pruning.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of image objects selected by the user.
 *                                    If the user cancels or selects no images, it resolves to an empty array.
 */
export async function promptForImageSelection(candidateImages) {
  if (!Array.isArray(candidateImages) || candidateImages.length === 0) {
    return [];
  }

  const totalSize = candidateImages.reduce((sum, img) => sum + img.size, 0);

  try {
    const { selectedImages } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedImages',
        message: `Found ${candidateImages.length} prunable images (total size: ${chalk.bold.yellow(formatBytes(totalSize))}).\nSelect images to delete (Space to select, Enter to confirm):`,
        choices: candidateImages.map(image => ({
          name: formatImageChoice(image),
          value: image, // The entire image object is the value
          short: image.id, // Used for displaying the final answer
        })),
        pageSize: 15, // Show more items at once
        loop: false, // Don't loop from top to bottom
        validate: (answer) => {
          if (answer.length === 0) {
            return 'You must select at least one image to prune. Use Ctrl+C to cancel.';
          }
          return true;
        },
      },
    ]);

    return selectedImages;
  } catch (error) {
    // Inquirer can throw an error if the process is interrupted (e.g., Ctrl+C).
    // We'll treat this as a graceful exit from the interactive session.
    console.log(chalk.yellow('\nInteractive selection cancelled. No images will be deleted.'));
    return [];
  }
}