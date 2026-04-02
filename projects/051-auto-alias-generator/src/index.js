/**
 * @fileoverview The main entry point for the Auto Alias Generator application.
 * This module orchestrates the entire workflow, from reading configuration and
 * shell history to presenting the final alias suggestions to the user.
 * It ties together all the core components of the application.
 */

import chalk from 'chalk';
import path from 'node:path';
import { findHistoryFile, readHistoryFile } from '../utils/file-reader.js';
import { parseHistory } from '../core/command-parser.js';
import { suggestAliases } from '../core/alias-suggester.js';
import { promptUserForSelection } from '../ui/interactive-prompts.js';
import { printFormattedOutput } from '../ui/output-formatter.js';
import { DEFAULT_CONFIG, DEFAULT_EXCLUSIONS } from '../utils/constants.js';

/**
 * Determines the shell type based on the history file path.
 * This is a simple heuristic that checks the filename.
 *
 * @param {string} filePath - The absolute path to the history file.
 * @returns {string} The inferred shell type ('zsh', 'bash', 'fish', or 'unknown').
 */
function detectShellType(filePath) {
  const fileName = path.basename(filePath);
  if (fileName.includes('zsh')) return 'zsh';
  if (fileName.includes('bash')) return 'bash';
  if (fileName.includes('fish')) return 'fish';
  return 'unknown';
}

/**
 * The main orchestration function for the auto-alias generator.
 * It executes the following steps:
 * 1. Finds and reads the appropriate shell history file.
 * 2. Parses the history to find frequent commands.
 * 3. Generates alias suggestions for those commands.
 * 4. Interactively prompts the user to select which aliases to keep.
 * 5. Prints the final, formatted list of aliases to the console.
 *
 * @param {object} options - The configuration options, usually from command-line arguments.
 * @param {number} [options.limit=DEFAULT_CONFIG.limit] - Number of history lines to scan.
 * @param {number} [options.minFrequency=DEFAULT_CONFIG.minFrequency] - Minimum command frequency to consider.
 * @param {number} [options.aliasLength=DEFAULT_CONFIG.aliasLength] - Preferred length for aliases.
 * @param {number} [options.numSuggestions=DEFAULT_CONFIG.numSuggestions] - Number of suggestions to show.
 * @param {string} [options.filePath] - Explicit path to a history file.
 * @param {boolean} [options.nonInteractive=false] - If true, skips the interactive prompt.
 * @returns {Promise<void>} A promise that resolves when the process is complete.
 */
export async function run(options = {}) {
  // Merge user-provided options with defaults for a complete config object.
  const config = { ...DEFAULT_CONFIG, ...options };

  console.log(chalk.bold.cyan('🚀 Starting Auto Alias Generator...'));

  // --- 1. Find and Read History File ---
  const historyFilePath = config.filePath ?? (await findHistoryFile());
  if (!historyFilePath) {
    throw new Error(
      'Could not find a shell history file (.zsh_history, .bash_history, .fish_history).\n' +
      'Please specify the path using the --file-path option.'
    );
  }
  console.log(chalk.dim(`🔍 Scanning history file: ${historyFilePath}`));
  const shellType = detectShellType(historyFilePath);
  const historyLines = await readHistoryFile(historyFilePath, config.limit);

  // --- 2. Parse Commands ---
  const frequentCommands = parseHistory({
    historyLines,
    shellType,
    minFrequency: config.minFrequency,
    exclusions: DEFAULT_EXCLUSIONS,
  });

  if (frequentCommands.length === 0) {
    console.log(chalk.yellow('\nNo frequent commands found that meet the criteria. Try adjusting the --limit or --min-frequency options.'));
    return;
  }

  // --- 3. Suggest Aliases ---
  const allSuggestions = suggestAliases({
    frequentCommands,
    aliasLength: config.aliasLength,
    exclusions: DEFAULT_EXCLUSIONS,
  });

  // Limit the number of suggestions presented to the user.
  const topSuggestions = allSuggestions.slice(0, config.numSuggestions);

  if (topSuggestions.length === 0) {
    console.log(chalk.green('\nFound frequent commands, but no suitable aliases could be generated. Your setup might be unique!'));
    return;
  }

  // --- 4. User Interaction ---
  let selectedAliases;
  if (config.nonInteractive) {
    console.log(chalk.yellow('\nRunning in non-interactive mode. All suggestions will be printed.'));
    selectedAliases = topSuggestions;
  } else {
    selectedAliases = await promptUserForSelection(topSuggestions);
  }

  // --- 5. Format and Print Output ---
  // The prompt returns an empty array on cancellation, leading to a graceful exit message.
  if (selectedAliases.length > 0) {
    printFormattedOutput({ selectedAliases, shellType });
  } else {
    // This message covers both cancellation and de-selecting all options.
    console.log(chalk.yellow('\nNo aliases were selected. Exiting.'));
  }
}