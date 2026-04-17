import fs from 'node:fs/promises';
import { Parser as AcornParser } from 'acorn';
import logger from '../utils/logger.js';
import * as fileCache from '../utils/file-cache.js';

/**
 * @typedef {import('acorn').Node} AcornNode
 */

/**
 * Configuration options for the Acorn parser.
 * These options are chosen to support modern JavaScript syntax,
 * including ES Modules, dynamic imports, and other common features.
 *
 * @type {import('acorn').Options}
 */
const ACORN_OPTIONS = {
  ecmaVersion: 'latest', // Parse the latest ECMAScript version
  sourceType: 'module', // Support both 'import'/'export' and 'require'
  locations: true, // Attach location information to nodes
  allowHashBang: true, // Support shebangs like #!/usr/bin/env node
  allowImportAttributes: true, // Support import attributes (e.g., import json from './data.json' with { type: 'json' })
  allowReturnOutsideFunction: true, // Be lenient with files that might be snippets
};

/**
 * Parses a given JavaScript source code string into an Abstract Syntax Tree (AST).
 * This is a pure function that encapsulates the Acorn parsing logic.
 *
 * @param {string} sourceCode - The JavaScript code to parse.
 * @param {string} filePath - The path to the file being parsed, used for error reporting.
 * @returns {AcornNode} The parsed AST.
 * @throws {Error} Throws an error if Acorn fails to parse the code, wrapping the original error.
 */
function performParsing(sourceCode, filePath) {
  try {
    return AcornParser.parse(sourceCode, ACORN_OPTIONS);
  } catch (error) {
    // Enhance the error message with context for better debugging.
    const errorMessage = `Failed to parse file: ${filePath}\nAcorn Error: ${error.message}`;
    logger.error(errorMessage);
    // Re-throw as a more specific, actionable error.
    throw new Error(errorMessage, { cause: error });
  }
}

/**
 * Parses a JavaScript file into an Abstract Syntax Tree (AST), utilizing a cache to
 * avoid re-parsing unchanged files.
 *
 * This function orchestrates the process:
 * 1. It first attempts to retrieve a cached AST for the given file path.
 * 2. If a valid cached AST is found, it returns it immediately.
 * 3. If not, it reads the file content from the disk.
 * 4. It then parses the content into an AST using Acorn.
 * 5. Finally, it stores the newly generated AST in the cache for future use.
 *
 * @param {string} filePath - The absolute path to the JavaScript file to parse.
 * @returns {Promise<AcornNode | null>} A promise that resolves to the parsed AST,
 *   or `null` if the file cannot be read or parsed.
 */
export async function parseFile(filePath) {
  logger.debug(`Parsing file: ${filePath}`);

  // 1. Attempt to retrieve from cache first.
  const cachedAst = await fileCache.get(filePath);
  if (cachedAst) {
    logger.debug(`[AST Parser] Cache HIT for: ${filePath}`);
    // The cache stores plain objects, not class instances. We can return it directly.
    return cachedAst;
  }

  logger.debug(`[AST Parser] Cache MISS for: ${filePath}`);

  let sourceCode;
  try {
    // 2. Read file content if not in cache.
    sourceCode = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    logger.error(`Could not read file: ${filePath}`, error);
    // Return null to indicate failure, allowing the caller to handle it gracefully.
    return null;
  }

  try {
    // 3. Perform the parsing.
    const ast = performParsing(sourceCode, filePath);

    // 4. Store the new AST in the cache for subsequent runs.
    // We don't await this; caching is a background task and shouldn't block the main flow.
    fileCache.set(filePath, ast).catch(err => {
      logger.warn(`Failed to cache AST for ${filePath}`, err);
    });

    return ast;
  } catch (error) {
    // The performParsing function already logs the error, so we just return null.
    // The caller is responsible for deciding how to proceed with a failed parse.
    return null;
  }
}