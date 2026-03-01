/**
 * @file src/parser/ast-parser.js
 * @description Uses Acorn and Acorn-walk to traverse the JS source AST, find JSDoc-annotated functions/typedefs, and feed comments to the JSDoc parser.
 */

import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { getLeadingJSDocComment, getDeclarationName, cleanJSDocComment } from '../utils/ast-helpers.js';
import { parseJSDoc } from './jsdoc-parser.js';

/**
 * Parses JavaScript source code to find JSDoc-annotated nodes and extracts their structured information.
 *
 * This function orchestrates the parsing process:
 * 1. It uses Acorn to generate an AST from the source code, capturing comments.
 * 2. It walks the AST to find relevant nodes (functions, variable declarations).
 * 3. For each relevant node, it finds the associated JSDoc comment block.
 * 4. It cleans and parses the JSDoc comment into a structured object.
 * 5. It aggregates these structured objects and returns them.
 *
 * @param {string} sourceCode - The JavaScript source code to parse.
 * @returns {Array<object>} An array of objects, where each object represents a parsed JSDoc entity (e.g., a function with params or a typedef).
 * @throws {Error} Throws an error if Acorn fails to parse the source code.
 */
export function parseAST(sourceCode) {
  if (typeof sourceCode !== 'string') {
    throw new Error('Invalid input: sourceCode must be a string.');
  }

  const parsedEntities = [];
  let comments = [];

  try {
    const ast = parse(sourceCode, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      onComment: comments,
    });

    // We walk the AST to find nodes that are likely to have JSDoc comments.
    // This includes function declarations, variable declarations (for function expressions),
    // and exports.
    simple(ast, {
      FunctionDeclaration(node) {
        processNode(node, comments, parsedEntities);
      },
      VariableDeclaration(node) {
        // Handle cases like `const myFunc = () => {}` or `const myType = {}`
        // The JSDoc is on the `VariableDeclaration`, but we care about the declarator.
        if (node.declarations.length > 0) {
          // In a `const a = 1, b = 2;` scenario, JSDoc usually applies to the whole statement.
          // We'll associate the comment with the first declarator.
          processNode(node, comments, parsedEntities);
        }
      },
      ExportNamedDeclaration(node) {
        // Handle `export const myFunc = ...` or `export function myFunc() {}`
        // The JSDoc is on the export statement itself.
        if (node.declaration) {
          processNode(node, comments, parsedEntities);
        }
      },
    });
  } catch (error) {
    // Provide a more informative error message on parsing failure.
    const message = error.message.includes('SyntaxError')
      ? `Failed to parse source code due to a syntax error: ${error.message}`
      : `An unexpected error occurred during AST parsing: ${error.message}`;
    throw new Error(message, { cause: error });
  }

  return parsedEntities;
}

/**
 * Processes a single AST node to extract its JSDoc information.
 *
 * @param {import('acorn').Node} node - The AST node to process.
 * @param {import('acorn').Comment[]} comments - The list of all comments from the source file.
 * @param {Array<object>} parsedEntities - The accumulator array for parsed JSDoc data.
 * @returns {void} This function mutates the `parsedEntities` array.
 */
function processNode(node, comments, parsedEntities) {
  const jsdocComment = getLeadingJSDocComment(node, comments);

  if (!jsdocComment) {
    return;
  }

  const name = getDeclarationName(node);
  if (!name) {
    // We only process named declarations to ensure we can generate a named schema.
    return;
  }

  const cleanedComment = cleanJSDocComment(jsdocComment.value);
  const parsedJSDoc = parseJSDoc(cleanedComment);

  // We are interested in nodes that define a type (@typedef) or have parameters/return values.
  const hasParams = parsedJSDoc.params && parsedJSDoc.params.length > 0;
  const hasReturns = !!parsedJSDoc.returns;
  const hasTypedef = !!parsedJSDoc.typedef;

  if (hasParams || hasReturns || hasTypedef) {
    // If a @typedef tag is present, its name overrides the declaration name.
    const entityName = parsedJSDoc.typedef?.name ?? name;

    parsedEntities.push({
      name: entityName,
      ...parsedJSDoc,
    });
  }
}