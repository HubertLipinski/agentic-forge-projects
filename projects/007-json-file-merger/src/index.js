import { promises as fs } from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import chokidar from 'chokidar';
import { parseCliArgs } from './cli.js';
import logger from './utils/logger.js';
import { readAndParseFiles } from './utils/file-reader.js';
import { mergeObjects } from './merge.js';

/**
 * @file Main executable script. Orchestrates the process: gets file paths from
 * CLI, uses file-reader, passes data to merge, and writes the final output.
 */

/**
 * Resolves glob patterns into a flat list of unique file paths.
 *
 * @param {string[]} patterns - An array of glob patterns.
 * @returns {Promise<string[]>} A promise that resolves to an array of file paths.
 */
async function resolveFilePaths(patterns) {
  logger.verbose(`Resolving glob patterns: ${patterns.join(', ')}`);
  const fileLists = await Promise.all(patterns.map(pattern => glob(pattern, { nodir: true })));
  // Flatten the array of arrays and remove duplicates
  const uniquePaths = [...new Set(fileLists.flat())];
  logger.info(`Found ${uniquePaths.length} unique file(s) to merge.`);
  logger.verbose(`Files to be merged (in order):\n${uniquePaths.map(p => `  - ${p}`).join('\n')}`);
  return uniquePaths;
}

/**
 * Writes the merged data to the specified output file or to stdout.
 *
 * @param {object} data - The merged JavaScript object.
 * @param {string|undefined} outputPath - The path to the output file. If undefined, writes to stdout.
 * @param {number} indent - The number of spaces to use for pretty-printing.
 * @returns {Promise<void>}
 */
async function writeOutput(data, outputPath, indent) {
  const jsonString = JSON.stringify(data, null, indent);

  if (outputPath) {
    try {
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputPath, jsonString, 'utf-8');
      logger.success(`Successfully merged files into: ${outputPath}`);
    } catch (err) {
      logger.error(`Failed to write output file at: ${outputPath}`, err);
      process.exit(1);
    }
  } else {
    // If no output path, print to stdout.
    process.stdout.write(jsonString + '\n');
    logger.verbose('Output written to stdout.');
  }
}

/**
 * The core logic for a single merge operation.
 * Reads, parses, merges, and writes files based on the provided configuration.
 *
 * @param {object} config - The configuration object from CLI arguments.
 * @param {string[]} config.inputs - Glob patterns for input files.
 * @param {string} [config.output] - Path to the output file.
 * @param {string} config.arrayMerge - The array merging strategy.
 * @param {number} config.prettyPrint - The indentation level for the output.
 * @returns {Promise<void>}
 */
export async function runMerge(config) {
  try {
    const filePaths = await resolveFilePaths(config.inputs);

    if (filePaths.length === 0) {
      logger.warn('No input files matched the provided patterns. Nothing to merge.');
      return;
    }

    const objectsToMerge = await readAndParseFiles(filePaths);

    if (objectsToMerge.length === 0) {
      logger.warn('No valid JSON objects could be parsed from input files. Output will be empty.');
      await writeOutput({}, config.output, config.prettyPrint);
      return;
    }

    const mergedData = mergeObjects(objectsToMerge, {
      arrayMerge: config.arrayMerge,
    });

    await writeOutput(mergedData, config.output, config.prettyPrint);
  } catch (err) {
    logger.error('An unexpected error occurred during the merge process.', err);
    // In non-watch mode, a fatal error should exit the process.
    if (!config.watch) {
      process.exit(1);
    }
  }
}

/**
 * Initializes and manages the file watcher.
 *
 * @param {object} config - The configuration object from CLI arguments.
 */
function startWatcher(config) {
  logger.info(`Watch mode enabled. Watching for changes in: ${config.inputs.join(', ')}`);

  const watcher = chokidar.watch(config.inputs, {
    ignored: config.output ? path.resolve(config.output) : undefined,
    ignoreInitial: true, // Don't run on initial file discovery
    persistent: true,
  });

  const handleFileChange = async (event, changedPath) => {
    logger.info(`'${event}' event detected for: ${changedPath}`);
    logger.info('Re-merging files...');
    await runMerge(config);
  };

  watcher
    .on('add', (p) => handleFileChange('add', p))
    .on('change', (p) => handleFileChange('change', p))
    .on('unlink', (p) => handleFileChange('unlink', p))
    .on('error', (err) => logger.error('Watcher error:', err));

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Stopping watcher...');
    watcher.close().then(() => process.exit(0));
  });
}

/**
 * The main entry point for the application.
 * Parses CLI arguments and orchestrates the merge or watch process.
 */
async function main() {
  try {
    const config = await parseCliArgs(process.argv);

    // Set logger verbosity based on CLI flag
    logger.setVerbose(config.verbose);

    // Perform the initial merge
    await runMerge(config);

    // If watch mode is enabled, set up the watcher
    if (config.watch) {
      startWatcher(config);
    }
  } catch (err) {
    // This catches errors during argument parsing or other unhandled exceptions.
    // parseCliArgs has its own failure handler, so this is a fallback.
    logger.error('A critical error occurred.', err);
    process.exit(1);
  }
}

// Execute the main function. This structure allows `runMerge` to be
// imported and used programmatically without triggering the CLI execution.
main();