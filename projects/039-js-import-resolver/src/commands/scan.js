/**
 * @file src/commands/scan.js
 * @description Implements the main 'scan' command logic, which can run once
 * or in watch mode to continuously analyze a project for broken imports.
 */

import chokidar from 'chokidar';
import pc from 'picocolors';
import { findProjectRoot, findSourceFiles } from '../utils/file-system.js';
import { analyzeProject } from '../core/analyzer.js';
import { generateSuggestions } from '../core/suggestion-engine.js';
import { reportAnalysis, reportError, reportWatchMode, reportFileChange } from '../ui/reporter.js';

/**
 * Performs a single, full analysis of the project.
 * It finds all source files, analyzes them for broken imports, generates suggestions,
 * and then reports the findings to the console.
 *
 * @param {object} options - Command-line options.
 * @param {string} options.cwd - The current working directory to start the scan from.
 * @param {boolean} options.verbose - Whether to output verbose logging.
 * @returns {Promise<void>} A promise that resolves when the analysis and reporting are complete.
 */
async function runOnce(options) {
  const { cwd, verbose } = options;
  try {
    const projectRoot = await findProjectRoot(cwd);
    const allSourceFiles = await findSourceFiles(projectRoot);

    if (allSourceFiles.length === 0) {
      console.log(pc.yellow('No source files found to analyze.'));
      return;
    }

    const analysisResults = await analyzeProject(allSourceFiles);
    const resultsWithSuggestions = await addSuggestionsToResults(analysisResults, projectRoot, allSourceFiles);

    reportAnalysis(resultsWithSuggestions, { verbose });
  } catch (error) {
    reportError(error);
    process.exitCode = 1;
  }
}

/**
 * Starts a watcher that continuously monitors files for changes and re-runs
 * the analysis whenever a file is added, changed, or removed.
 *
 * @param {object} options - Command-line options.
 * @param {string} options.cwd - The current working directory.
 * @param {boolean} options.verbose - Whether to output verbose logging.
 * @returns {Promise<void>} A promise that resolves when the watcher is set up.
 * The process will continue to run until manually terminated.
 */
async function runInWatchMode(options) {
  const { cwd, verbose } = options;
  try {
    const projectRoot = await findProjectRoot(cwd);
    const patterns = ['**/*.{js,mjs,cjs}'];
    const ignore = ['**/node_modules/**', '**/dist/**', '.*'];

    const watcher = chokidar.watch(patterns, {
      cwd: projectRoot,
      ignored: ignore,
      persistent: true,
      ignoreInitial: true, // Don't fire 'add' events on initial scan
    });

    const performScan = async (changedFilePath) => {
      try {
        // Re-scan all files to correctly resolve dependencies that might have been affected
        // by the change. For example, deleting a file breaks imports in other files.
        const allSourceFiles = await findSourceFiles(projectRoot);
        const analysisResults = await analyzeProject(allSourceFiles);
        const resultsWithSuggestions = await addSuggestionsToResults(analysisResults, projectRoot, allSourceFiles);
        reportAnalysis(resultsWithSuggestions, { verbose });
      } catch (error) {
        reportError(error);
      }
    };

    // Perform an initial scan before starting to watch
    reportWatchMode('Performing initial project scan...');
    await performScan();

    watcher
      .on('add', path => {
        reportFileChange('add', path);
        performScan(path);
      })
      .on('change', path => {
        reportFileChange('change', path);
        performScan(path);
      })
      .on('unlink', path => {
        reportFileChange('unlink', path);
        performScan(path);
      })
      .on('error', error => {
        reportError(new Error(`Watcher error: ${error.message}`));
      });

  } catch (error) {
    reportError(error);
    process.exitCode = 1;
  }
}

/**
 * Augments the analysis results with suggestions for each broken import.
 *
 * @param {Array<object>} analysisResults - The raw results from the analyzer.
 * @param {string} projectRoot - The absolute path to the project root.
 * @param {string[]} allSourceFiles - A list of all source files in the project.
 * @returns {Promise<Array<object>>} A new array of results with a `suggestions`
 * property added to each broken import.
 */
async function addSuggestionsToResults(analysisResults, projectRoot, allSourceFiles) {
  const suggestionPromises = analysisResults.map(async (fileResult) => {
    if (!fileResult.brokenImports || fileResult.brokenImports.length === 0) {
      return fileResult;
    }

    const brokenImportsWithSuggestions = await Promise.all(
      fileResult.brokenImports.map(async (brokenImport) => {
        const suggestions = await generateSuggestions({
          specifier: brokenImport.specifier,
          importer: fileResult.filePath,
          projectRoot,
          allSourceFiles,
        });
        return { ...brokenImport, suggestions };
      })
    );

    return { ...fileResult, brokenImports: brokenImportsWithSuggestions };
  });

  return Promise.all(suggestionPromises);
}

/**
 * The handler for the 'scan' command. It determines whether to run the analysis
 * once or in watch mode based on the provided options.
 *
 * @param {object} argv - The arguments object provided by yargs.
 * @param {boolean} argv.watch - If true, run in watch mode.
 * @param {string} [argv.path='.'] - The path to the project directory.
 * @param {boolean} [argv.verbose=false] - Enable verbose output.
 * @returns {Promise<void>}
 */
export async function handler(argv) {
  const options = {
    cwd: argv.path || process.cwd(),
    verbose: argv.verbose || false,
  };

  if (argv.watch) {
    await runInWatchMode(options);
  } else {
    await runOnce(options);
  }
}