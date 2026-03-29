/**
 * @file src/core/reporter.js
 * @description Generates a final summary report for the console, detailing statistics
 *              like total dependencies, conflicts found, and cycles detected.
 * @module reporter
 */

import logger from '../utils/logger.js';

/**
 * @typedef {import('../graph/graph-node.js').GraphNode} GraphNode
 * @typedef {import('../analysis/version-resolver.js').VersionConflict} VersionConflict
 */

// ANSI escape codes for styling console output
const styles = {
  bold: '\x1b[1m',
  underline: '\x1b[4m',
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Generates and prints a summary report to the console based on the analysis results.
 *
 * The report includes:
 * - A summary of key statistics (total packages, version conflicts, circular dependencies).
 * - Detailed lists of any version conflicts found.
 * - Detailed lists of any circular dependencies found.
 *
 * @param {object} analysisResults - The results from the scanning and analysis phases.
 * @param {Map<string, GraphNode>} analysisResults.graph - The complete dependency graph.
 * @param {string} analysisResults.rootNodeId - The ID of the root project node.
 * @param {VersionConflict[]} analysisResults.conflicts - A list of detected version conflicts.
 * @param {string[][]} analysisResults.cycles - A list of detected circular dependencies.
 * @param {object} cliOptions - The command-line options that were used for the scan.
 * @param {string} cliOptions.output - The path to the generated output file.
 */
export function generateReport({ graph, rootNodeId, conflicts, cycles }, cliOptions) {
  const totalPackages = graph.size;
  const rootNode = graph.get(rootNodeId);
  const projectName = rootNode?.name || 'Current Project';

  // Use a logger-like function to ensure consistent output, bypassing log levels for the report itself.
  const print = (message = '') => process.stdout.write(`${message}\n`);

  print();
  print(`${styles.bold}${styles.underline}NPM Dependency Grapher Report${styles.reset}`);
  print(`${styles.gray}-----------------------------------${styles.reset}`);
  print();

  // --- Summary Section ---
  print(`${styles.bold}Scan Summary for: ${styles.cyan}${projectName}${styles.reset}`);
  print();
  print(`  • Total Unique Packages: ${styles.bold}${styles.blue}${totalPackages}${styles.reset}`);
  print(`  • Version Conflicts:     ${formatCount(conflicts.length, styles.yellow, styles.green)}`);
  print(`  • Circular Dependencies: ${formatCount(cycles.length, styles.red, styles.green)}`);
  print();
  print(`Graph visualization saved to: ${styles.green}${cliOptions.output}${styles.reset}`);
  print();

  // --- Version Conflicts Section ---
  if (conflicts.length > 0) {
    print(`${styles.bold}${styles.underline}Version Conflicts (${conflicts.length})${styles.reset}`);
    print(`${styles.gray}A conflict occurs when a resolved version doesn't satisfy a required semantic version range.${styles.reset}`);
    print();
    conflicts.forEach((conflict, index) => {
      print(`  ${index + 1}. ${styles.yellow}${conflict.dependencyName}${styles.reset}`);
      print(`     - Required by: ${styles.cyan}${conflict.parentId}${styles.reset}`);
      print(`     - Required version: ${styles.magenta}${conflict.requiredVersion}${styles.reset}`);
      print(`     - Resolved version: ${styles.red}${conflict.resolvedVersion}${styles.reset}`);
      print();
    });
  }

  // --- Circular Dependencies Section ---
  if (cycles.length > 0) {
    print(`${styles.bold}${styles.underline}Circular Dependencies (${cycles.length})${styles.reset}`);
    print(`${styles.gray}These are dependency chains that loop back onto themselves.${styles.reset}`);
    print();
    cycles.forEach((cycle, index) => {
      const cyclePath = cycle.map(nodeId => `${styles.magenta}${nodeId}${styles.reset}`).join(` ${styles.gray}→${styles.reset} `);
      print(`  ${index + 1}. ${cyclePath}`);
    });
    print();
  }

  print(`${styles.gray}-----------------------------------${styles.reset}`);
  print(`${styles.bold}${styles.green}Report finished.${styles.reset}`);
  print();
}

/**
 * Formats a count value with color based on whether it's zero or non-zero.
 *
 * @param {number} count - The number to format.
 * @param {string} nonZeroColor - The ANSI color code for non-zero values.
 * @param {string} zeroColor - The ANSI color code for zero values.
 * @returns {string} The colorized and formatted string.
 */
function formatCount(count, nonZeroColor, zeroColor) {
  const color = count > 0 ? nonZeroColor : zeroColor;
  return `${styles.bold}${color}${count}${styles.reset}`;
}