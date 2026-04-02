import { DEFAULT_EXCLUSIONS } from '../utils/constants.js';

/**
 * @fileoverview Parses raw lines from a history file, cleans them,
 * and counts the frequency of each unique command. This module is responsible
 * for transforming raw history data into a structured format suitable for analysis.
 */

/**
 * Cleans a single command line from a Zsh history file.
 * Zsh history format: `: <timestamp>:<duration>;<command>`
 * Example: `: 1678886400:0;git status` -> `git status`
 * It also handles multi-line commands by removing trailing backslashes.
 *
 * @param {string} line - The raw line from a .zsh_history file.
 * @returns {string} The cleaned command, or an empty string if invalid.
 */
function cleanZshHistoryLine(line) {
  // Regex to capture the command part after the timestamp and duration.
  // `^: \d{10,}:\d+;` matches the start of the line, timestamp, and semicolon.
  // `(.*)` captures the actual command.
  const match = line.match(/^: \d{10,}:\d+;(.*)/);
  const command = match ? match[1] : line;

  // Zsh escapes newlines in multi-line commands with a backslash.
  // We remove it to treat the command as a single logical unit.
  return command.trim().replace(/\\$/, '').trim();
}

/**
 * Cleans a single command line from a Fish history file.
 * Fish history format (YAML-like):
 * - cmd: <command>
 *   when: <timestamp>
 * This function extracts the command from the `cmd:` line.
 *
 * @param {string} line - The raw line from a fish_history file.
 * @returns {string} The cleaned command, or an empty string if not a command line.
 */
function cleanFishHistoryLine(line) {
  const trimmedLine = line.trim();
  // Fish history command lines start with `- cmd: `.
  if (trimmedLine.startsWith('- cmd: ')) {
    return trimmedLine.substring('- cmd: '.length);
  }
  // Other lines (like 'when:') are ignored.
  return '';
}

/**
 * Cleans a single command line, dispatching to the appropriate shell-specific cleaner.
 * Bash history has no special formatting, so it's treated as the default.
 *
 * @param {string} line - The raw history line.
 * @param {string} shellType - The shell type ('zsh', 'bash', 'fish').
 * @returns {string} The cleaned command.
 */
function cleanCommand(line, shellType) {
  if (shellType === 'zsh') {
    return cleanZshHistoryLine(line);
  }
  if (shellType === 'fish') {
    return cleanFishHistoryLine(line);
  }
  // Bash and other simple history files have one command per line.
  return line.trim();
}

/**
 * Validates if a command is a good candidate for aliasing.
 * It filters out empty, short, or excluded commands.
 *
 * @param {string} command - The command to validate.
 * @param {Set<string>} exclusions - A set of commands to ignore.
 * @returns {boolean} True if the command is a valid candidate, false otherwise.
 */
function isValidCommand(command, exclusions) {
  if (!command || command.length < 3) {
    // Ignore empty or very short commands (e.g., 'l', 'g').
    return false;
  }

  // Split the command to check the base command against the exclusion list.
  // e.g., 'git status' -> 'git'
  const baseCommand = command.split(' ')[0];
  if (exclusions.has(baseCommand)) {
    return false;
  }

  // Exclude commands that start with special characters or are likely shell syntax.
  const invalidStarters = /^[.&[({]/;
  if (invalidStarters.test(command)) {
    return false;
  }

  // Exclude commands that are just variable assignments.
  const assignmentPattern = /^\w+=[^ ]*$/;
  if (assignmentPattern.test(command)) {
    return false;
  }

  return true;
}

/**
 * Parses raw history lines, cleans them, and counts the frequency of each command.
 * It returns a sorted list of the most frequent commands.
 *
 * @param {object} options - The parsing options.
 * @param {string[]} options.historyLines - An array of raw lines from the history file.
 * @param {string} options.shellType - The detected shell type ('zsh', 'bash', 'fish').
 * @param {number} options.minFrequency - The minimum frequency for a command to be included.
 * @param {Set<string>} [options.exclusions=DEFAULT_EXCLUSIONS] - A set of commands to exclude.
 * @returns {Array<{command: string, count: number}>} A sorted array of frequent commands.
 */
export function parseHistory(options) {
  const {
    historyLines,
    shellType,
    minFrequency,
    exclusions = DEFAULT_EXCLUSIONS,
  } = options;

  if (!Array.isArray(historyLines)) {
    throw new Error('historyLines must be an array of strings.');
  }

  const commandCounts = new Map();

  for (const line of historyLines) {
    const cleaned = cleanCommand(line, shellType);

    if (isValidCommand(cleaned, exclusions)) {
      const currentCount = commandCounts.get(cleaned) ?? 0;
      commandCounts.set(cleaned, currentCount + 1);
    }
  }

  const frequentCommands = [];
  for (const [command, count] of commandCounts.entries()) {
    if (count >= minFrequency) {
      frequentCommands.push({ command, count });
    }
  }

  // Sort by count (descending), then alphabetically by command (ascending) for stable ordering.
  frequentCommands.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.command.localeCompare(b.command);
  });

  return frequentCommands;
}