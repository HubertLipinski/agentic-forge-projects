/**
 * @file src/services/envParser.js
 * @description Reads file contents and uses regular expressions to extract unique environment variable names.
 * This service is central to discovering which environment variables are used in the codebase.
 */

import { promises as fs } from 'node:fs';
import { ENV_VAR_REGEX } from '../utils/constants.js';

/**
 * Parses the content of a single file to find all environment variable usages.
 * It uses the predefined ENV_VAR_REGEX to find matches.
 *
 * @async
 * @function parseFileContent
 * @param {string} filePath - The absolute path to the file to parse.
 * @returns {Promise<string[]>} A promise that resolves to an array of unique environment variable names found in the file.
 * @throws {Error} If the file cannot be read.
 */
async function parseFileContent(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const matches = content.matchAll(ENV_VAR_REGEX);
    const variables = new Set();

    for (const match of matches) {
      // The regex has two capturing groups: one for dot notation (`.VAR`) and one for bracket notation (`['VAR']`).
      // The matched variable name will be in either `match[1]` (dot notation) or `match[2]` (bracket notation).
      // The `||` operator elegantly selects the one that is not undefined.
      const varName = match[1] || match[2];
      if (varName) {
        variables.add(varName);
      }
    }

    return Array.from(variables);
  } catch (error) {
    // Provide a clear, actionable error message if a file cannot be read.
    // This could be due to permissions issues or the file being deleted mid-process.
    console.error(`[Warning] Could not read or parse file: ${filePath}`);
    console.error(`  Reason: ${error.message}`);
    // Return an empty array to allow the process to continue with other files.
    // This makes the tool resilient to isolated file read errors.
    return [];
  }
}

/**
 * Orchestrates the parsing of multiple files to extract a unique set of all environment variables.
 * It iterates through a list of file paths, parses each one, and aggregates the results.
 *
 * @async
 * @function extractEnvVars
 * @param {string[]} filePaths - An array of absolute file paths to scan.
 * @returns {Promise<string[]>} A promise that resolves to a sorted array of unique environment variable names found across all files.
 */
export async function extractEnvVars(filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return [];
  }

  const allVariables = new Set();

  // Process files in parallel for improved performance, especially with a large number of files.
  // `Promise.all` waits for all file parsing operations to complete.
  const parsingPromises = filePaths.map(filePath => parseFileContent(filePath));
  const results = await Promise.all(parsingPromises);

  // `results` is an array of arrays (e.g., [['VAR1'], ['VAR2', 'VAR3']]).
  // We flatten this structure and add each variable to a Set to ensure uniqueness.
  for (const variables of results) {
    for (const variable of variables) {
      allVariables.add(variable);
    }
  }

  // Convert the Set to an array and sort it alphabetically for consistent, predictable output.
  return Array.from(allVariables).sort();
}