import { createPatch } from 'diff';
import pc from 'picocolors';

/**
 * @typedef {import('../core/mutant-generator.js').Mutant} Mutant
 */

/**
 * Colorizes the lines of a diff patch for better readability in the console.
 * - Lines starting with '+' are colored green.
 * - Lines starting with '-' are colored red.
 * - Lines starting with '@' (hunk headers) are colored cyan.
 * - Other lines (context lines) are left as is.
 *
 * @param {string} patch - The raw diff patch string.
 * @returns {string} The colorized diff string.
 * @private
 */
function colorizeDiff(patch) {
  return patch
    .split('\n')
    .map((line) => {
      if (line.startsWith('+')) {
        return pc.green(line);
      }
      if (line.startsWith('-')) {
        return pc.red(line);
      }
      if (line.startsWith('@@')) {
        return pc.cyan(line);
      }
      // Keep context lines (starting with a space) and headers uncolored
      // for better contrast, but dim them slightly.
      return pc.dim(line);
    })
    .join('\n');
}

/**
 * Generates a colorized, unified diff string between a mutant's original
 * and mutated code.
 *
 * This function uses the `diff` package to create a patch, which is then
 * formatted and colorized for clear presentation in a terminal.
 *
 * @param {Mutant} mutant - The mutant object containing original and mutated code.
 * @param {object} [options={}] - Configuration options for diff generation.
 * @param {number} [options.context=3] - The number of lines of context to show around changed lines.
 * @param {boolean} [options.colorize=true] - Whether to apply colors to the output.
 * @returns {Promise<string>} A promise that resolves to the formatted diff string.
 * @throws {Error} if the `mutant` object is invalid.
 */
export async function generateDiff(mutant, options = {}) {
  // --- Input Validation ---
  if (!mutant || typeof mutant !== 'object') {
    throw new Error('A valid mutant object must be provided.');
  }
  if (typeof mutant.originalCode !== 'string' || typeof mutant.mutatedCode !== 'string') {
    throw new Error('Mutant object must contain `originalCode` and `mutatedCode` strings.');
  }
  if (!mutant.sourceFilePath || typeof mutant.sourceFilePath !== 'string') {
    throw new Error('Mutant object must contain a `sourceFilePath`.');
  }

  const { originalCode, mutatedCode, sourceFilePath } = mutant;

  // --- Configuration ---
  const config = {
    context: 3,
    colorize: true,
    ...options,
  };

  // The `createPatch` function expects file headers for the "from" and "to" files.
  // We'll use the source file path for both, indicating it's a change within the same file.
  const fromFileHeader = `a/${sourceFilePath}`;
  const toFileHeader = `b/${sourceFilePath}`;

  try {
    // --- Diff Generation ---
    // `createPatch` generates a standard unified diff format string.
    // It returns an empty string if there are no differences.
    const patch = createPatch(
      sourceFilePath,
      originalCode,
      mutatedCode,
      fromFileHeader,
      toFileHeader,
      { context: config.context }
    );

    // If the patch is empty (which shouldn't happen for a valid mutant, but is a good safeguard),
    // return a message instead of an empty string.
    if (!patch.trim()) {
      return pc.yellow('No difference found between original and mutated code.');
    }

    // --- Formatting and Colorization ---
    if (config.colorize) {
      return colorizeDiff(patch);
    }

    return patch;
  } catch (error) {
    // Catch any unexpected errors from the `diff` library.
    // This provides a more specific error message to the caller.
    throw new Error(`Failed to generate diff for ${sourceFilePath}: ${error.message}`);
  }
}