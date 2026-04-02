/**
 * @fileoverview Generates smart, non-conflicting alias suggestions for frequent commands.
 * This module implements several abbreviation strategies to create intuitive and short aliases,
 * ensuring they do not conflict with each other or with existing common commands.
 */

import { DEFAULT_EXCLUSIONS } from '../utils/constants.js';

/**
 * Generates an alias from a command by taking the first letter of each word.
 * Example: 'git status' -> 'gs'
 * Example: 'docker-compose up' -> 'dcu'
 *
 * @param {string} command - The command string.
 * @returns {string} The generated acronym alias.
 */
function createAcronym(command) {
  // Split by spaces or hyphens to handle commands like 'docker-compose'.
  const parts = command.split(/[ -]/);
  return parts.map(part => part.charAt(0)).join('');
}

/**
 * Generates an alias by taking the first word and the first letter of the second word.
 * This is useful for commands where the first word is the main tool.
 * Example: 'git status' -> 'g_s' (will be cleaned to 'gs')
 * Example: 'npm install' -> 'n_i' (will be cleaned to 'ni')
 *
 * @param {string} command - The command string.
 * @returns {string|null} The generated alias or null if the command has fewer than two words.
 */
function createFirstWordAcronym(command) {
  const parts = command.split(' ');
  if (parts.length < 2) {
    return null;
  }
  // This strategy is often redundant with the main acronym one, but can be a fallback.
  // We'll keep it simple and let the main acronym strategy handle most cases.
  // A more distinct version could be `git-s` but that's less common for aliases.
  // For now, we'll stick to a simple acronym `gs`.
  // This function can be expanded if more strategies are needed.
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`;
}

/**
 * Generates an alias by taking the first `length` characters of the first word.
 * This is a fallback for single-word commands that are not in the exclusion list.
 * Example: 'prettier' -> 'pr' (if length is 2)
 *
 * @param {string} command - The command string.
 * @param {number} length - The desired length of the alias.
 * @returns {string|null} The generated alias or null if not applicable.
 */
function createTruncated(command, length) {
  const firstWord = command.split(' ')[0];
  if (firstWord.length > length) {
    return firstWord.substring(0, length);
  }
  return null;
}

/**
 * Generates a set of potential alias suggestions for a single command using various strategies.
 * It prioritizes acronyms as they are often the most intuitive.
 *
 * @param {string} command - The command to generate aliases for.
 * @param {number} aliasLength - The desired minimum length for aliases.
 * @returns {string[]} An array of unique, potential alias strings.
 */
function generatePotentialAliases(command, aliasLength) {
  const suggestions = new Set();

  // Strategy 1: Acronym (e.g., 'git status' -> 'gs')
  const acronym = createAcronym(command);
  if (acronym.length >= aliasLength) {
    suggestions.add(acronym);
  }

  // Strategy 2: First word + first letter of second word (often same as acronym)
  const firstWordAcronym = createFirstWordAcronym(command);
  if (firstWordAcronym && firstWordAcronym.length >= aliasLength) {
    suggestions.add(firstWordAcronym);
  }

  // Strategy 3: Truncated first word (fallback)
  const truncated = createTruncated(command, aliasLength);
  if (truncated) {
    suggestions.add(truncated);
  }

  // Fallback for very long acronyms: truncate the acronym
  if (acronym.length > aliasLength + 1) {
    suggestions.add(acronym.substring(0, aliasLength));
  }

  return Array.from(suggestions);
}

/**
 * Takes a list of frequent commands and generates a single, non-conflicting alias for each.
 * It iterates through commands, generates potential aliases, and picks the first one that
 * hasn't already been used or is not a common command.
 *
 * @param {object} options - The suggestion options.
 * @param {Array<{command: string, count: number}>} options.frequentCommands - A sorted array of frequent commands.
 * @param {number} options.aliasLength - The desired length for generated aliases.
 * @param {Set<string>} [options.exclusions=DEFAULT_EXCLUSIONS] - A set of commands to avoid generating aliases for or conflicting with.
 * @returns {Array<{command: string, alias: string, count: number}>} An array of commands with their suggested aliases.
 */
export function suggestAliases(options) {
  const {
    frequentCommands,
    aliasLength,
    exclusions = DEFAULT_EXCLUSIONS,
  } = options;

  if (!Array.isArray(frequentCommands)) {
    throw new Error('frequentCommands must be an array.');
  }

  // Use a Set to track used aliases and prevent conflicts.
  // Pre-populate with common commands to avoid suggesting an alias like 'ls' or 'git'.
  const usedAliases = new Set(exclusions);
  const suggestions = [];

  for (const { command, count } of frequentCommands) {
    const potentialAliases = generatePotentialAliases(command, aliasLength);
    let chosenAlias = null;

    for (const alias of potentialAliases) {
      if (!usedAliases.has(alias)) {
        chosenAlias = alias;
        break;
      }
    }

    // If no non-conflicting alias was found, try to create a longer, unique one.
    if (!chosenAlias) {
      const baseAcronym = createAcronym(command);
      // Attempt to create a unique alias by appending a number, e.g., 'gs2'
      for (let i = 2; i <= 5; i++) {
        const fallbackAlias = `${baseAcronym}${i}`;
        if (!usedAliases.has(fallbackAlias)) {
          chosenAlias = fallbackAlias;
          break;
        }
      }
    }

    if (chosenAlias) {
      suggestions.push({ command, alias: chosenAlias, count });
      usedAliases.add(chosenAlias);
    }
  }

  return suggestions;
}