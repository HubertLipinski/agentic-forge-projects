/**
 * src/commands/create-alias.js
 *
 * This file contains the main command logic for the `quick-alias` CLI tool.
 * It orchestrates the entire process of creating a shell alias, from detecting
 * the environment and parsing history to interacting with the user and writing
 * to the configuration file.
 */

import { detectShell } from '../utils/shell-detector.js';
import { getShellConfig } from '../utils/config-mapper.js';
import { parseHistory } from '../core/history-parser.js';
import { writeAlias } from '../core/alias-writer.js';
import {
  promptForCommand,
  promptForAliasName,
  promptForConfirmation,
} from '../ui/prompts.js';

/**
 * The main handler for the `create-alias` command.
 * This function orchestrates the entire workflow of creating a shell alias.
 *
 * @param {object} argv - The arguments object provided by yargs.
 * @param {boolean} [argv.dryRun=false] - If true, performs a dry run without writing to any files.
 * @param {number} [argv.limit=50] - The number of recent history commands to fetch.
 * @returns {Promise<void>} A promise that resolves when the command has finished executing.
 */
export async function createAliasCommandHandler(argv) {
  const { dryRun = false, limit = 50 } = argv;

  // 1. Detect Shell and get its configuration
  const shellName = await detectShell();
  if (!shellName) {
    console.error('❌ Aborting: Could not determine a supported shell.');
    process.exitCode = 1;
    return;
  }
  console.log(`✅ Detected shell: ${shellName}`);

  const shellConfig = await getShellConfig(shellName);
  if (!shellConfig) {
    console.error(`❌ Aborting: Could not find configuration for "${shellName}".`);
    process.exitCode = 1;
    return;
  }

  // 2. Parse Shell History
  const recentCommands = await parseHistory(shellConfig.historyFile, limit);
  if (recentCommands.length === 0) {
    console.log('No suitable recent commands found in your history file.');
    return;
  }

  // 3. Prompt user to select a command
  const selectedCommand = await promptForCommand(recentCommands);
  if (!selectedCommand) {
    // User cancelled the prompt (e.g., Ctrl+C)
    return;
  }

  // 4. Prompt user for the alias name
  const aliasName = await promptForAliasName(selectedCommand);
  if (!aliasName) {
    // User cancelled the prompt
    return;
  }

  // 5. Final Confirmation (unless in dry-run mode)
  if (!dryRun) {
    const isConfirmed = await promptForConfirmation(
      aliasName,
      selectedCommand,
      shellConfig.configFile
    );
    if (!isConfirmed) {
      console.log('Operation cancelled. No changes were made.');
      return;
    }
  }

  // 6. Write the alias to the config file (or print for dry-run)
  const success = await writeAlias({
    aliasName,
    command: selectedCommand,
    configFilePath: shellConfig.configFile,
    aliasFormatFn: shellConfig.aliasFormat,
    dryRun,
  });

  if (!success) {
    // Set exit code to indicate failure if writing was unsuccessful.
    process.exitCode = 1;
  }
}