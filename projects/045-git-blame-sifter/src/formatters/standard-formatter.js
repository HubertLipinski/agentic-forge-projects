/**
 * @file src/formatters/standard-formatter.js
 * @module formatters/standard-formatter
 * @description Formats the sifted blame data into a human-readable, colorized
 * terminal output, similar to the standard `git blame` view.
 */

import chalk from 'chalk';

/**
 * A cache for colorizing commit hashes. This ensures that the same commit hash
 * always gets the same color within a single output, making it easier to visually
 * group changes by the same commit.
 * @type {Map<string, function>}
 */
const commitColorCache = new Map();

/**
 * A pool of chalk color functions to cycle through for commit hashes.
 * Using a predefined set of distinct colors improves readability.
 */
const chalkColorPool = [
  chalk.yellow,
  chalk.cyan,
  chalk.magenta,
  chalk.green,
  chalk.blue,
  chalk.red,
  chalk.yellowBright,
  chalk.cyanBright,
  chalk.magentaBright,
  chalk.greenBright,
  chalk.blueBright,
  chalk.redBright,
];

let colorIndex = 0;

/**
 * Retrieves a consistent color function for a given commit hash.
 * If the hash has been seen before, it returns the same color function.
 * Otherwise, it assigns the next color from the pool and caches it.
 *
 * @param {string} commitHash - The full SHA of the commit.
 * @returns {function} A chalk color function.
 */
function getCommitColor(commitHash) {
  if (commitColorCache.has(commitHash)) {
    return commitColorCache.get(commitHash);
  }

  const color = chalkColorPool[colorIndex % chalkColorPool.length];
  commitColorCache.set(commitHash, color);
  colorIndex++;
  return color;
}

/**
 * Formats a single line of blame data for standard output.
 * It constructs a string similar to `git blame` output:
 * `^<hash-prefix> (Author Name YYYY-MM-DD HH:MM:SS Z LineNum) Code content`
 *
 * @param {object} lineData - The processed blame data for a single line.
 * @param {object} lineData.siftedCommit - The final substantive commit for this line.
 * @param {string} lineData.content - The line's code content.
 * @param {number} lineData.finalLine - The line number in the final file.
 * @param {boolean} lineData.isTrivial - Whether the original commit was trivial.
 * @param {object} lineData.originalCommit - The original commit before history walking.
 * @param {number} maxAuthorWidth - The maximum width for the author name column for alignment.
 * @param {number} maxLineNumWidth - The maximum width for the line number column.
 * @returns {string} The formatted and colorized string for a single line.
 */
function formatLine(lineData, maxAuthorWidth, maxLineNumWidth) {
  const { siftedCommit, content, finalLine, isTrivial, originalCommit } = lineData;

  const commitHash = siftedCommit.hash;
  const author = siftedCommit.author ?? 'Unknown Author';
  const authorTime = siftedCommit['author-time'] ?? 0;

  // Format the date to YYYY-MM-DD HH:MM:SS Z
  const date = new Date(authorTime * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const tzOffset = date.getTimezoneOffset();
  const tzSign = tzOffset > 0 ? '-' : '+';
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  const timezone = `${tzSign}${tzHours}${tzMinutes}`;
  const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezone}`;

  // Get a consistent color for the commit hash
  const color = getCommitColor(commitHash);

  // Use the short hash (first 8 characters) for display
  const shortHash = commitHash.substring(0, 8);

  // Pad author name and line number for alignment
  const paddedAuthor = author.padEnd(maxAuthorWidth);
  const paddedLineNum = String(finalLine).padStart(maxLineNumWidth);

  // Construct the metadata part of the line
  const meta = `(${paddedAuthor} ${formattedDate} ${paddedLineNum})`;

  // If the line was sifted, apply dim styling to indicate it was changed.
  // The original commit hash is shown to provide context about what was filtered.
  if (isTrivial) {
    const originalShortHash = originalCommit.hash.substring(0, 8);
    const boundaryMarker = chalk.gray('~');
    const coloredHash = color(shortHash);
    const originalHashInfo = chalk.dim(`(${originalShortHash})`);

    return `${boundaryMarker}${coloredHash} ${chalk.dim(meta)} ${chalk.dim(content)} ${originalHashInfo}`;
  }

  // For non-sifted lines, use a format closer to standard `git blame`
  const boundaryMarker = commitHash.startsWith('00000000') ? ' ' : '^';
  const coloredHash = color(shortHash);

  return `${boundaryMarker}${coloredHash} ${meta} ${content}`;
}

/**
 * Calculates the maximum width needed for author names and line numbers
 * to ensure aligned output columns.
 *
 * @param {object[]} processedBlame - The array of processed line data.
 * @returns {{maxAuthorWidth: number, maxLineNumWidth: number}} The calculated max widths.
 */
function calculateColumnWidths(processedBlame) {
  let maxAuthorWidth = 10; // A reasonable minimum
  let maxLineNumWidth = 0;

  for (const line of processedBlame) {
    const authorLength = line.siftedCommit.author?.length ?? 0;
    if (authorLength > maxAuthorWidth) {
      maxAuthorWidth = authorLength;
    }
  }

  // The max line number is just the total number of lines.
  maxLineNumWidth = String(processedBlame.length).length;

  return { maxAuthorWidth, maxLineNumWidth };
}

/**
 * The main function for the standard formatter.
 * It takes the final processed blame data and prints it to the console
 * in a human-readable, colorized format.
 *
 * @async
 * @function standardFormatter
 * @param {object} analysisResult - The result object from the sift command.
 * @param {object[]} analysisResult.processedBlame - An array of processed blame data for each line.
 * @param {object} [options={}] - Formatting options (currently unused).
 * @returns {Promise<void>} A promise that resolves when printing is complete.
 */
export async function standardFormatter(analysisResult, options = {}) {
  const { processedBlame } = analysisResult;

  if (!processedBlame || processedBlame.length === 0) {
    console.log('No blame information to display.');
    return;
  }

  // Reset color cache for each run to ensure consistent coloring within a single file view.
  commitColorCache.clear();
  colorIndex = 0;

  try {
    const { maxAuthorWidth, maxLineNumWidth } = calculateColumnWidths(processedBlame);

    for (const lineData of processedBlame) {
      const formattedLine = formatLine(lineData, maxAuthorWidth, maxLineNumWidth);
      console.log(formattedLine);
    }
  } catch (error) {
    console.error(chalk.red('An unexpected error occurred during standard formatting:'));
    console.error(error);
    // Re-throw to indicate failure to the caller
    throw new Error('Standard formatting failed.', { cause: error });
  }
}