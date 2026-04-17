/**
 * @file src/reporters/json-reporter.js
 * @description Formats cycle detection results into a structured JSON string for
 * machine-readable output, suitable for CI/CD pipelines or other tools.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import logger from '../utils/logger.js';

/**
 * @typedef {import('graphology').Graph} DependencyGraph
 * @typedef {string[]} Cycle - An array of absolute file paths representing a circular dependency.
 */

/**
 * @typedef {object} JsonReporterOptions
 * @property {string} [baseDir=process.cwd()] - The base directory to make file paths relative to.
 * @property {string} [outputFile] - If provided, the JSON report will be written to this file path.
 */

/**
 * @typedef {object} JsonCycle
 * @property {number} size - The number of files in the cycle.
 * @property {string[]} files - An array of file paths involved in the cycle, relative to `baseDir`.
 */

/**
 * @typedef {object} JsonReport
 * @property {object} summary - A high-level summary of the analysis.
 * @property {number} summary.totalFiles - The total number of files analyzed.
 * @property {number} summary.totalDependencies - The total number of dependencies (edges) found.
 * @property {number} summary.cycleCount - The total number of circular dependency groups found.
 * @property {boolean} summary.hasCycles - A boolean flag indicating if any cycles were detected.
 * @property {JsonCycle[]} cycles - An array of objects, each detailing a detected cycle.
 */

/**
 * Generates a structured JSON report from the analysis results.
 *
 * This function creates a comprehensive, machine-readable object containing a summary
 * of the analysis and a detailed list of all detected cycles. File paths are made
 * relative to a specified base directory to ensure portability.
 *
 * @param {object} analysisResult - The result object from the analysis.
 * @param {Cycle[]} analysisResult.cycles - An array of detected cycles.
 * @param {DependencyGraph} analysisResult.graph - The complete dependency graph.
 * @param {JsonReporterOptions} [options={}] - Configuration for the JSON reporter.
 * @returns {Promise<string>} A promise that resolves to the JSON report as a string.
 */
async function generateJsonReport(analysisResult, options = {}) {
  const { cycles, graph } = analysisResult;
  const reporterOptions = {
    baseDir: process.cwd(),
    ...options,
  };

  logger.debug('Generating JSON report...');

  /** @type {JsonCycle[]} */
  const formattedCycles = cycles
    // Sort cycles by size (largest first) for consistent output
    .sort((a, b) => b.length - a.length)
    .map(cycle => ({
      size: cycle.length,
      files: cycle.map(absolutePath => path.relative(reporterOptions.baseDir, absolutePath)),
    }));

  /** @type {JsonReport} */
  const report = {
    summary: {
      totalFiles: graph.order,
      totalDependencies: graph.size,
      cycleCount: cycles.length,
      hasCycles: cycles.length > 0,
    },
    cycles: formattedCycles,
  };

  // The `null, 2` arguments pretty-print the JSON with an indentation of 2 spaces.
  const jsonString = JSON.stringify(report, null, 2);

  if (reporterOptions.outputFile) {
    try {
      const outputPath = path.resolve(reporterOptions.outputFile);
      await fs.writeFile(outputPath, jsonString, 'utf-8');
      logger.info(`JSON report successfully written to: ${outputPath}`);
    } catch (error) {
      logger.error(`Failed to write JSON report to file: ${reporterOptions.outputFile}`, error);
      // Re-throw to allow the CLI to exit with a non-zero code, indicating failure.
      throw new Error(`Could not write to output file: ${error.message}`);
    }
  } else {
    // If no output file is specified, print the JSON to standard output.
    // We use console.log directly here to bypass logger formatting.
    console.log(jsonString);
  }

  return jsonString;
}

export { generateJsonReport };