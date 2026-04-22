/**
 * @file src/parser/file-parser.js
 * @description Reads a single file, generates an AST, and extracts environment variables.
 * This module is responsible for the I/O and parsing logic for an individual source file.
 * It uses Acorn to create an Abstract Syntax Tree and then leverages the ast-walker
 * to find all `process.env` usages within that tree.
 */

import { promises as fs } from 'node:fs';
import { parse } from 'acorn';
import { findEnvVarExpressions } from './ast-walker.js';

/**
 * Parses a given JavaScript source code string into an Abstract Syntax Tree (AST).
 *
 * It uses Acorn with settings suitable for modern JavaScript (ES2024) and ES modules.
 * Crucially, it includes location information (`locations: true`) in the AST, which is
 * essential for reporting the file and line number of each environment variable usage.
 *
 * @param {string} sourceCode - The JavaScript code to parse.
 * @returns {object} The generated AST object.
 * @throws {Error} Throws if Acorn fails to parse the source code, indicating a syntax error.
 */
const generateAst = (sourceCode) => {
  try {
    // `ecmaVersion: 'latest'` is flexible, but '2024' is specific and stable.
    // `sourceType: 'module'` allows parsing of `import`/`export` syntax.
    // `locations: true` is critical for providing line/column numbers in reports.
    return parse(sourceCode, {
      ecmaVersion: 2024,
      sourceType: 'module',
      locations: true,
    });
  } catch (error) {
    // Re-throw with a more context-specific message.
    // This helps differentiate parsing errors from other potential issues.
    throw new Error(`Failed to parse source code due to a syntax error: ${error.message}`);
  }
};

/**
 * Reads a file, parses it into an AST, and extracts all environment variable usages.
 *
 * This is the core function of the module. It orchestrates the process for a single file:
 * 1. Asynchronously reads the file content.
 * 2. Generates an AST from the content.
 * 3. Uses the `ast-walker` to find all `process.env` expressions in the AST.
 * 4. Maps the findings to a structured format, including the file path.
 *
 * @param {string} filePath - The absolute or relative path to the JavaScript file.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of objects,
 *   where each object represents a found environment variable usage with its name,
 *   file path, and location (line/column). Returns an empty array if no variables are found.
 * @throws {Error} Throws if the file cannot be read (e.g., permissions, not found)
 *   or if the code contains syntax errors that prevent parsing.
 */
export const parseFile = async (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid filePath provided. Expected a non-empty string.');
  }

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');

    // If the file is empty, there's no need to parse it.
    if (fileContent.trim() === '') {
      return [];
    }

    const ast = generateAst(fileContent);
    const envVarExpressions = findEnvVarExpressions(ast);

    // Transform the raw AST findings into a more useful structure,
    // associating each finding with the file it came from.
    return envVarExpressions.map((expression) => ({
      name: expression.name,
      file: filePath,
      line: expression.loc.start.line,
      column: expression.loc.start.column,
    }));
  } catch (error) {
    // Catch errors from fs.readFile, generateAst, or findEnvVarExpressions
    // and wrap them to provide context about which file failed.
    const errorMessage = `Error processing file "${filePath}": ${error.message}`;
    // Preserve the original stack trace for better debugging if needed.
    const contextualError = new Error(errorMessage);
    contextualError.cause = error;
    throw contextualError;
  }
};