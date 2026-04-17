/**
 * @file src/reporters/console-reporter.js
 * @description Formats and prints cycle detection results to the console in a
 * human-readable format, using colors for clarity.
 */

import path from 'node:path';
import chalk from 'chalk';
import logger from '../utils/logger.js';

/**
 * @typedef {import('graphology').Graph} DependencyGraph
 * @typedef {string[]} Cycle - An array of absolute file paths representing a circular dependency.
 */

/**
 * @typedef {object} ConsoleReporterOptions
 * @property {string} [baseDir=process.cwd()] - The base directory to make file paths relative to.
 */

/**
 * Generates a detailed, colored string representation of a single dependency cycle.
 * It formats the file paths and shows the import chain.
 *
 * Example Output:
 *   Cycle 1 of 3:
 *     ┌─ /path/to/project/a.js
 *     │  imports /path/to/project/b.js
 *     └─> /path/to/project/b.js
 *        imports /path/to/project/a.js (completing the cycle)
 *
 * @param {Cycle} cycle - An array of absolute file paths forming a cycle.
 * @param {number} cycleIndex - The 1-based index of the current cycle.
 * @param {number} totalCycles - The total number of cycles found.
 * @param {DependencyGraph} graph - The full dependency graph.
 * @param {ConsoleReporterOptions} options - Reporter configuration options.
 * @returns {string} A formatted string for a single cycle.
 */
function formatCycle(cycle, cycleIndex, totalCycles, graph, options) {
  const { baseDir } = options;
  const relativePaths = cycle.map(p => path.relative(baseDir, p));

  const header = chalk.bold.white(`Cycle ${cycleIndex} of ${totalCycles}:`);
  let body = '';

  // Handle self-referencing cycle (A -> A)
  if (cycle.length === 1) {
    const node = relativePaths[0];
    body += `  ${chalk.red('┌─')} ${chalk.cyan(node)}\n`;
    body += `  ${chalk.red('└─>')} imports itself (self-referencing cycle)\n`;
    return `${header}\n${body}`;
  }

  // Handle multi-file cycles (A -> B -> ... -> A)
  for (let i = 0; i < cycle.length; i++) {
    const sourceNode = cycle[i];
    const targetNode = cycle[(i + 1) % cycle.length]; // Wraps around to the start

    const relativeSource = relativePaths[i];
    const relativeTarget = relativePaths[(i + 1) % cycle.length];

    const isLastInChain = i === cycle.length - 1;
    const prefix = isLastInChain ? `  ${chalk.red('└─>')}` : `  ${chalk.red('┌─')}`;
    const connector = isLastInChain ? '  ' : `  ${chalk.red('│')}`;

    body += `${prefix} ${chalk.cyan(relativeSource)}\n`;
    body += `${connector}   ${chalk.gray('imports')} ${chalk.yellow(relativeTarget)}`;

    if (isLastInChain) {
      body += chalk.gray(' (completing the cycle)');
    }
    body += '\n';
  }

  return `${header}\n${body}`;
}

/**
 * Generates and prints a summary report to the console.
 * This is the main entry point for the console reporter.
 *
 * @param {object} analysisResult - The result object from the analysis.
 * @param {Cycle[]} analysisResult.cycles - An array of detected cycles.
 * @param {DependencyGraph} analysisResult.graph - The complete dependency graph.
 * @param {ConsoleReporterOptions} [options={}] - Configuration for the reporter.
 * @returns {Promise<void>} A promise that resolves when the report has been printed.
 */
export async function generateConsoleReport(analysisResult, options = {}) {
  const { cycles, graph } = analysisResult;
  const reporterOptions = {
    baseDir: process.cwd(),
    ...options,
  };

  const totalCycles = cycles.length;

  // Print a clear header for the results section.
  console.log('\n' + chalk.bold.underline.white('Cyclic Import Detective Report') + '\n');

  if (totalCycles === 0) {
    logger.info(chalk.green.bold('✅ No circular dependencies found. Your codebase looks clean!'));
    const nodeCount = graph.order;
    const edgeCount = graph.size;
    logger.info(chalk.gray(`Analyzed ${nodeCount} files and ${edgeCount} dependencies.`));
    return;
  }

  // If cycles are found, present a summary and then the details.
  const cycleNoun = totalCycles === 1 ? 'group' : 'groups';
  logger.warn(
    chalk.yellow.bold(
      `🚨 Found ${chalk.red(totalCycles)} circular dependency ${cycleNoun}.`
    )
  );
  console.log(chalk.gray('Below are the details of each cycle:\n'));

  // Sort cycles by size (largest first) for better prioritization.
  const sortedCycles = [...cycles].sort((a, b) => b.length - a.length);

  sortedCycles.forEach((cycle, index) => {
    const formattedCycle = formatCycle(
      cycle,
      index + 1,
      totalCycles,
      graph,
      reporterOptions
    );
    console.log(formattedCycle);
  });

  // Print a concluding footer with advice.
  console.log(
    chalk.white.bold('\n💡 How to fix:')
  );
  console.log(
    chalk.white(
      '  - Use dependency inversion: Introduce an intermediary module or use dependency injection.'
    )
  );
  console.log(
    chalk.white(
      '  - Refactor shared code: Extract the common dependency into a new, separate module.'
    )
  );
  console.log(
    chalk.white(
      '  - Re-evaluate module boundaries: Sometimes a cycle indicates that modules are too tightly coupled.'
    )
  );
}