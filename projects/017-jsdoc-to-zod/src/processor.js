/**
 * @file src/processor.js
 * @description Orchestrates the process of converting JSDoc from a single file into Zod schemas.
 * This module reads a file, invokes the AST parser, passes the result to the Zod builder,
 * and returns the generated Zod schema code as a string.
 */

import { promises as fs } from 'node:fs';
import { parseAST } from './parser/ast-parser.js';
import { generateZodSchemaFile } from './generator/zod-builder.js';

/**
 * Processes a single JavaScript file to generate Zod schemas from its JSDoc annotations.
 *
 * This function encapsulates the entire workflow for one file:
 * 1. Asynchronously reads the file content.
 * 2. Parses the source code into an Abstract Syntax Tree (AST) to find JSDoc-annotated entities.
 * 3. Builds Zod schema strings from the parsed entities.
 * 4. Formats the final output string, including necessary imports and headers.
 *
 * @param {string} filePath - The absolute or relative path to the JavaScript file to process.
 * @returns {Promise<{filePath: string, zodSchema: string}>} A promise that resolves to an object
 *   containing the original file path and the generated Zod schema as a string.
 *   The `zodSchema` will be an empty string if no convertible JSDoc comments are found.
 * @throws {Error} Throws an error if the file cannot be read or if parsing fails.
 */
export async function processFile(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('Invalid input: filePath must be a non-empty string.');
  }

  let sourceCode;
  try {
    sourceCode = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    // Augment file-system errors with more context.
    throw new Error(`Failed to read file at '${filePath}'. Reason: ${error.message}`, { cause: error });
  }

  try {
    // Step 1: Parse the source code to extract structured JSDoc information.
    const parsedEntities = parseAST(sourceCode);

    // Step 2: Pass the structured data to the generator to build the Zod schema file content.
    const zodSchema = generateZodSchemaFile(parsedEntities);

    return { filePath, zodSchema };
  } catch (error) {
    // Catch errors from parsing or generation and add file context.
    throw new Error(`Failed to process '${filePath}'. Reason: ${error.message}`, { cause: error });
  }
}