/**
 * @fileoverview Utility functions for navigating and extracting information
 * from an Acorn-generated Abstract Syntax Tree (AST).
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

/**
 * Finds the first JSDoc comment block immediately preceding a given AST node.
 * Acorn attaches comments to the AST root, not directly to the nodes they
 * are associated with. This function searches for a comment that ends right
 * before the target node starts.
 *
 * @param {import('acorn').Node} node - The AST node to find the preceding JSDoc for.
 * @param {Array<import('acorn').Comment>} comments - An array of all comments in the source file,
 *   typically from `ast.comments`.
 * @returns {import('acorn').Comment | undefined} The JSDoc comment block (`/** ... */`)
 *   if found, otherwise `undefined`.
 */
export function getLeadingJSDocComment(node, comments) {
  if (!node || !Array.isArray(comments) || comments.length === 0) {
    return undefined;
  }

  let lastComment = null;

  // Iterate backwards through comments to find the one closest to the node.
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];

    // We only care about block comments that look like JSDoc.
    if (
      comment.type !== 'Block' ||
      !comment.value.startsWith('*') ||
      comment.end >= node.start
    ) {
      continue;
    }

    // The comment ends before the node starts. This is a potential candidate.
    // We store it and keep looking for a closer one.
    lastComment = comment;

    // If the comment is on a different line, we can be reasonably sure it's
    // the one we want. This is a heuristic. The most reliable check is to
    // see if there's only whitespace between the comment and the node.
    // For now, we'll just find the last one that ends before the node starts.
    // The `comment.end >= node.start` check above handles cases where comments
    // are inside the node. We want the one *before*.
    break; // Found the last comment before the node, so we can stop.
  }

  // Ensure the found comment is actually a JSDoc block.
  if (lastComment && lastComment.value.startsWith('*')) {
    // Acorn's comment value includes the leading '*' and trailing '*'.
    // A valid JSDoc starts with `/**`. The raw text in `source` would show this,
    // but `comment.value` is just the inner content. The `*` is a good-enough proxy.
    return lastComment;
  }

  return undefined;
}

/**
 * Extracts the name of a function from its AST node.
 * Handles `FunctionDeclaration`, `FunctionExpression`, and `ArrowFunctionExpression`.
 *
 * @param {import('acorn').Node} node - The function's AST node.
 * @returns {string | undefined} The name of the function, or `undefined` if it's anonymous
 *   or cannot be determined.
 */
export function getFunctionName(node) {
  if (!node) return undefined;

  // For `function myFunction() {}`
  if (node.type === 'FunctionDeclaration' && node.id) {
    return node.id.name;
  }

  // For `const myFunction = function() {}` or `const myFunction = () => {}`
  if (
    (node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression') &&
    node.parent
  ) {
    // `const myFunction = ...`
    if (node.parent.type === 'VariableDeclarator' && node.parent.id.type === 'Identifier') {
      return node.parent.id.name;
    }
    // `myObject.myMethod = ...`
    if (
      node.parent.type === 'AssignmentExpression' &&
      node.parent.left.type === 'MemberExpression' &&
      node.parent.left.property.type === 'Identifier'
    ) {
      return node.parent.left.property.name;
    }
    // `class MyClass { myMethod() {} }`
    if (node.parent.type === 'MethodDefinition' && node.parent.key.type === 'Identifier') {
      return node.parent.key.name;
    }
  }

  return undefined;
}

/**
 * Extracts the name of a variable from a `VariableDeclaration` AST node.
 * This is useful for finding the name associated with a `@typedef`.
 *
 * For `const MyType = {...};`, it returns "MyType".
 *
 * @param {import('acorn').Node} node - The `VariableDeclaration` AST node.
 * @returns {string | undefined} The name of the first variable declared, or `undefined`.
 */
export function getVariableDeclaratorName(node) {
  if (
    node &&
    node.type === 'VariableDeclaration' &&
    node.declarations.length > 0
  ) {
    const declarator = node.declarations[0];
    if (declarator.id.type === 'Identifier') {
      return declarator.id.name;
    }
  }
  return undefined;
}

/**
 * Extracts the value from an `ObjectExpression` property in the AST.
 * This is a simplified extractor that handles literal values.
 *
 * @param {import('acorn').Node} propertyNode - The `Property` node from an `ObjectExpression`.
 * @returns {any} The literal value (string, number, boolean, null) or a string
 *   representation for other types. Returns `undefined` if the value cannot be determined.
 */
export function getObjectPropertyValue(propertyNode) {
  if (propertyNode.value.type === 'Literal') {
    return propertyNode.value.value;
  }
  // For more complex values, we can just return a string representation.
  // This might be useful for default values like `[name=_someFunction]`.
  if (propertyNode.value.type === 'Identifier') {
    return propertyNode.value.name;
  }

  return undefined;
}