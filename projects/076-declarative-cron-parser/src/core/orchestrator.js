/**
 * @file src/core/orchestrator.js
 * @description Coordinates the entire process of finding files, extracting schedules,
 * validating them, and generating the final crontab file. This module acts as the
 * central hub, bringing together the various utilities and parsers.
 */

import { promises as fs } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { findFilesByGlob } from '../utils/file-reader.js';
import { extractSchedulesFromFile } from '../parsers/comment-extractor.js';
import { buildCrontab } from '../generators/crontab-builder.js';

/**
 * @typedef {import('../parsers/comment-extractor.js').CronSchedule} CronSchedule
 */

/**
 * A custom error class for orchestration failures, providing a high-level
 * summary of where in the process the error occurred.
 */
class OrchestratorError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [options] Additional options.
   * @param {Error} [options.cause] The original error that was caught.
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'OrchestratorError';
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Processes a list of file paths, extracting cron schedules from each.
 * It logs errors for individual file processing but continues with other files.
 *
 * @private
 * @param {string[]} filePaths - An array of absolute file paths to process.
 * @returns {Promise<CronSchedule[]>} A promise that resolves to a flattened array of all successfully extracted schedules.
 */
async function processFiles(filePaths) {
  const allSchedules = [];
  const processingPromises = filePaths.map(async (filePath) => {
    try {
      const schedules = await extractSchedulesFromFile(filePath);
      return schedules;
    } catch (error) {
      // Log errors for problematic files but don't halt the entire process.
      // This allows the tool to generate a partial crontab from the valid files.
      console.error(`[WARN] Skipping file due to error: ${filePath}`);
      console.error(`       Reason: ${error.name} - ${error.message}`);
      if (error.lineNumber) {
        console.error(`       At line: ${error.lineNumber}`);
      }
      return []; // Return an empty array for this file to not break Promise.all
    }
  });

  const results = await Promise.all(processingPromises);
  // Flatten the array of arrays into a single array of schedules
  results.forEach((schedules) => allSchedules.push(...schedules));

  return allSchedules;
}

/**
 * Writes the generated crontab content to the specified output file.
 * If the output file is '-', it writes to stdout instead.
 *
 * @private
 * @param {string} content - The crontab content to write.
 * @param {string} outputPath - The path to the output file, or '-' for stdout.
 * @returns {Promise<void>} A promise that resolves when the write operation is complete.
 * @throws {OrchestratorError} If writing to a file fails.
 */
async function writeOutput(content, outputPath) {
  if (outputPath === '-') {
    process.stdout.write(content);
    return;
  }

  const absolutePath = resolve(outputPath);
  try {
    // Ensure the output directory exists before writing the file.
    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf-8');
  } catch (error) {
    throw new OrchestratorError(
      `Failed to write crontab to output file: ${absolutePath}`,
      { cause: error }
    );
  }
}

/**
 * The main orchestration function. It finds files, extracts schedules,
 * builds the crontab string, and writes it to the specified output.
 *
 * @param {object} options - The configuration for the orchestration run.
 * @param {string[]} options.patterns - An array of glob patterns to search for source files.
 * @param {string} options.output - The path for the generated crontab file. Use '-' for stdout.
 * @param {string[]} [options.ignore=[]] - An array of glob patterns to ignore.
 * @param {Record<string, string>} [options.env={}] - Environment variables to include in the crontab.
 * @param {string|null} [options.header=null] - A custom header string for the crontab.
 * @returns {Promise<{fileCount: number, scheduleCount: number}>} A promise that resolves with statistics about the run.
 * @throws {OrchestratorError} If a critical error occurs during the process.
 */
export async function run(options) {
  const {
    patterns,
    output,
    ignore = [],
    env = {},
    header = null,
  } = options ?? {};

  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    console.warn('[WARN] No glob patterns provided. Nothing to process.');
    return { fileCount: 0, scheduleCount: 0 };
  }
  if (!output) {
    throw new OrchestratorError('Output path must be specified.');
  }

  try {
    // 1. Find all files matching the glob patterns.
    const filePaths = await findFilesByGlob(patterns, { ignore });
    if (filePaths.length === 0) {
      console.log('No source files found matching the provided patterns.');
      // Still write an empty crontab to clear out old jobs if the file exists.
      const emptyCrontab = buildCrontab({ schedules: [], env, header });
      await writeOutput(emptyCrontab, output);
      return { fileCount: 0, scheduleCount: 0 };
    }

    // 2. Process each file to extract cron schedules.
    const allSchedules = await processFiles(filePaths);

    // 3. Build the crontab string from the collected schedules.
    const crontabContent = buildCrontab({
      schedules: allSchedules,
      env,
      header,
    });

    // 4. Write the final string to the output file or stdout.
    await writeOutput(crontabContent, output);

    return {
      fileCount: filePaths.length,
      scheduleCount: allSchedules.length,
    };
  } catch (error) {
    // Catch errors from file finding, building, or writing, and wrap them.
    // Errors from file processing are handled within `processFiles`.
    if (error instanceof OrchestratorError) {
      throw error;
    }
    throw new OrchestratorError('The orchestration process failed unexpectedly.', {
      cause: error,
    });
  }
}