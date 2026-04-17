/**
 * @file src/cli.js
 * @description The main CLI entry point for the Cyclic Import Detective tool.
 *
 * This file uses `yargs` to parse command-line arguments, orchestrates the
 * analysis workflow (building the graph, detecting cycles), and invokes the
 * appropriate reporter based on user configuration.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { glob } from 'glob';
import path from 'node:path';
import chalk from 'chalk';
import { buildGraph } from '../graph/dependency-graph-builder.js';
import { detectCycles } from '../analysis/cycle-detector.js';
import { generateConsoleReport } from '../reporters/console-reporter.js';
import { generateJsonReport } from '../reporters/json-reporter.js';
import { generateGraphReport } from '../reporters/graph-reporter.js';
import logger, { LOG_LEVELS } from '../utils/logger.js';
import { REPORT_FORMATS, DEFAULT_CONFIG } from '../constants.js';
import * as fileCache from '../utils/file-cache.js';

/**
 * @typedef {import('graphology').Graph} DependencyGraph
 * @typedef {string[]} Cycle
 */

/**
 * @typedef {object} AnalysisResult
 * @property {Cycle[]} cycles - An array of detected cycles.
 * @property {DependencyGraph} graph - The complete dependency graph.
 */

/**
 * Defines and configures the CLI arguments using yargs.
 * @returns {import('yargs').Argv} The configured yargs instance.
 */
function setupCli() {
  return yargs(hideBin(process.argv))
    .usage(
      chalk.bold.cyan(
        '🌀 cyclic-import-detective <entry...>'
      )
    )
    .command(
      '$0 <entry...>',
      'Detect circular dependencies in a Node.js project',
      (y) => {
        y.positional('entry', {
          describe: 'One or more entry files or glob patterns to analyze',
          type: 'string',
        });
      }
    )
    .options({
      'output-format': {
        alias: 'o',
        describe: 'The format for the output report.',
        choices: Object.values(REPORT_FORMATS),
        default: DEFAULT_CONFIG.OUTPUT_FORMAT,
        type: 'string',
      },
      'output-file': {
        alias: 'f',
        describe: 'File path to write the report to (for json, graphml, gexf formats).',
        type: 'string',
        normalize: true,
      },
      exclude: {
        alias: 'e',
        describe: 'Glob patterns for files/directories to exclude from analysis.',
        type: 'array',
        default: DEFAULT_CONFIG.EXCLUDE,
      },
      'base-dir': {
        alias: 'b',
        describe: 'Base directory for resolving paths and making report paths relative.',
        type: 'string',
        default: process.cwd(),
        normalize: true,
      },
      'log-level': {
        describe: 'Set the verbosity of the output.',
        choices: Object.keys(LOG_LEVELS),
        default: DEFAULT_CONFIG.LOG_LEVEL,
        type: 'string',
      },
      'no-cache': {
        describe: 'Disable caching of parsed file ASTs.',
        type: 'boolean',
        default: false,
      },
      'clear-cache': {
        describe: 'Clear the cache directory and exit.',
        type: 'boolean',
        default: false,
      },
    })
    .example([
      ['$0 "src/**/*.js"', 'Analyze all JS files in the src directory'],
      ['$0 index.js -o json -f report.json', 'Generate a JSON report for the entry point index.js'],
      ['$0 app.ts --exclude "**/__tests__/**"', 'Exclude test files from the analysis'],
    ])
    .help()
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .epilogue(
      `For more information, visit ${chalk.underline(
        'https://github.com/your-username/cyclic-import-detective'
      )}`
    )
    .fail((msg, err, yargsInstance) => {
      // Custom failure handler for better error messages
      if (err) {
        logger.error('An unexpected error occurred:', err.message);
        if (process.env.NODE_ENV === 'development') {
          console.error(err.stack);
        }
      } else {
        logger.error(chalk.red.bold('Error:'), msg);
        console.error('\n' + yargsInstance.help());
      }
      process.exit(1);
    });
}

/**
 * Resolves entry glob patterns into a flat list of absolute file paths.
 * @param {string[]} patterns - An array of glob patterns.
 * @param {string} baseDir - The base directory to resolve paths from.
 * @returns {Promise<string[]>} A promise that resolves to an array of unique, absolute file paths.
 */
async function resolveEntryFiles(patterns, baseDir) {
  logger.info('Resolving entry files...');
  const allFiles = new Set();

  const globPromises = patterns.map(pattern =>
    glob(pattern, {
      cwd: baseDir,
      absolute: true,
      nodir: true, // We only want files
      ignore: ['**/node_modules/**'], // Always ignore node_modules at the glob level
    })
  );

  const fileArrays = await Promise.all(globPromises);
  fileArrays.flat().forEach(file => allFiles.add(path.normalize(file)));

  const resolvedFiles = Array.from(allFiles);
  logger.debug(`Found ${resolvedFiles.length} entry files from patterns.`);
  return resolvedFiles;
}

/**
 * Runs the main analysis pipeline: build graph, detect cycles, and generate report.
 * @param {object} argv - The parsed command-line arguments from yargs.
 * @returns {Promise<void>}
 */
export async function runAnalysis(argv) {
  logger.setLevel(argv.logLevel);

  if (argv.clearCache) {
    await fileCache.clear();
    return;
  }

  if (argv.noCache) {
    logger.setEnabled(false); // Disable file cache logger
  }

  const entryFiles = await resolveEntryFiles(argv.entry, argv.baseDir);
  if (entryFiles.length === 0) {
    logger.warn('No entry files found matching the provided patterns. Nothing to analyze.');
    return;
  }

  const graph = await buildGraph(entryFiles, { exclude: argv.exclude });
  const cycles = detectCycles(graph);

  /** @type {AnalysisResult} */
  const analysisResult = { cycles, graph };

  switch (argv.outputFormat) {
    case REPORT_FORMATS.JSON:
      await generateJsonReport(analysisResult, {
        baseDir: argv.baseDir,
        outputFile: argv.outputFile,
      });
      break;

    case REPORT_FORMATS.GRAPHML:
    case REPORT_FORMATS.GEXF:
      await generateGraphReport(analysisResult, {
        baseDir: argv.baseDir,
        outputFile: argv.outputFile,
        format: argv.outputFormat,
      });
      break;

    case REPORT_FORMATS.CONSOLE:
    default:
      await generateConsoleReport(analysisResult, { baseDir: argv.baseDir });
      break;
  }

  // Exit with a non-zero code if cycles were found, useful for CI/CD
  if (cycles.length > 0) {
    process.exitCode = 1;
  }
}

/**
 * The main function that bootstraps and runs the CLI application.
 * It handles argument parsing and top-level error handling.
 */
export async function main() {
  try {
    const cli = setupCli();
    const argv = await cli.parse();
    await runAnalysis(argv);
  } catch (error) {
    logger.error('A critical error occurred during execution:');
    logger.error(error);
    process.exit(1);
  }
}