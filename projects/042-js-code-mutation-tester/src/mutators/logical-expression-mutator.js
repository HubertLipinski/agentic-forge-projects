import { MUTATION_TYPE } from '../constants.js';

/**
 * @typedef {import('@babel/types').LogicalExpression} LogicalExpression
 * @typedef {import('../core/mutant-generator.js').Mutant} Mutant
 */

/**
 * A map defining the replacements for logical operators.
 * The keys are the original operators, and the values are the operators to replace them with.
 * This structure allows for easy extension and configuration.
 * Note: We do not mutate '??' (nullish coalescing) as its behavior is quite
 * distinct and a simple swap with '&&' or '||' often leads to syntax errors
 * or fundamentally different (and less useful) logic changes.
 *
 * @type {Readonly<Record<LogicalExpression['operator'], LogicalExpression['operator']>>}
 */
const operatorReplacements = Object.freeze({
  '&&': '||',
  '||': '&&',
});

/**
 * Checks if a given operator is a candidate for mutation.
 *
 * @param {string} operator - The logical operator to check (e.g., '&&', '||').
 * @returns {boolean} - True if the operator can be mutated, false otherwise.
 */
function isMutableOperator(operator) {
  return operator in operatorReplacements;
}

/**
 * Generates mutants for LogicalExpression nodes.
 * It replaces operators like `&&` with `||` and vice-versa.
 *
 * @param {import('@babel/traverse').NodePath<LogicalExpression>} path - The Babel path object for a LogicalExpression node.
 * @returns {Mutant[]} An array of generated mutants.
 */
function generateMutants(path) {
  const { node } = path;

  // Ensure we don't mutate nodes that were added by other mutators
  // or nodes that are not part of the original source code.
  if (!node.loc) {
    return [];
  }

  // Check if the operator is one we know how to mutate.
  if (!isMutableOperator(node.operator)) {
    return [];
  }

  const originalOperator = node.operator;
  const replacementOperator = operatorReplacements[originalOperator];

  // Create a new node with the mutated operator.
  // We use structuredClone to create a deep copy of the node,
  // ensuring that the original AST is not modified.
  // Then, we just overwrite the operator property.
  const mutatedNode = structuredClone(node);
  mutatedNode.operator = replacementOperator;

  // The 'extra' property from Babel can sometimes cause issues with
  // regeneration or comparison, so we remove it for safety.
  if (mutatedNode.extra) {
    delete mutatedNode.extra;
  }

  return [
    {
      mutatorName: 'LogicalExpression',
      original: node,
      replacement: mutatedNode,
      location: node.loc,
      // A clear description of the change for reporting purposes.
      description: `Replaced logical operator "${originalOperator}" with "${replacementOperator}"`,
    },
  ];
}

/**
 * A mutator object that defines how to handle LogicalExpression nodes.
 * This object is discovered and used by the MutantGenerator.
 */
export const logicalExpressionMutator = {
  name: 'LogicalExpression',
  type: MUTATION_TYPE.AST_NODE,
  // The Babel visitor key for the node type this mutator handles.
  // When @babel/traverse encounters a 'LogicalExpression', it will call `generateMutants`.
  nodeType: 'LogicalExpression',
  generateMutants,
};