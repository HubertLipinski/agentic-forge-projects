/**
 * @file src/formatters/summary-formatter.js
 * @module formatters/summary-formatter
 * @description Generates a summary report of authors and their contribution
 * percentages after filtering trivial commits.
 */

import chalk from 'chalk';

/**
 * Aggregates line counts by author from the processed blame data.
 *
 * @param {object[]} processedBlame - The array of processed line data from the sift command.
 * @returns {{
 *   authorStats: Map<string, { name: string, lines: number, originalLines: number }>,
 *   totalLines: number,
 *   siftedLines: number
 * }} An object containing the aggregated statistics.
 */
function aggregateAuthorStats(processedBlame) {
  const authorStats = new Map();
  let siftedLines = 0;
  const totalLines = processedBlame.length;

  for (const lineData of processedBlame) {
    const { siftedCommit, isTrivial } = lineData;

    // Use a unique key for each author, combining name and email to avoid collisions.
    const authorName = siftedCommit.author ?? 'Unknown Author';
    const authorEmail = siftedCommit['author-mail'] ?? '<unknown@example.com>';
    const authorKey = `${authorName} ${authorEmail}`;

    if (!authorStats.has(authorKey)) {
      authorStats.set(authorKey, {
        name: authorName,
        email: authorEmail,
        lines: 0,
        originalLines: 0, // Count of lines originally attributed to this author before sifting
      });
    }

    const stats = authorStats.get(authorKey);
    stats.lines += 1;

    if (isTrivial) {
      siftedLines++;
      // If the line was sifted, the *original* author was the one who made the trivial change.
      // We need to track this to show how many trivial lines each author contributed.
      const originalAuthorName = lineData.originalCommit.author ?? 'Unknown Author';
      const originalAuthorEmail = lineData.originalCommit['author-mail'] ?? '<unknown@example.com>';
      const originalAuthorKey = `${originalAuthorName} ${originalAuthorEmail}`;

      // Ensure the original author exists in the stats map
      if (!authorStats.has(originalAuthorKey)) {
        authorStats.set(originalAuthorKey, {
          name: originalAuthorName,
          email: originalAuthorEmail,
          lines: 0,
          originalLines: 0,
        });
      }
      authorStats.get(originalAuthorKey).originalLines += 1;
    }
  }

  return { authorStats, totalLines, siftedLines };
}

/**
 * Formats and prints the summary report to the console.
 *
 * @param {Map<string, { name: string, lines: number }>} authorStats - Aggregated stats per author.
 * @param {number} totalLines - The total number of lines in the file.
 * @param {number} siftedLines - The number of lines where the author was changed.
 * @param {object} options - Formatting options.
 * @param {string} options.filePath - The path of the file being analyzed.
 */
function printSummary(authorStats, totalLines, siftedLines, { filePath }) {
  console.log(chalk.bold.underline(`Blame Sifter Summary for: ${filePath}\n`));

  const siftedPercentage = totalLines > 0 ? ((siftedLines / totalLines) * 100).toFixed(1) : 0;
  console.log(
    `Total lines: ${chalk.bold(totalLines)}. Sifted ${chalk.bold(siftedLines)} lines (${chalk.yellow(siftedPercentage + '%')}) to find substantive authors.\n`
  );

  if (authorStats.size === 0) {
    console.log('No authors found to summarize.');
    return;
  }

  // Convert map to array and sort by line count descending
  const sortedAuthors = Array.from(authorStats.values()).sort((a, b) => b.lines - a.lines);

  // Find max widths for alignment
  const maxNameWidth = Math.max(...sortedAuthors.map(a => a.name.length), 'Author'.length);
  const maxLinesWidth = Math.max(...sortedAuthors.map(a => String(a.lines).length), 'Lines'.length);

  // Print header
  const header = [
    chalk.bold('Author'.padEnd(maxNameWidth)),
    chalk.bold('Lines'.padStart(maxLinesWidth)),
    chalk.bold('%'.padStart(6)),
    chalk.bold('Trivial'.padStart(8)),
  ].join('  ');
  console.log(header);
  console.log('─'.repeat(header.length - 10)); // Adjust for chalk characters

  // Print author rows
  for (const author of sortedAuthors) {
    const percentage = totalLines > 0 ? ((author.lines / totalLines) * 100).toFixed(1) : '0.0';
    const trivialCount = author.originalLines > 0 ? chalk.dim(`(${author.originalLines})`) : '0';

    const row = [
      author.name.padEnd(maxNameWidth),
      String(author.lines).padStart(maxLinesWidth),
      `${percentage}%`.padStart(6),
      trivialCount.padStart(8 + (author.originalLines > 0 ? 2 : 0)), // Account for chalk dim chars
    ].join('  ');

    console.log(row);
  }

  console.log(chalk.dim('\n(Trivial column shows count of trivial commits made by an author)'));
}

/**
 * The main function for the summary formatter.
 * It takes the final processed blame data, aggregates it by author,
 * and prints a summary report to the console.
 *
 * @async
 * @function summaryFormatter
 * @param {object} analysisResult - The result object from the sift command.
 * @param {object[]} analysisResult.processedBlame - An array of processed blame data for each line.
 * @param {string} analysisResult.filePath - The path of the file analyzed.
 * @param {object} [options={}] - Formatting options (currently unused, but preserved for API consistency).
 * @returns {Promise<void>} A promise that resolves when printing is complete.
 */
export async function summaryFormatter(analysisResult, options = {}) {
  const { processedBlame, filePath } = analysisResult;

  if (!processedBlame || processedBlame.length === 0) {
    console.log(`No blame information to summarize for ${filePath}.`);
    return;
  }

  try {
    const { authorStats, totalLines, siftedLines } = aggregateAuthorStats(processedBlame);
    printSummary(authorStats, totalLines, siftedLines, { filePath });
  } catch (error) {
    console.error(chalk.red('An unexpected error occurred during summary formatting:'));
    console.error(error);
    // Re-throw to indicate failure to the caller
    throw new Error('Summary formatting failed.', { cause: error });
  }
}