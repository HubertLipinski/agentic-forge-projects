/**
 * src/core/prune-engine.js
 *
 * This module orchestrates the entire image pruning process. It serves as the
 * central controller that coordinates fetching data from the Docker service,
 * analyzing it to find candidates, and then executing the pruning action based
 * on the user's chosen mode (interactive, dry-run, or non-interactive deletion).
 *
 * @module core/prune-engine
 */

import ora from 'ora';
import chalk from 'chalk';
import { listImages, listContainers, deleteImage } from '../services/docker-service.js';
import { analyzeImages } from './image-analyzer.js';
import { promptForImageSelection } from '../ui/interactive-prompt.js';
import { formatBytes, formatRepoTags, truncateString } from '../utils/formatters.js';

/**
 * Sorts an array of image objects based on a specified key and order.
 *
 * @param {Array<object>} images - The array of images to sort.
 * @param {string} sortKey - The key to sort by ('size', 'name', 'date').
 * @param {string} sortOrder - The order to sort in ('asc' or 'desc').
 * @returns {Array<object>} The sorted array of images.
 */
function sortCandidates(images, sortKey, sortOrder) {
  const sorted = [...images]; // Create a shallow copy to avoid mutating the original array

  const compareFn = (a, b) => {
    let valA, valB;

    switch (sortKey) {
      case 'size':
        valA = a.size;
        valB = b.size;
        break;
      case 'name':
        // Use the first repo tag for sorting, or an empty string if untagged
        valA = a.repoTags[0] ?? '';
        valB = b.repoTags[0] ?? '';
        break;
      case 'date':
        valA = a.created;
        valB = b.created;
        break;
      default:
        return 0; // No sorting if key is unrecognized
    }

    if (valA < valB) return -1;
    if (valA > valB) return 1;
    return 0;
  };

  sorted.sort(compareFn);

  if (sortOrder === 'desc') {
    sorted.reverse();
  }

  return sorted;
}

/**
 * Displays a summary of images that would be deleted in a dry-run.
 *
 * @param {Array<object>} images - The list of images to display.
 */
function displayDryRunSummary(images) {
  if (images.length === 0) {
    console.log(chalk.green('Dry run complete. No images match the criteria for pruning.'));
    return;
  }

  console.log(chalk.yellow('\n--- Dry Run: Images that would be pruned ---'));
  let totalSize = 0;

  images.forEach(image => {
    const tags = formatRepoTags(image.repoTags);
    const size = formatBytes(image.size);
    totalSize += image.size;
    console.log(
      `  - ${chalk.cyan(image.id)} | Size: ${chalk.magenta(size.padEnd(9))} | Tags: ${truncateString(tags, 60)}`
    );
  });

  console.log(chalk.yellow('----------------------------------------------'));
  console.log(
    `\n${chalk.bold.yellow('Summary:')} ${images.length} images would be pruned, reclaiming approximately ${chalk.green(formatBytes(totalSize))}.`
  );
  console.log('Run without --dry-run to execute the deletion.');
}

/**
 * Deletes a list of specified images and displays progress and a final summary.
 *
 * @param {Array<object>} imagesToDelete - The list of image objects to delete.
 * @returns {Promise<number>} A promise that resolves with the total bytes reclaimed.
 */
async function executeDeletion(imagesToDelete) {
  if (imagesToDelete.length === 0) {
    console.log(chalk.green('\nNo images selected for deletion.'));
    return 0;
  }

  console.log(chalk.cyan(`\nAttempting to prune ${imagesToDelete.length} image(s)...`));
  let totalReclaimedBytes = 0;
  let successCount = 0;
  let failCount = 0;

  for (const image of imagesToDelete) {
    const spinner = ora(`Deleting ${image.id} (${formatRepoTags(image.repoTags)})`).start();
    try {
      await deleteImage(image.id);
      spinner.succeed(chalk.gray(`Deleted ${image.id}`));
      totalReclaimedBytes += image.size;
      successCount++;
    } catch (error) {
      // DockerServiceError provides user-friendly messages
      spinner.fail(chalk.red(`Failed to delete ${image.id}: ${error.message}`));
      failCount++;
    }
  }

  console.log(chalk.bold('\n--- Pruning Complete ---'));
  if (successCount > 0) {
    console.log(
      chalk.green(`Successfully deleted ${successCount} image(s).`)
    );
    console.log(
      chalk.green(`Total disk space reclaimed: ${formatBytes(totalReclaimedBytes)}`)
    );
  }
  if (failCount > 0) {
    console.log(
      chalk.yellow(`Failed to delete ${failCount} image(s). They might be in use by stopped containers or part of an image hierarchy.`)
    );
  }
  console.log('------------------------');

  return totalReclaimedBytes;
}

/**
 * The main orchestrator for the pruning process.
 *
 * It fetches all images and containers, uses the ImageAnalyzer to find candidates,
 * sorts them, and then delegates to the appropriate handler based on the run mode
 * (interactive, dry-run, or non-interactive).
 *
 * @param {object} options - The command-line options.
 * @param {boolean} options.interactive - Run in interactive mode.
 * @param {boolean} options.dryRun - Run in dry-run mode.
 * @param {object} options.filters - Filtering criteria for the analyzer.
 * @param {string} options.sort.key - The key to sort candidates by ('size', 'name', 'date').
 * @param {string} options.sort.order - The sort order ('asc', 'desc').
 * @returns {Promise<void>} A promise that resolves when the process is complete.
 */
export async function runPruneEngine(options) {
  const { interactive, dryRun, filters, sort } = options;

  try {
    // 1. Fetch data from Docker daemon
    const spinner = ora('Fetching Docker images and containers...').start();
    const [allImages, allContainers] = await Promise.all([
      listImages(),
      listContainers(),
    ]);
    spinner.succeed('Fetched Docker data.');

    // 2. Analyze images to find pruning candidates
    const candidates = analyzeImages({ allImages, allContainers, filters });

    if (candidates.length === 0) {
      console.log(chalk.green('\nNo prunable images found matching your criteria. Your system is clean!'));
      return;
    }

    // 3. Sort candidates as per user request
    const sortedCandidates = sortCandidates(candidates, sort.key, sort.order);

    // 4. Execute action based on mode
    if (dryRun) {
      displayDryRunSummary(sortedCandidates);
    } else if (interactive) {
      const imagesToPrune = await promptForImageSelection(sortedCandidates);
      await executeDeletion(imagesToPrune);
    } else {
      // Non-interactive deletion (the default behavior)
      console.log(chalk.yellow(`\nFound ${sortedCandidates.length} prunable image(s). Proceeding with non-interactive deletion.`));
      await executeDeletion(sortedCandidates);
    }
  } catch (error) {
    // Catch errors from docker-service or other parts of the flow
    console.error(chalk.red.bold(`\nAn unexpected error occurred: ${error.message}`));
    // For developers, log the stack trace if available
    if (process.env.NODE_ENV === 'development' && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}