/**
 * @file src/ui/reporter.js
 * @description Formats and prints analysis results to the console using picocolors
 * for readability, clearly showing errors and suggestions.
 */

import path from 'node:path';
import pc from 'picocolors';

/**
 * A collection of symbols used for formatting the report output.
 * Using symbols adds visual clarity to the report.
 * @type {object}
 */
const SYMBOLS = {
  error: pc.red('✖'),
  warning: pc.yellow('!'),
  success: pc.green('✔'),
  info: pc.blue('ℹ'),
  arrow: pc.gray('→'),
  suggestion: pc.cyan('›'),
};

/**
 * Formats a file path for display. It makes the path relative to the current
 * working directory to keep it short and readable.
 *
 * @param {string} absolutePath - The absolute path of the file.
 * @returns {string} A formatted, relative path string.
 */
function formatFilePath(absolutePath) {
  const relativePath = path.relative(process.cwd(), absolutePath);
  return pc.underline(pc.white(relativePath));
}

/**
 * Prints a standardized header for the report.
 * @param {string} title - The title of the report section.
 */
function printHeader(title) {
  console.log(pc.bold(pc.blue(`\n--- ${title} ---\n`)));
}

/**
 * Reports the results of a project analysis, including broken imports and suggestions.
 *
 * @param {Array<object>} analysisResults - The array of results from the analyzer.
 *   Each object should contain `filePath`, `brokenImports`, and optionally `error`.
 * @param {object} [options={}] - Reporting options.
 * @param {boolean} [options.verbose=false] - If true, prints more detailed error messages.
 */
export function reportAnalysis(analysisResults, options = {}) {
  const { verbose = false } = options;
  let totalErrors = 0;

  const filesWithErrors = analysisResults.filter(
    result => result.error || (result.brokenImports && result.brokenImports.length > 0)
  );

  if (filesWithErrors.length === 0) {
    console.log(`\n${SYMBOLS.success} ${pc.green('Analysis complete. No broken imports found!')}`);
    return;
  }

  printHeader('Analysis Report');

  for (const result of filesWithErrors) {
    console.log(`${formatFilePath(result.filePath)}`);

    if (result.error) {
      totalErrors++;
      console.log(`  ${SYMBOLS.error} ${pc.red('Error processing file:')} ${result.error}`);
      continue;
    }

    for (const broken of result.brokenImports) {
      totalErrors++;
      console.log(`  ${SYMBOLS.error} ${pc.red('Broken import:')} ${pc.yellow(`'${broken.specifier}'`)}`);

      if (verbose && broken.error) {
        console.log(`    ${pc.gray(`Reason: ${broken.error}`)}`);
      }

      if (broken.suggestions && broken.suggestions.length > 0) {
        console.log(pc.gray('    Suggestions:'));
        for (const suggestion of broken.suggestions) {
          console.log(`      ${SYMBOLS.suggestion} ${pc.cyan(suggestion)}`);
        }
      } else {
        console.log(pc.gray('    No suggestions available.'));
      }
    }
    console.log(''); // Add a blank line for readability between files
  }

  const errorSummary = pc.bold(pc.red(`${totalErrors} problem${totalErrors > 1 ? 's' : ''}`));
  const fileSummary = pc.bold(`${filesWithErrors.length} file${filesWithErrors.length > 1 ? 's' : ''}`);
  console.log(`${SYMBOLS.info} Found ${errorSummary} in ${fileSummary}.`);
  console.log(`${SYMBOLS.info} Run with ${pc.cyan('fix')} command to apply suggestions.`);
}

/**
 * Reports the progress and result of applying a single fix.
 *
 * @param {object} fixDetails - Details about the fix being applied.
 * @param {string} fixDetails.filePath - The path to the file being modified.
 * @param {string} fixDetails.originalSpecifier - The original broken import specifier.
 * @param {string} fixDetails.newSpecifier - The new specifier that was applied.
 */
export function reportFix(fixDetails) {
  const { filePath, originalSpecifier, newSpecifier } = fixDetails;
  console.log(
    `  ${SYMBOLS.success} ${pc.green('Fixed:')} In ${formatFilePath(filePath)}, replaced ${pc.yellow(
      `'${originalSpecifier}'`
    )} ${SYMBOLS.arrow} ${pc.cyan(`'${newSpecifier}'`)}`
  );
}

/**
 * Reports when a fix is skipped, either by the user or automatically.
 *
 * @param {object} skipDetails - Details about the skipped fix.
 * @param {string} skipDetails.filePath - The path to the file.
 * @param {string} skipDetails.specifier - The import specifier that was skipped.
 */
export function reportSkipped(skipDetails) {
  const { filePath, specifier } = skipDetails;
  console.log(
    `  ${SYMBOLS.warning} ${pc.yellow('Skipped:')} No changes made for ${pc.yellow(
      `'${specifier}'`
    )} in ${formatFilePath(filePath)}`
  );
}

/**
 * Prints a summary after the fix command has completed.
 *
 * @param {number} fixesApplied - The total number of fixes applied.
 * @param {number} filesModified - The total number of files modified.
 */
export function reportFixSummary(fixesApplied, filesModified) {
  if (fixesApplied > 0) {
    const fixSummary = pc.bold(pc.green(`${fixesApplied} fix${fixesApplied > 1 ? 'es' : ''}`));
    const fileSummary = pc.bold(`${filesModified} file${filesModified > 1 ? 's' : ''}`);
    console.log(`\n${SYMBOLS.success} Successfully applied ${fixSummary} across ${fileSummary}.`);
  } else {
    console.log(`\n${SYMBOLS.info} No fixes were applied.`);
  }
}

/**
 * Displays a generic error message to the console.
 *
 * @param {Error | string} error - The error object or message to display.
 */
export function reportError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n${SYMBOLS.error} ${pc.red('An error occurred:')}\n  ${message}`);
}

/**
 * Reports that the tool is entering watch mode.
 *
 * @param {string} initialScanMessage - A message to display about the initial scan.
 */
export function reportWatchMode(initialScanMessage) {
  console.log(pc.cyan('\nStarting in watch mode...'));
  console.log(pc.gray(initialScanMessage));
  console.log(pc.gray('Press Ctrl+C to exit.'));
}

/**
 * Reports a file change detected in watch mode.
 *
 * @param {string} event - The type of change (e.g., 'change', 'add', 'unlink').
 * @param {string} filePath - The path of the file that changed.
 */
export function reportFileChange(event, filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const eventName = {
    change: 'modified',
    add: 'added',
    unlink: 'removed',
  }[event] || event;

  console.log(pc.magenta(`\n[${new Date().toLocaleTimeString()}] File ${eventName}: ${relativePath}. Re-analyzing...`));
}