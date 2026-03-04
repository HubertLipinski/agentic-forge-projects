/**
 * src/core/history-parser.js
 *
 * This module is responsible for reading and parsing the user's shell history
 * file. It extracts a list of recent commands, cleans them up, and removes
 * duplicates to present a clear and useful selection to the user.
 */

import { promises as fs } from 'node:fs';
import { constants as fsConstants } from 'node:fs';

/**
 * A set of common, low-value commands that should be filtered out from the history.
 * This helps to present a more relevant list of commands to the user for aliasing.
 * It includes shell built-ins, common navigation commands, and this tool's own command.
 * @type {Set<string>}
 */
const COMMAND_IGNORE_LIST = new Set([
  'ls',
  'cd',
  'cd ..',
  'pwd',
  'exit',
  'clear',
  'history',
  'quick-alias',
]);

/**
 * Cleans a raw command string from the history file.
 *
 * For Zsh history files, commands are often prefixed with metadata like
 * `: 1678886400:0;`. This function uses a regular expression to detect and
 * remove this pattern, returning only the command itself. For other shells
 * like Bash, where commands are typically on their own lines, it simply
 * trims whitespace.
 *
 * @param {string} rawLine - A single line read from a shell history file.
 * @returns {string} The cleaned command string.
 */
function cleanCommand(rawLine) {
  // Zsh history format: `: <timestamp>:<elapsed_time>;<command>`
  // Example: `: 1678886400:0;npm install`
  const zshHistoryRegex = /^: \d+:\d+;/;
  const cleanedLine = rawLine.replace(zshHistoryRegex, '').trim();
  return cleanedLine;
}

/**
 * Reads a shell history file, parses its content, and returns a list of
 * recent, unique, and clean commands.
 *
 * @param {string} historyFilePath - The absolute path to the shell history file.
 * @param {number} [limit=50] - The number of recent commands to retrieve.
 * @returns {Promise<string[]>} A promise that resolves to an array of cleaned command strings.
 *   Returns an empty array if the file cannot be read or is empty.
 */
export async function parseHistory(historyFilePath, limit = 50) {
  if (!historyFilePath) {
    console.error('Error: History file path was not provided.');
    return [];
  }

  try {
    // Check if the file exists and is readable before attempting to open it.
    await fs.access(historyFilePath, fsConstants.R_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: History file not found at "${historyFilePath}".`);
    } else if (error.code === 'EACCES') {
      console.error(`Error: Permission denied to read history file at "${historyFilePath}".`);
    } else {
      console.error(
        `An unexpected error occurred while accessing the history file:`,
        error
      );
    }
    return [];
  }

  try {
    const fileContent = await fs.readFile(historyFilePath, { encoding: 'utf-8' });
    const lines = fileContent.split('\n');

    // Use a Set to automatically handle uniqueness while preserving insertion order.
    // We process lines in reverse to get the most recent commands first.
    const uniqueRecentCommands = new Set();

    for (let i = lines.length - 1; i >= 0 && uniqueRecentCommands.size < limit; i--) {
      const line = lines[i];
      if (!line) continue; // Skip empty lines

      const command = cleanCommand(line);

      // Filter out empty, short, or ignored commands.
      if (command && command.length > 2 && !COMMAND_IGNORE_LIST.has(command)) {
        uniqueRecentCommands.add(command);
      }
    }

    // The set contains the most recent unique commands. Convert it to an array.
    // The order will be from most recent to least recent.
    return [...uniqueRecentCommands];
  } catch (error) {
    // This catches errors during readFile itself, e.g., if the file becomes
    // unreadable between the access check and the read operation.
    console.error(`Error reading or parsing history file "${historyFilePath}":`, error);
    return [];
  }
}