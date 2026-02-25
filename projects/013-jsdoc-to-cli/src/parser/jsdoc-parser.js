/**
 * @file src/parser/jsdoc-parser.js
 * @description Uses 'comment-parser' to extract JSDoc blocks from a source file
 * and transforms them into a structured representation for the CLI.
 */

import { promises as fs } from 'node:fs';
import { parse as commentParse } from 'comment-parser';

/**
 * A custom error class for JSDoc parsing failures.
 * This helps distinguish parsing errors from other application errors.
 */
class JSDocParsingError extends Error {
  /**
   * @param {string} message The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'JSDocParsingError';
  }
}

/**
 * Extracts the function name from a line of code following a JSDoc block.
 * It supports various function declaration syntaxes.
 * - `function myFunction(...)`
 * - `const myFunction = function(...)`
 * - `const myFunction = (...) => ...`
 * - `export function myFunction(...)`
 * - `export const myFunction = ...`
 *
 * @param {string} line The line of code to parse.
 * @returns {string | null} The extracted function name, or null if not found.
 */
function getFunctionNameFromLine(line) {
  if (!line) {
    return null;
  }

  // Matches: `function functionName`, `const functionName =`, `let functionName =`
  const match = line.match(
    /(?:function|const|let|var)\s+([a-zA-Z0-9_$]+)\s*(?:=|\()/
  );

  return match?.[1] ?? null;
}

/**
 * Transforms a raw parameter tag from `comment-parser` into a structured object.
 *
 * @param {import('comment-parser').Tag} tag The raw tag object.
 * @returns {{name: string, type: string, description: string, optional: boolean, default: string | undefined}} A structured parameter object.
 */
function transformParamTag(tag) {
  // Normalize type to lowercase and handle optional syntax like {string=}
  const type = tag.type.toLowerCase().replace(/=$/, '');
  const optional = tag.optional || tag.type.endsWith('=');

  // The 'name' property from comment-parser can include brackets for optional params, e.g., `[myVar]`.
  // We strip them to get the clean variable name.
  const name = tag.name.replace(/^\[|\]$/g, '');

  // Combine the parts of the description into a single string.
  const description = tag.description;

  const param = {
    name,
    type: type || 'string', // Default to string if type is missing
    description,
    optional,
  };

  if (tag.default) {
    param.default = tag.default;
  }

  return param;
}

/**
 * Parses the JSDoc comments from a file and extracts metadata for a specific function.
 *
 * @param {string} filePath The absolute path to the JavaScript file.
 * @param {string} functionName The name of the function to find documentation for.
 * @returns {Promise<{functionDescription: string, params: Array<object>}>} A promise that resolves to an object
 *   containing the function's description and a structured list of its parameters.
 * @throws {JSDocParsingError} If the file cannot be read, the function is not found, or no JSDoc is associated with it.
 */
export async function parseJsdoc(filePath, functionName) {
  let fileContent;
  try {
    fileContent = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new JSDocParsingError(`File not found at path: ${filePath}`);
    }
    throw new JSDocParsingError(
      `Failed to read file: ${filePath}. Reason: ${error.message}`
    );
  }

  // The `spacing: 'preserve'` option is crucial for correctly associating
  // comments with the code that follows them.
  const parsedComments = commentParse(fileContent, { spacing: 'preserve' });

  if (parsedComments.length === 0) {
    throw new JSDocParsingError(
      `No JSDoc comments found in file: ${filePath}`
    );
  }

  for (const block of parsedComments) {
    // The line immediately following the JSDoc block should contain the function signature.
    const nextCodeLine = block.source.at(block.source.length - 1)?.source;
    const nameFromLine = getFunctionNameFromLine(nextCodeLine ?? '');

    if (nameFromLine === functionName) {
      const functionDescription = block.description;
      const paramTags = block.tags.filter((tag) => tag.tag === 'param');
      const params = paramTags.map(transformParamTag);

      return {
        functionDescription,
        params,
      };
    }
  }

  throw new JSDocParsingError(
    `Could not find a JSDoc comment for function "${functionName}" in ${filePath}.`
  );
}