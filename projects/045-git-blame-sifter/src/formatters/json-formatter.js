/**
 * @file src/formatters/json-formatter.js
 * @module formatters/json-formatter
 * @description Formats the sifted blame data into a structured JSON output
 * for machine consumption.
 */

import chalk from 'chalk';

/**
 * Transforms the internal analysis result into a serializable JSON structure.
 * This function creates a clean, public-facing data structure, decoupling the
 * output format from the internal workings of the application.
 *
 * @param {object} analysisResult - The result object from the sift command.
 * @param {string} analysisResult.filePath - The path of the analyzed file.
 * @param {object[]} analysisResult.processedBlame - An array of processed blame data for each line.
 * @returns {object} A serializable object representing the sifted blame data.
 */
function buildJsonStructure(analysisResult) {
  const { filePath, processedBlame } = analysisResult;

  const lines = processedBlame.map(lineData => {
    const {
      finalLine,
      content,
      isTrivial,
      trivialityReason,
      originalCommit,
      siftedCommit,
    } = lineData;

    // The siftedCommit is the primary author/commit for this line.
    const finalCommit = {
      hash: siftedCommit.hash,
      author: {
        name: siftedCommit.author,
        email: siftedCommit['author-mail']?.replace(/^<|>$/g, ''),
      },
      committer: {
        name: siftedCommit.committer,
        email: siftedCommit['committer-mail']?.replace(/^<|>$/g, ''),
      },
      summary: siftedCommit.summary,
      timestamp: {
        author: siftedCommit['author-time'],
        committer: siftedCommit['committer-time'],
      },
    };

    const lineOutput = {
      line: finalLine,
      content,
      commit: finalCommit,
      isSifted: isTrivial,
    };

    // If the line was sifted, include details about the original trivial commit.
    if (isTrivial) {
      lineOutput.siftedInfo = {
        reason: trivialityReason,
        originalCommit: {
          hash: originalCommit.hash,
          author: {
            name: originalCommit.author,
            email: originalCommit['author-mail']?.replace(/^<|>$/g, ''),
          },
          summary: originalCommit.summary,
          timestamp: {
            author: originalCommit['author-time'],
          },
        },
      };
    }

    return lineOutput;
  });

  return {
    file: filePath,
    lines,
  };
}

/**
 * The main function for the JSON formatter.
 * It takes the final processed blame data, transforms it into a structured
 * JSON format, and prints it to the console.
 *
 * @async
 * @function jsonFormatter
 * @param {object} analysisResult - The result object from the sift command.
 * @param {string} analysisResult.filePath - The path of the analyzed file.
 * @param {object[]} analysisResult.processedBlame - An array of processed blame data for each line.
 * @param {object} [options={}] - Formatting options.
 * @param {number} [options.indent=2] - The number of spaces to use for JSON indentation.
 * @returns {Promise<void>} A promise that resolves when printing is complete.
 * @throws {Error} If the analysis result is invalid or serialization fails.
 */
export async function jsonFormatter(analysisResult, options = {}) {
  const { indent = 2 } = options;

  // Defensive check for required input.
  if (!analysisResult?.processedBlame || !analysisResult?.filePath) {
    const errorMessage = 'JSON formatter received invalid analysis results. Missing "processedBlame" or "filePath".';
    console.error(chalk.red(errorMessage));
    throw new Error(errorMessage);
  }

  try {
    const jsonStructure = buildJsonStructure(analysisResult);

    // Serialize the structured object to a JSON string with specified indentation.
    // Using a replacer function is not necessary here but is a good pattern for complex objects.
    const jsonOutput = JSON.stringify(jsonStructure, null, indent);

    // Print the final JSON to standard output.
    console.log(jsonOutput);
  } catch (error) {
    // Catch potential errors from JSON.stringify (e.g., circular references), though unlikely with our structure.
    const errorMessage = 'An unexpected error occurred during JSON formatting.';
    console.error(chalk.red(errorMessage));
    console.error(error);
    throw new Error(errorMessage, { cause: error });
  }
}