/**
 * @file src/ui/interactive-fixer.js
 * @description Handles the interactive command-line prompt for applying fixes,
 * allowing the user to accept or reject suggestions one by one.
 */

import { promises as fs } from 'node:fs';
import readline from 'node:readline';
import pc from 'picocolors';
import { readFileContent } from '../utils/file-system.js';
import { reportFix, reportSkipped } from './reporter.js';

/**
 * A collection of symbols used for formatting the interactive prompt.
 * @type {object}
 */
const SYMBOLS = {
  question: pc.yellow('?'),
  arrow: pc.gray('→'),
};

/**
 * Creates and configures a readline interface for user interaction.
 * @returns {readline.Interface} The configured readline interface.
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Asynchronously asks the user a question and returns their input.
 *
 * @param {readline.Interface} rl - The readline interface instance.
 * @param {string} query - The question to display to the user.
 * @returns {Promise<string>} A promise that resolves with the user's trimmed input.
 */
function askQuestion(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => resolve(answer.trim().toLowerCase()));
  });
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
  // Use a regex to robustly replace the specifier, handling both single and double quotes.
  // This avoids accidentally replacing the specifier if it appears elsewhere in the code as a string.
  const regex = new RegExp(`(from\\s+)(['"])${originalSpecifier}(['"])`, 'g');
  return content.replace(regex, `$1$2${newSpecifier}$3`);
}

/**
 * Presents the user with a single broken import and its suggestions,
 * and prompts them to choose a fix.
 *
 * @param {readline.Interface} rl - The readline interface instance.
 * @param {object} brokenImport - The broken import details.
 * @param {string} brokenImport.specifier - The original broken specifier.
 * @param {string[]} brokenImport.suggestions - A list of suggested fixes.
 * @param {string} filePath - The path of the file containing the broken import.
 * @returns {Promise<string | null>} The chosen suggestion, or null if the user skips.
 */
async function promptForFix(rl, brokenImport, filePath) {
  const { specifier, suggestions } = brokenImport;

  console.log(`\nIn file ${pc.underline(filePath)}:`);
  console.log(`  Broken import: ${pc.red(`'${specifier}'`)}`);

  if (!suggestions || suggestions.length === 0) {
    console.log(pc.yellow('  No suggestions available for this import.'));
    return null;
  }

  console.log(pc.cyan('  Please choose a fix from the options below:'));
  suggestions.forEach((suggestion, index) => {
    console.log(`    ${pc.bold(index + 1)}: ${suggestion}`);
  });
  console.log(`    ${pc.bold('s')}: Skip this fix`);
  console.log(`    ${pc.bold('q')}: Quit interactive mode`);

  while (true) {
    const query = `${SYMBOLS.question} Your choice (1-${suggestions.length}, s, q): `;
    const answer = await askQuestion(rl, query);

    if (answer === 'q' || answer === 'quit') {
      return 'quit';
    }
    if (answer === 's' || answer === 'skip') {
      return null; // Skip this fix
    }

    const choiceIndex = parseInt(answer, 10) - 1;
    if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < suggestions.length) {
      return suggestions[choiceIndex];
    }

    console.log(pc.red('Invalid choice. Please try again.'));
  }
}

/**
 * Main function to start the interactive fixing process.
 * It iterates through each broken import, prompts the user, and applies chosen fixes.
 *
 * @param {Array<object>} analysisResults - The results from the project analysis,
 *   where each object contains `filePath`, `brokenImports`, and `suggestions`.
 * @returns {Promise<{fixesApplied: number, filesModified: number}>} A promise that resolves with the count of applied fixes and modified files.
 */
export async function startInteractiveFixer(analysisResults) {
  let fixesApplied = 0;
  const modifiedFiles = new Set();
  const rl = createInterface();

  try {
    for (const result of analysisResults) {
      const { filePath, brokenImports } = result;

      if (!brokenImports || brokenImports.length === 0) {
        continue;
      }

      // Read file content once per file
      let originalContent;
      try {
        originalContent = await readFileContent(filePath);
      } catch (readError) {
        console.error(pc.red(`\nError reading file ${filePath}: ${readError.message}`));
        continue; // Skip to the next file
      }
      let currentContent = originalContent;

      for (const broken of brokenImports) {
        const chosenFix = await promptForFix(rl, broken, filePath);

        if (chosenFix === 'quit') {
          console.log('\nQuitting interactive mode.');
          // Before quitting, write any pending changes for the current file
          if (currentContent !== originalContent) {
            await fs.writeFile(filePath, currentContent, 'utf-8');
            modifiedFiles.add(filePath);
          }
          return { fixesApplied, filesModified: modifiedFiles.size };
        }

        if (chosenFix) {
          const newContent = applyFixToContent(currentContent, broken.specifier, chosenFix);
          if (newContent !== currentContent) {
            currentContent = newContent;
            fixesApplied++;
            reportFix({
              filePath,
              originalSpecifier: broken.specifier,
              newSpecifier: chosenFix,
            });
          } else {
            // This can happen if the regex fails to match, which is unlikely but good to handle.
            console.log(pc.yellow(`Could not apply fix for '${broken.specifier}' automatically. Please fix manually.`));
          }
        } else {
          reportSkipped({ filePath, specifier: broken.specifier });
        }
      }

      // After processing all broken imports for a file, write changes if any.
      if (currentContent !== originalContent) {
        try {
          await fs.writeFile(filePath, currentContent, 'utf-8');
          modifiedFiles.add(filePath);
        } catch (writeError) {
          console.error(pc.red(`\nFailed to write changes to ${filePath}: ${writeError.message}`));
          // Revert in-memory count if write fails
          // Note: This is a simplification; a more robust solution might track per-fix status.
          fixesApplied -= brokenImports.filter(b => b.chosenFix).length;
        }
      }
    }
  } finally {
    rl.close();
  }

  return { fixesApplied, filesModified: modifiedFiles.size };
}