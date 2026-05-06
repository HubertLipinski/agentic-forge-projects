/**
 * @file src/parser/ast-parser.js
 * @description Core AST parsing logic using Acorn and Acorn-walk.
 *
 * This module is responsible for reading JavaScript source files, parsing them
 * into an Abstract Syntax Tree (AST), and walking the tree to identify
 * function declarations, function expressions, and class methods. It extracts
 * these nodes along with their associated JSDoc comment blocks, providing the
 * raw data needed for further analysis.
 */

import fs from 'node:fs/promises';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

/**
 * Parses a JavaScript source file and extracts function/method nodes with their
 * preceding JSDoc comments.
 *
 * It reads the file content, then uses Acorn to generate an AST with comment
 * information. It then walks the AST to find relevant function and method
 * declarations, associating them with the JSDoc block that immediately
 * precedes them.
 *
 * @param {string} filePath - The absolute path to the JavaScript file.
 * @returns {Promise<Array<{name: string, comment: string, node: object, filePath: string}>>}
 *          A promise that resolves to an array of objects, each representing a
 *          function or method with an associated JSDoc comment.
 * @throws {Error} If the file cannot be read or parsed.
 */
export async function parseFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return parseSource(content, filePath);
  } catch (error) {
    // Add context to file I/O or parsing errors.
    throw new Error(`Failed to parse file "${filePath}": ${error.message}`);
  }
}

/**
 * Parses JavaScript source code content into an AST and extracts documented functions.
 * This is a pure function that operates on a string, making it easily testable.
 *
 * @param {string} sourceCode - The JavaScript source code content.
 * @param {string} filePath - The original file path, used for context in results.
 * @returns {Array<{name: string, comment: string, node: object, filePath: string}>}
 *          An array of objects representing functions/methods with JSDoc.
 */
export function parseSource(sourceCode, filePath) {
  const comments = [];
  const ast = parse(sourceCode, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
    onComment: (isBlock, text, start, end) => {
      // We only care about JSDoc-style block comments: /** ... */
      if (isBlock && text.startsWith('*')) {
        comments.push({ text: `/**\n${text}\n */`, start, end });
      }
    },
  });

  const documentedNodes = [];

  /**
   * Finds the JSDoc comment block that immediately precedes a given AST node.
   *
   * @param {object} node - The AST node (e.g., FunctionDeclaration).
   * @returns {string|null} The raw text of the JSDoc comment, or null if not found.
   */
  const getPrecedingJSDoc = (node) => {
    // Find the last comment that ends before the node starts.
    const precedingComment = comments
      .filter((comment) => comment.end < node.start)
      .pop();

    if (!precedingComment) {
      return null;
    }

    // Check if there is only whitespace between the comment and the node.
    // This ensures we don't accidentally associate a comment with a node
    // that is separated by other code.
    const textBetween = sourceCode.substring(precedingComment.end, node.start);
    if (textBetween.trim() === '') {
      return precedingComment.text;
    }

    return null;
  };

  /**
   * A visitor function for acorn-walk that processes a node, finds its JSDoc,
   * and adds it to the results if a comment is found.
   *
   * @param {object} node - The AST node being visited.
   * @param {string} name - The identified name of the function or method.
   */
  const processNode = (node, name) => {
    if (!name) return; // Ignore anonymous functions that aren't assigned.

    const comment = getPrecedingJSDoc(node);
    if (comment) {
      documentedNodes.push({
        name,
        comment,
        node,
        filePath,
      });
    }
  };

  // Walk the AST to find all relevant function and method types.
  simple(ast, {
    // Handles: export function myFunction() {}
    // Handles: function myFunction() {}
    FunctionDeclaration(node) {
      // The name is in `node.id.name`.
      processNode(node, node.id?.name);
    },

    // Handles: export const myFunction = function() {}
    // Handles: const myFunction = () => {}
    VariableDeclaration(node) {
      for (const declaration of node.declarations) {
        if (
          declaration.init &&
          (declaration.init.type === 'FunctionExpression' ||
            declaration.init.type === 'ArrowFunctionExpression')
        ) {
          // The name is in `declaration.id.name`.
          // We associate the comment with the entire variable declaration.
          processNode(node, declaration.id?.name);
        }
      }
    },

    // Handles: export default function() {} (if named)
    // Handles: export default myFunction; (where myFunction is a function)
    // Note: We primarily rely on FunctionDeclaration and VariableDeclaration
    // for named exports. This visitor helps but has limitations with anonymous defaults.
    ExportDefaultDeclaration(node) {
      // export default function myFunction() {}
      if (
        node.declaration.type === 'FunctionDeclaration' &&
        node.declaration.id
      ) {
        processNode(node.declaration, node.declaration.id.name);
      }
      // export default () => {}
      if (
        (node.declaration.type === 'ArrowFunctionExpression' ||
          node.declaration.type === 'FunctionExpression') &&
        !node.declaration.id // Anonymous default export
      ) {
        // We can't reliably name this, so we might assign a default name later.
        // For now, we can use a placeholder or the filename.
        processNode(node, 'default');
      }
    },

    // Handles class methods: class MyService { /** ... */ myMethod() {} }
    MethodDefinition(node) {
      // `node.key.name` for regular methods, `node.key.value` for computed.
      // We only support simple named identifiers for now.
      if (node.key.type === 'Identifier') {
        processNode(node, node.key.name);
      }
    },
  });

  return documentedNodes;
}