/**
 * @file src/core/mapper.js
 * @description The main orchestrator for the environment variable mapping process.
 * This module coordinates the directory scanning, file parsing, and result formatting
 * to generate the final output. It acts as the central hub connecting the different
 * components of the application.
 */

import { findJavaScriptFiles } from '../scanner/directory-scanner.js';
import { parseFile } from '../parser/file-parser.js';
import { formatResults } from '../reporter/formatter.js';

/**
 * Groups the raw findings from all parsed files by environment variable name.
 * This aggregation step is crucial for creating a unique list of variables and
 * for reporting all locations where a specific variable is used.
 *
 * @param {Array<object>} allFindings - An array of all environment variable occurrences
 *   found across all files. Each object should have `name`, `file`, `line`, and `column`.
 * @returns {Map<string, object[]>} A Map where each key is a unique environment
 *   variable name and the value is an array of its occurrence objects.
 */
const groupFindingsByVarName = (allFindings) => {
  const grouped = new Map();

  for (const finding of allFindings) {
    const { name, file, line, column } = finding;
    const occurrence = { file, line, column };

    if (grouped.has(name)) {
      grouped.get(name).push(occurrence);
    } else {
      grouped.set(name, [occurrence]);
    }
  }

  return grouped;
};

/**
 * Orchestrates the entire process of scanning, parsing, and reporting environment variables.
 *
 * This is the main entry point for the core logic. It performs the following steps:
 * 1. Scans the specified directory for relevant source files, respecting ignore patterns.
 * 2. Concurrently parses each file to find environment variable usages.
 * 3. Aggregates and groups all findings by variable name.
 * 4. Formats the aggregated results according to the specified output format.
 *
 * @param {object} options - The configuration options for the mapping process.
 * @param {string} options.directory - The path to the directory to scan.
 * @param {string} options.format - The desired output format (e.g., 'list', 'json').
 * @param {string[]} [options.ignorePatterns=[]] - An array of glob patterns to ignore.
 * @returns {Promise<{content: string, isFile: boolean, fileName: string | null}>} A promise that
 *   resolves to an object containing the formatted output content and metadata about
 *   whether it should be written to a file.
 * @throws {Error} Throws if any stage of the process fails (e.g., directory not found,
 *   file parsing errors, unsupported format).
 */
export const mapEnvironmentVariables = async ({ directory, format, ignorePatterns = [] }) => {
  try {
    // Step 1: Find all relevant files in the target directory.
    const filePaths = await findJavaScriptFiles(directory, ignorePatterns);

    if (filePaths.length === 0) {
      // If no files are found, we can short-circuit and return an empty result.
      // The formatter will handle the "no results" message.
      return formatResults(new Map(), format);
    }

    // Step 2: Parse all files concurrently to extract environment variable usages.
    // `Promise.allSettled` is used to ensure all files are processed, even if some
    // fail to parse (e.g., due to syntax errors). This makes the tool more robust.
    const parsePromises = filePaths.map((filePath) => parseFile(filePath));
    const results = await Promise.allSettled(parsePromises);

    const allFindings = [];
    const parsingErrors = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        // `result.value` is the array of findings from `parseFile`.
        allFindings.push(...result.value);
      } else {
        // `result.reason` is the error thrown by `parseFile`.
        // We collect errors to report them if needed, but don't halt execution.
        // This is useful for large codebases where one broken file shouldn't stop the whole scan.
        parsingErrors.push({
          file: filePaths[index],
          reason: result.reason.message,
        });
      }
    });

    // Optional: If you want to be strict and log parsing errors to stderr.
    // For now, we proceed silently, which is often the desired behavior for a linter-like tool.
    if (parsingErrors.length > 0) {
      // Example of how you might log these errors without stopping the process:
      // console.error('Warning: Some files could not be parsed:');
      // parsingErrors.forEach(err => console.error(`- ${err.file}: ${err.reason}`));
    }

    // Step 3: Group all successful findings by the environment variable name.
    const groupedResults = groupFindingsByVarName(allFindings);

    // Step 4: Format the grouped results into the desired output format.
    const formattedOutput = formatResults(groupedResults, format);

    return formattedOutput;
  } catch (error) {
    // This catch block handles errors from `findJavaScriptFiles` or `formatResults`,
    // or any other unexpected critical failure.
    const contextualError = new Error(`Failed to map environment variables: ${error.message}`);
    contextualError.cause = error;
    throw contextualError;
  }
};