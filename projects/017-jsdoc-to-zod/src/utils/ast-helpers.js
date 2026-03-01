/**
 * @file src/utils/ast-helpers.js
 * @description Utility functions for navigating and extracting information from the Acorn-generated AST.
 * This module provides a set of reusable helpers to simplify common AST traversal and inspection tasks,
 * such as finding comments, identifying node types, and extracting relevant details from AST nodes.
 */

/**
 * Finds the JSDoc comment block immediately preceding a given AST node.
 * Acorn attaches comments to the program root, so we need to search for the
 * last comment that ends before the target node starts.
 *
 * @param {import('acorn').Node} node - The AST node to find the preceding comment for.
 * @param {import('acorn').Comment[]} comments - An array of all comments in the AST.
 * @returns {import('acorn').Comment | undefined} The JSDoc comment block (if found), otherwise undefined.
 */
export function getLeadingJSDocComment(node, comments) {
  if (!node || !Array.isArray(comments)) {
    return undefined;
  }

  let lastComment = undefined;

  for (const comment of comments) {
    // We only care about JSDoc-style block comments (`/** ... */`)
    if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
      continue;
    }

    // The comment must end before the node starts.
    if (comment.end < node.start) {
      // We keep track of the last valid comment we've seen, as comments are ordered by position.
      lastComment = comment;
    } else {
      // Since comments are ordered, once we pass the node's start, we can stop.
      // The `lastComment` we've stored is the one immediately preceding the node.
      break;
    }
  }

  return lastComment;
}

/**
 * Extracts the name from various types of AST declaration nodes.
 * This handles FunctionDeclaration, VariableDeclarator, and ExportNamedDeclaration.
 *
 * @param {import('acorn').Node} node - The AST node to extract the name from.
 * @returns {string | null} The name of the declared entity, or null if not found.
 */
export function getDeclarationName(node) {
  if (!node) {
    return null;
  }

  // Case: function myFunction() {}
  if (node.type === 'FunctionDeclaration' && node.id) {
    return node.id.name;
  }

  // Case: const myFunction = function() {} OR const myObject = {}
  if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
    return node.id.name;
  }

  // Case: export const myFunction = ...
  // The walker will point to ExportNamedDeclaration, we need to look inside.
  if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    // Handles: export function myFunction() {}
    if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
      return node.declaration.id.name;
    }
    // Handles: export const myFunction = ...
    if (node.declaration.type === 'VariableDeclaration' && node.declaration.declarations.length > 0) {
      const declarator = node.declaration.declarations[0];
      if (declarator.id && declarator.id.type === 'Identifier') {
        return declarator.id.name;
      }
    }
  }

  return null;
}

/**
 * Formats a raw JSDoc comment value into a clean string.
 * It removes the leading `/**`, trailing `*/`, and asterisks from each line.
 *
 * @example
 * // Input: '*\n * This is a comment.\n * @param {string} name\n '
 * // Output: 'This is a comment.\n@param {string} name'
 *
 * @param {string} rawCommentValue - The raw `value` from an Acorn comment object.
 * @returns {string} The cleaned comment string.
 */
export function cleanJSDocComment(rawCommentValue) {
  if (typeof rawCommentValue !== 'string') {
    return '';
  }

  return rawCommentValue
    .split('\n')
    .map(line => line.trim().replace(/^\* ?/, '').trim())
    .join('\n')
    .trim();
}