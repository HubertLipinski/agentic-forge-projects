import { MUTATION_TYPE } from '../constants.js';

/**
 * @typedef {import('@babel/types').StringLiteral} StringLiteral
 * @typedef {import('../core/mutant-generator.js').Mutant} Mutant
 * @typedef {import('@babel/traverse').NodePath<StringLiteral>} NodePath
 */

/**
 * The placeholder string used to replace non-empty string literals.
 * Using a specific, descriptive string makes it easier to identify
 * mutations in test output or logs if needed.
 */
const MUTATION_PLACEHOLDER = 'MUTATED_STRING';

/**
 * Generates mutants for StringLiteral nodes.
 *
 * This mutator applies two simple rules:
 * 1. If the string literal is not empty, it's replaced with a placeholder string "MUTATED_STRING".
 * 2. If the string literal is empty (""), it's replaced with the placeholder string "MUTATED_STRING".
 *
 * This helps catch cases where the specific content of a string is important
 * for logic, but the tests only check for its existence or non-emptiness.
 *
 * @param {NodePath} path - The Babel path object for a StringLiteral node.
 * @returns {Mutant[]} An array of generated mutants.
 */
function generateMutants(path) {
  const { node } = path;

  // Ensure we don't mutate nodes that were added by other mutators
  // or nodes that are not part of the original source code.
  if (!node.loc) {
    return [];
  }

  // Avoid mutating string literals inside import/export declarations,
  // as this would break module resolution and is not a meaningful mutation.
  // e.g., `import x from './source.js'` or `export { y } from './source.js'`
  if (
    path.parentPath.isImportDeclaration() ||
    path.parentPath.isExportDeclaration()
  ) {
    return [];
  }

  // Avoid mutating keys in object properties unless they are computed.
  // e.g., `const obj = { "my-key": 1 }` should not be mutated.
  // `const obj = { ["my-key"]: 1 }` would be a StringLiteral in a computed property,
  // which is a valid mutation target, but this check handles the former case.
  if (path.parentPath.isObjectProperty() && path.key === 'key' && !path.parent.computed) {
    return [];
  }

  const originalValue = node.value;

  // Determine the replacement value and description based on the original.
  const replacementValue = originalValue === '' ? MUTATION_PLACEHOLDER : '';
  const description =
    originalValue === ''
      ? `Replaced empty string "" with "${MUTATION_PLACEHOLDER}"`
      : `Replaced string literal "${
          originalValue.length > 20
            ? originalValue.substring(0, 17) + '...'
            : originalValue
        }" with an empty string ""`;

  // Create a new node with the mutated value.
  // We use structuredClone for a deep, safe copy of the original node.
  const mutatedNode = structuredClone(node);
  mutatedNode.value = replacementValue;

  // The 'extra' property from Babel can sometimes cause issues with
  // regeneration or comparison, so we remove it for safety.
  if (mutatedNode.extra) {
    delete mutatedNode.extra;
  }

  return [
    {
      mutatorName: 'StringLiteral',
      original: node,
      replacement: mutatedNode,
      location: node.loc,
      description,
    },
  ];
}

/**
 * A mutator object that defines how to handle StringLiteral nodes.
 * This object is discovered and used by the MutantGenerator.
 */
export const stringLiteralMutator = {
  name: 'StringLiteral',
  type: MUTATION_TYPE.AST_NODE,
  // The Babel visitor key for the node type this mutator handles.
  // When @babel/traverse encounters a 'StringLiteral', it will call `generateMutants`.
  nodeType: 'StringLiteral',
  generateMutants,
};