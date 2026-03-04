/**
 * src/utils/config-mapper.js
 *
 * This module maps a detected shell name to its specific configuration,
 * including the path to its history file, its main configuration file,
 * and the correct syntax for defining an alias.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * A centralized map holding configuration details for each supported shell.
 * This structure makes it easy to add support for new shells in the future.
 *
 * Each shell configuration includes:
 * - `historyFile`: The typical path to the shell's command history file.
 * - `configFile`: The primary configuration file where aliases are stored.
 * - `aliasFormat`: A function that takes an alias name and a command and returns
 *   a correctly formatted alias definition string for that shell.
 *
 * The paths use `join(homedir(), ...)` to be platform-agnostic and correctly
 * resolve the user's home directory.
 *
 * @type {Object<string, {historyFile: string, configFile: string, aliasFormat: function(string, string): string}>}
 */
const SHELL_CONFIG_MAP = {
  bash: {
    historyFile: join(homedir(), '.bash_history'),
    configFile: join(homedir(), '.bashrc'),
    aliasFormat: (name, command) => `alias ${name}='${command}'`,
  },
  zsh: {
    historyFile: join(homedir(), '.zsh_history'),
    configFile: join(homedir(), '.zshrc'),
    aliasFormat: (name, command) => `alias ${name}='${command}'`,
  },
  fish: {
    historyFile: join(homedir(), '.local', 'share', 'fish', 'fish_history'),
    configFile: join(homedir(), '.config', 'fish', 'config.fish'),
    aliasFormat: (name, command) => `alias ${name} '${command}'`,
  },
};

/**
 * Retrieves the configuration object for a given shell.
 *
 * This function acts as a safe interface to the `SHELL_CONFIG_MAP`. It takes a
 * shell name (e.g., 'zsh') and returns its associated configuration object,
 * which includes paths to history and config files, and the alias formatting function.
 *
 * @param {string | null} shellName The name of the shell (e.g., 'bash', 'zsh', 'fish').
 *   It can be null if the shell detection failed.
 * @returns {Promise<{historyFile: string, configFile: string, aliasFormat: function(string, string): string} | null>}
 *   A promise that resolves to the configuration object for the specified shell,
 *   or null if the shell is not supported or the input is invalid.
 */
export async function getShellConfig(shellName) {
  // This is an async function for consistency with other modules, even though
  // the current implementation is synchronous. It allows for future enhancements,
  // such as dynamically locating config files if they are not in standard locations.
  if (!shellName || typeof shellName !== 'string') {
    console.error('Error: Invalid or no shell name provided to getShellConfig.');
    return null;
  }

  const config = SHELL_CONFIG_MAP[shellName];

  if (!config) {
    console.error(`Error: No configuration found for shell "${shellName}".`);
    return null;
  }

  // Return a structured clone to prevent any accidental mutation of the
  // original configuration map by downstream consumers. This is a best practice
  // for returning shared configuration objects.
  return structuredClone(config);
}