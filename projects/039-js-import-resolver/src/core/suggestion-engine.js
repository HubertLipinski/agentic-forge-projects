/**
 * @file src/core/suggestion-engine.js
 * @description Generates potential fixes for broken imports using various strategies like
 * typo correction (Levenshtein distance) and file extension appending.
 */

import path from 'node:path';
import levenshtein from 'levenshtein-edit-distance';
import { findSourceFiles } from '../utils/file-system.js';

/**
 * The maximum Levenshtein distance to consider a string a potential typo.
 * A lower value means stricter matching. A value of 2-3 is generally reasonable.
 * e.g., 'util' vs 'utils' has a distance of 1.
 * e.g., 'helper' vs 'helpers' has a distance of 1.
 * e.g., 'componant' vs 'component' has a distance of 2.
 * @type {number}
 */
const TYPO_THRESHOLD = 2;

/**
 * Common JavaScript file extensions to suggest.
 * @type {string[]}
 */
const COMMON_EXTENSIONS = ['.js', '.mjs', '.cjs'];

/**
 * Generates suggestions for missing file extensions.
 * If a specifier like './utils/helper' fails, this suggests './utils/helper.js',
 * './utils/helper.mjs', etc.
 *
 * @param {string} specifier - The original module specifier.
 * @returns {string[]} An array of suggestions with extensions appended.
 */
function suggestMissingExtensions(specifier) {
  // Don't add an extension if it already has one or is a bare specifier.
  if (path.extname(specifier) || !specifier.startsWith('.')) {
    return [];
  }

  return COMMON_EXTENSIONS.map(ext => `${specifier}${ext}`);
}

/**
 * Generates suggestions for incorrect relative paths, like forgetting `../`.
 * If importing from a sibling directory, it suggests adding `../`.
 *
 * @param {string} specifier - The original module specifier.
 * @param {string} importerDir - The directory of the file containing the import.
 * @param {string} projectRoot - The root directory of the project.
 * @returns {string[]} An array of path suggestions.
 */
function suggestRelativePathFixes(specifier, importerDir, projectRoot) {
  const suggestions = new Set();

  // Suggest adding '../' if the import is relative and not already traversing up.
  if (specifier.startsWith('./') && importerDir !== projectRoot) {
    const pathParts = specifier.substring(2).split('/');
    const newSpecifier = `../${pathParts.join('/')}`;
    suggestions.add(newSpecifier);
  }

  return Array.from(suggestions);
}

/**
 * Generates typo suggestions for a given specifier against a list of all possible file paths.
 * It uses the Levenshtein distance algorithm to find "close" matches.
 *
 * @param {string} specifier - The broken module specifier.
 * @param {string} importerDir - The directory of the file containing the import.
 * @param {string[]} allFilePaths - An array of all absolute source file paths in the project.
 * @returns {string[]} An array of suggested, corrected relative paths.
 */
function suggestTypos(specifier, importerDir, allFilePaths) {
  const suggestions = [];

  // We only suggest typos for relative paths, as bare specifiers are too broad.
  if (!specifier.startsWith('.')) {
    return [];
  }

  // Get the base name of the specifier to compare against other file names.
  // e.g., for './utils/hlper.js', the basename is 'hlper.js'
  const specifierBaseName = path.basename(specifier);

  for (const absolutePath of allFilePaths) {
    const fileBaseName = path.basename(absolutePath);

    // Calculate edit distance between the specifier's filename and a potential match.
    const distance = levenshtein(specifierBaseName, fileBaseName, { useCollator: true });

    if (distance > 0 && distance <= TYPO_THRESHOLD) {
      // Construct a valid relative path from the importer to the suggested file.
      let relativeSuggestion = path.relative(importerDir, absolutePath);

      // Ensure the relative path starts with './' for same-directory files.
      if (!relativeSuggestion.startsWith('..')) {
        relativeSuggestion = `./${relativeSuggestion}`;
      }

      // Normalize path separators for consistency (e.g., on Windows).
      suggestions.push(relativeSuggestion.replace(/\\/g, '/'));
    }
  }

  return suggestions;
}

/**
 * Generates a list of potential fixes for a broken module import.
 *
 * This function orchestrates several suggestion strategies:
 * 1. Appending common file extensions (e.g., .js, .mjs).
 * 2. Correcting common relative path mistakes (e.g., missing `../`).
 * 3. Finding typos in filenames using Levenshtein distance.
 *
 * @param {object} brokenImport - The information about the broken import.
 * @param {string} brokenImport.specifier - The unresolved module specifier.
 * @param {string} brokenImport.importer - The absolute path to the file containing the import.
 * @param {string} projectRoot - The absolute path to the project's root directory.
 * @param {string[]} allSourceFiles - A list of all source files in the project, used for typo checking.
 * @returns {Promise<string[]>} A promise that resolves to an array of unique, suggested specifiers.
 */
export async function generateSuggestions({ specifier, importer, projectRoot, allSourceFiles }) {
  if (!specifier || !importer || !projectRoot || !allSourceFiles) {
    throw new Error('Missing required arguments for suggestion generation.');
  }

  const importerDir = path.dirname(importer);
  const allSuggestions = new Set();

  // Strategy 1: Suggest missing file extensions
  const extensionSuggestions = suggestMissingExtensions(specifier);
  extensionSuggestions.forEach(s => allSuggestions.add(s));

  // Strategy 2: Suggest relative path fixes
  const pathFixSuggestions = suggestRelativePathFixes(specifier, importerDir, projectRoot);
  pathFixSuggestions.forEach(s => allSuggestions.add(s));

  // Strategy 3: Suggest typos
  const typoSuggestions = suggestTypos(specifier, importerDir, allSourceFiles);
  typoSuggestions.forEach(s => allSuggestions.add(s));

  return Array.from(allSuggestions);
}