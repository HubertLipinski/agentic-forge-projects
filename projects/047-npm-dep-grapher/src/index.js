/**
 * @file src/index.js
 * @description The main entry point for the CLI application. Uses `commander` to parse
 *              arguments and orchestrate the scanning, analysis, and output generation.
 */

import { Command } from 'commander';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { create } from 'graphviz';

import logger from './utils/logger.js';
import { pathExists } from './utils/file-reader.js';
import { findWorkspacePackages } from './core/monorepo-scanner.js';
import { scanDependencies } from './core/dep-scanner.js';
import { detectCycles } from './analysis/cycle-detector.js';
import { findVersionConflicts } from './analysis/version-resolver.js';
import { buildDotGraph } from './graph/dot-builder.js';
import { generateReport } from './core/reporter.js';

// --- Main Application Logic ---

/**
 * The main function that orchestrates the entire dependency graphing process.
 * It takes parsed CLI options, runs the scan, performs analysis, generates
 * the DOT file, and creates the final output image and console report.
 *
 * @param {object} options - The command-line options parsed by Commander.
 */
async function run(options) {
  // 1. Configure Logger
  if (options.silent) {
    logger.setLevel('silent');
  } else if (options.verbose) {
    logger.setLevel('debug');
  }

  logger.info('NPM Dependency Grapher started.');
  logger.debug('CLI Options:', options);

  // 2. Validate and Prepare Paths
  const projectRoot = path.resolve(process.cwd());
  const entrypoint = path.join(projectRoot, 'package.json');
  const outputFilePath = path.resolve(projectRoot, options.output);
  const outputFormat = path.extname(outputFilePath).substring(1) || 'png';

  if (!(await pathExists(entrypoint))) {
    logger.error(`The root package.json was not found at: ${entrypoint}`);
    logger.error('Please run this tool from the root of your Node.js project.');
    process.exit(1);
  }

  try {
    // 3. Scan for Monorepo and Project Dependencies
    const workspacePackages = await findWorkspacePackages(projectRoot);
    const { graph, rootNodeId } = await scanDependencies({
      entrypoint,
      includeDev: options.dev,
      depth: options.depth,
      workspacePackages,
    });

    // 4. Analyze the Graph
    const conflicts = findVersionConflicts(graph);
    const cycles = detectCycles(graph);

    // 5. Build DOT representation
    const dotString = buildDotGraph({
      graph,
      rootNodeId,
      conflicts,
      cycles,
    });

    // 6. Generate Graphviz Output
    logger.info(`Generating graph image (${outputFormat}) at: ${outputFilePath}`);
    await generateGraphvizOutput(dotString, outputFilePath, outputFormat);

    // 7. Generate Console Report
    generateReport({ graph, rootNodeId, conflicts, cycles }, { output: outputFilePath });

    logger.info('Process completed successfully.');

  } catch (error) {
    logger.error('An unhandled error occurred during the process:', error.message);
    logger.debug(error.stack);
    process.exit(1);
  }
}

/**
 * Uses the `graphviz` library to convert a DOT string into an image file.
 *
 * @param {string} dotString - The graph definition in DOT language.
 * @param {string} outputPath - The path where the output image will be saved.
 * @param {string} format - The output format (e.g., 'png', 'svg', 'jpg').
 * @returns {Promise<void>} A promise that resolves when the file is written.
 */
async function generateGraphvizOutput(dotString, outputPath, format) {
  return new Promise((resolve, reject) => {
    try {
      const graph = create('digraph', { engine: 'dot' });
      
      // The `graphviz` library's `parse` method is a bit unusual.
      // It expects a callback that receives the parsed graph object.
      // We then render this object to a file.
      graph.parse(dotString, (g) => {
        g.output(
          {
            type: format,
            path: outputPath,
          },
          (stdout, stderr) => {
            if (stderr) {
              logger.warn('Graphviz encountered issues during rendering:', stderr.toString());
            }
            logger.info('Graph image generated.');
            resolve();
          },
          (err) => {
            if (err) {
              logger.error('Failed to generate Graphviz output. Is Graphviz installed and in your system PATH?');
              logger.error('Error details:', err.message);
              reject(err);
            }
          }
        );
      });
    } catch (error) {
      logger.error('An error occurred while setting up Graphviz rendering.', error);
      reject(error);
    }
  });
}


// --- CLI Definition ---

/**
 * Sets up and executes the command-line interface using Commander.
 * This function is the entry point when the script is run directly.
 */
export async function main() {
  const program = new Command();

  // Dynamically read version from package.json
  const pkgJsonPath = path.resolve(fileURLToPath(import.meta.url), '../../package.json');
  const pkg = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));

  program
    .name('dep-grapher')
    .version(pkg.version)
    .description(pkg.description)
    .option(
      '-o, --output <file>',
      'Output file path for the graph image (e.g., graph.png, deps.svg)',
      'dependency-graph.png'
    )
    .option(
      '-d, --depth <number>',
      'Maximum depth of dependencies to traverse',
      (value) => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || parsed < 0) {
          throw new Error('Depth must be a non-negative number.');
        }
        return parsed;
      },
      Infinity
    )
    .option(
      '--no-dev',
      'Exclude devDependencies from the analysis'
    )
    .option(
      '-v, --verbose',
      'Enable verbose (debug) logging',
      false
    )
    .option(
      '-s, --silent',
      'Silence all log output except for the final report',
      false
    )
    .action(run);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // Commander-specific errors are often user-friendly, but we catch others.
    if (!(error instanceof Command.CommanderError)) {
      logger.error('An unexpected error occurred while parsing arguments:', error.message);
    }
    // Commander already prints its own errors, so we just exit.
    process.exit(1);
  }
}