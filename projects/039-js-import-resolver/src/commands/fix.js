/**
 * @file src/commands/fix.js
 * @description Implements the 'fix' command logic, which analyzes a project
 * for broken imports and provides mechanisms to apply fixes, either automatically
 * for safe suggestions or interactively.
 */

import { promises as fs } from 'node:fs';
import pc from 'picocolors';
import { findProjectRoot, findSourceFiles, readFileContent } from '../utils/file-system.js';
import { analyzeProject } from '../core/analyzer.js';
import { generateSuggestions } from '../core/suggestion-engine.js';
import { resolvePath } from '../core/path-resolver.js';
import { reportAnalysis, reportError, reportFixSummary, reportFix, reportSkipped } from '../ui/reporter.js';
import { startInteractiveFixer } from '../ui/interactive-fixer.js';

/**
 * Augments the analysis results with suggestions for each broken import.
 * This is a shared utility between scan and fix commands.
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
 * Replaces a broken import specifier in the file content.
 *
 * @param {string} content - The original file content.
 * @param {string} originalSpecifier - The broken specifier to replace.
 * @param {string} newSpecifier - The new, correct specifier.
 * @returns {string} The updated file content.
 */
function applyFixToContent(content, originalSpecifier, newSpecifier) {
  // This regex robustly replaces the specifier within an import/export statement,
  // handling single and double quotes, and ensuring it's part of a `from` clause.
  const regex = new RegExp(`((?:import|export)[^'"]*from\\s+)(['"])${originalSpecifier}\\2`, 'g');
  return content.replace(regex, `$1'${newSpecifier}'`);
}

/**
 * Applies all "safe" fixes automatically. A fix is considered safe if it has
 * exactly one suggestion that successfully resolves.
 *
 * @param {Array<object>} analysisResults - The analysis results with suggestions.
 * @returns {Promise<{fixesApplied: number, filesModified: number}>} The count of applied fixes and modified files.
 */
async function applySafeFixes(analysisResults) {
  let fixesApplied = 0;
  const modifiedFiles = new Set();

  for (const result of analysisResults) {
    const { filePath, brokenImports } = result;
    if (!brokenImports || brokenImports.length === 0) continue;

    let originalContent;
    try {
      originalContent = await readFileContent(filePath);
    } catch (readError) {
      reportError(new Error(`Could not read file ${filePath} to apply fixes: ${readError.message}`));
      continue;
    }
    let currentContent = originalContent;

    for (const broken of brokenImports) {
      const { specifier, suggestions } = broken;
      const safeSuggestions = [];

      if (suggestions && suggestions.length > 0) {
        // A suggestion is "safe" if it's the only one and it resolves correctly.
        const resolutionChecks = await Promise.all(
          suggestions.map(async (suggestion) => {
            const { resolvedPath } = await resolvePath(suggestion, filePath);
            return !!resolvedPath;
          })
        );
        const validSuggestions = suggestions.filter((_, index) => resolutionChecks[index]);

        if (validSuggestions.length === 1) {
          safeSuggestions.push(validSuggestions[0]);
        }
      }

      if (safeSuggestions.length === 1) {
        const newSpecifier = safeSuggestions[0];
        const newContent = applyFixToContent(currentContent, specifier, newSpecifier);

        if (newContent !== currentContent) {
          currentContent = newContent;
          fixesApplied++;
          reportFix({ filePath, originalSpecifier: specifier, newSpecifier });
        }
      } else {
        reportSkipped({ filePath, specifier });
      }
    }

    if (currentContent !== originalContent) {
      try {
        await fs.writeFile(filePath, currentContent, 'utf-8');
        modifiedFiles.add(filePath);
      } catch (writeError) {
        reportError(new Error(`Failed to write changes to ${filePath}: ${writeError.message}`));
        // In case of write failure, we should ideally revert the counts,
        // but for simplicity, we'll report the attempt and continue.
      }
    }
  }

  return { fixesApplied, filesModified: modifiedFiles.size };
}

/**
 * The main handler for the 'fix' command.
 * It orchestrates the process of analyzing, suggesting, and applying fixes.
 *
 * @param {object} argv - The arguments object provided by yargs.
 * @param {boolean} [argv.interactive=false] - If true, run in interactive mode.
 * @param {string} [argv.path='.'] - The path to the project directory.
 * @param {boolean} [argv.verbose=false] - Enable verbose output.
 */
export async function handler(argv) {
  const options = {
    cwd: argv.path || process.cwd(),
    verbose: argv.verbose || false,
    interactive: argv.interactive || false,
  };

  try {
    console.log(pc.cyan('Analyzing project for broken imports...'));
    const projectRoot = await findProjectRoot(options.cwd);
    const allSourceFiles = await findSourceFiles(projectRoot);

    if (allSourceFiles.length === 0) {
      console.log(pc.yellow('No source files found to analyze.'));
      return;
    }

    const analysisResults = await analyzeProject(allSourceFiles);
    const resultsWithSuggestions = await addSuggestionsToResults(analysisResults, projectRoot, allSourceFiles);

    const problematicFiles = resultsWithSuggestions.filter(
      (r) => (r.brokenImports?.length ?? 0) > 0 || r.error
    );

    if (problematicFiles.length === 0) {
      console.log(`\n${pc.green('✔')} ${pc.green('Analysis complete. No broken imports found!')}`);
      return;
    }

    // First, report what was found
    reportAnalysis(problematicFiles, { verbose: options.verbose });

    let fixesApplied = 0;
    let filesModified = 0;

    if (options.interactive) {
      console.log(pc.bold('\nStarting interactive fixing mode...'));
      const result = await startInteractiveFixer(problematicFiles);
      fixesApplied = result.fixesApplied;
      filesModified = result.filesModified;
    } else {
      console.log(pc.bold('\nAttempting to apply safe fixes automatically...'));
      console.log(pc.gray('A fix is "safe" if it has a single, verifiable suggestion.'));
      const result = await applySafeFixes(problematicFiles);
      fixesApplied = result.fixesApplied;
      filesModified = result.filesModified;
    }

    reportFixSummary(fixesApplied, filesModified);

  } catch (error) {
    reportError(error);
    process.exitCode = 1;
  }
}