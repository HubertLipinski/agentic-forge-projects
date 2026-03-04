/**
 * src/ui/prompts.js
 *
 * This module centralizes all user-facing interactive prompts using the 'enquirer'
 * library. It provides a clean, testable, and maintainable interface for gathering
 * user input, such as selecting a command from history, confirming an alias name,
 * and giving final approval before writing to a file.
 */

import { prompt } from 'enquirer';

/**
 * Generates a sensible default alias name from a full command string.
 * It takes the first word of the command and the first letter of subsequent
 * words/flags to create a short, mnemonic alias.
 *
 * @param {string} command - The full command string (e.g., "git status --short").
 * @returns {string} A suggested alias name (e.g., "gss").
 *
 * @example
 * suggestAliasName("npm run dev"); // "nrd"
 * suggestAliasName("git commit -m"); // "gcm"
 * suggestAliasName("docker-compose up -d"); // "dcu-d" (handles hyphens)
 */
function suggestAliasName(command) {
  if (!command || typeof command !== 'string') {
    return '';
  }

  // Split the command by spaces, but keep hyphenated parts together.
  const parts = command.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') {
    return '';
  }

  // The first part is the base command (e.g., 'git', 'npm').
  const firstWord = parts[0];
  // The rest are arguments or flags.
  const subsequentParts = parts.slice(1);

  // Take the first letter of each subsequent part.
  const initials = subsequentParts
    .map(part => part.charAt(0))
    .join('');

  // Combine them to form the suggestion.
  return `${firstWord[0]}${initials}`.toLowerCase();
}

/**
 * Prompts the user to select a command from their recent history.
 *
 * @param {string[]} commands - An array of recent command strings to display.
 * @returns {Promise<string|null>} A promise that resolves to the selected command string,
 *   or null if the user cancels the prompt (e.g., with Ctrl+C).
 */
export async function promptForCommand(commands) {
  if (!commands || commands.length === 0) {
    console.log('No recent commands found to create an alias from.');
    return null;
  }

  try {
    const { command } = await prompt({
      type: 'autocomplete',
      name: 'command',
      message: 'Select a recent command to alias:',
      limit: 15, // Show up to 15 choices at once
      choices: commands,
      footer: 'Use ↑/↓ to navigate, type to filter, Enter to select',
    });
    return command;
  } catch (error) {
    // Enquirer throws an empty error object on cancellation (Ctrl+C).
    // We interpret this as a graceful exit request from the user.
    console.log('\nOperation cancelled by user.');
    return null;
  }
}

/**
 * Prompts the user to enter or confirm a name for the new alias.
 * It suggests a default name based on the selected command.
 *
 * @param {string} command - The command for which an alias is being created.
 * @returns {Promise<string|null>} A promise that resolves to the chosen alias name,
 *   or null if the user cancels the prompt.
 */
export async function promptForAliasName(command) {
  const suggestedName = suggestAliasName(command);

  try {
    const { aliasName } = await prompt({
      type: 'input',
      name: 'aliasName',
      message: 'What should the alias be named?',
      initial: suggestedName,
      validate(value) {
        // Basic validation to prevent empty or space-filled names.
        if (!value.trim()) {
          return 'Alias name cannot be empty.';
        }
        // Shells can be particular about characters in alias names.
        // This regex allows alphanumeric characters, hyphens, and underscores.
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          return 'Alias name can only contain letters, numbers, hyphens, and underscores.';
        }
        return true;
      },
    });
    return aliasName.trim();
  } catch (error) {
    console.log('\nOperation cancelled by user.');
    return null;
  }
}

/**
 * Asks the user for final confirmation before writing the alias to their config file.
 *
 * @param {string} aliasName - The name of the alias.
 * @param {string} command - The command the alias will execute.
 * @param {string} configFilePath - The path to the shell configuration file.
 * @returns {Promise<boolean>} A promise that resolves to `true` if the user confirms,
 *   `false` otherwise (including cancellation).
 */
export async function promptForConfirmation(aliasName, command, configFilePath) {
  try {
    const { confirmed } = await prompt({
      type: 'confirm',
      name: 'confirmed',
      message: `Create alias "${aliasName}" for command "${command}" in ${configFilePath}?`,
      initial: true, // Default to 'Yes'
    });
    return confirmed;
  } catch (error) {
    console.log('\nOperation cancelled by user.');
    return false;
  }
}