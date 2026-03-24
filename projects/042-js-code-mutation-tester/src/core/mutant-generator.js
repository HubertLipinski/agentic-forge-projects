import fs from 'node:fs/promises';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';

// Babel's CJS/ESM interoperability can be tricky.
// `_traverse.default` is the actual traversal function.
const traverse = _traverse.default;
// `_generate.default` is the actual generator function.
const generate = _generate.default;

/**
 * @typedef {import('@babel/types').Node} Node
 * @typedef {import('@babel/types').SourceLocation} SourceLocation
 */

/**
 * Represents a single, isolated mutation.
 * @typedef {object} Mutant
 * @property {string} id - A unique identifier for the mutant (e.g., '1').
 * @property {string} mutatorName - The name of the mutator that created this mutant (e.g., 'BinaryExpression').
 * @property {string} sourceFilePath - The absolute path to the original source file.
 * @property {string} originalCode - The full original source code.
 * @property {string} mutatedCode - The full source code with this single mutation applied.
 * @property {SourceLocation} location - The location (line, column) of the mutation in the source file.
 * @property {string} description - A human-readable description of the change.
 */

/**
 * Represents a potential mutation before the full mutated code is generated.
 * @typedef {object} PotentialMutant
 * @property {string} mutatorName - The name of the mutator.
 * @property {Node} original - The original Babel AST node.
 * @property {Node} replacement - The mutated Babel AST node.
 * @property {SourceLocation} location - The source location of the node.
 * @property {string} description - A description of the mutation.
 */

/**
 * Generates a list of potential mutants for a given source file and a set of mutators.
 *
 * This function orchestrates the process of:
 * 1. Parsing the source code into an AST.
 * 2. Traversing the AST with a visitor that applies all enabled mutators.
 * 3. Collecting all potential mutations identified by the mutators.
 * 4. For each potential mutation, generating the full mutated source code.
 * 5. Packaging each complete mutation into a `Mutant` object.
 *
 * @param {string} sourceFilePath - The absolute path to the source file to mutate.
 * @param {object[]} enabledMutators - An array of mutator objects that are active for this run.
 * @returns {Promise<Mutant[]>} A promise that resolves to an array of generated `Mutant` objects.
 */
export async function generateMutantsForFile(sourceFilePath, enabledMutators) {
  if (!sourceFilePath) {
    throw new Error('`sourceFilePath` must be provided.');
  }
  if (!Array.isArray(enabledMutators)) {
    throw new Error('`enabledMutators` must be an array.');
  }

  try {
    const originalCode = await fs.readFile(sourceFilePath, 'utf-8');
    const ast = parse(originalCode, {
      sourceType: 'module', // Assume ES modules, a common standard.
      plugins: ['jsx', 'typescript'], // Enable parsing for modern syntax.
      errorRecovery: true, // Attempt to parse even with minor syntax errors.
    });

    const potentialMutants = findPotentialMutants(ast, enabledMutators);

    if (potentialMutants.length === 0) {
      return [];
    }

    // Generate the full mutated code for each potential mutant.
    const mutants = potentialMutants.map((potential, index) => {
      const mutatedCode = generateMutatedCode(ast, potential.original, potential.replacement);
      return {
        id: String(index + 1),
        mutatorName: potential.mutatorName,
        sourceFilePath,
        originalCode,
        mutatedCode,
        location: potential.location,
        description: potential.description,
      };
    });

    return mutants;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Source file not found at: ${sourceFilePath}`);
    }
    // Could be a Babel parsing error or other file system issue.
    throw new Error(`Failed to generate mutants for ${sourceFilePath}: ${error.message}`);
  }
}

/**
 * Traverses the AST and collects all possible mutations from the enabled mutators.
 *
 * @param {import('@babel/types').File} ast - The Abstract Syntax Tree of the source file.
 * @param {object[]} enabledMutators - The list of active mutator objects.
 * @returns {PotentialMutant[]} An array of potential mutants found in the AST.
 * @private
 */
function findPotentialMutants(ast, enabledMutators) {
  const potentialMutants = [];
  const visitor = {};

  // Build a Babel visitor object from the enabled mutators.
  // This allows us to traverse the AST once and apply all mutators.
  for (const mutator of enabledMutators) {
    if (mutator.nodeType && typeof mutator.generateMutants === 'function') {
      // The key of the visitor is the AST node type (e.g., 'BinaryExpression').
      // The value is a function that receives the node's path.
      visitor[mutator.nodeType] = (path) => {
        // `path.skip()` prevents traversing into the children of the current node.
        // This is crucial because if we mutate a node (e.g., `a + b`), we don't
        // want a child mutator to also mutate `a` or `b` within the same top-level mutation.
        // Each mutant should be minimal and isolated.
        path.skip();

        const newMutants = mutator.generateMutants(path);
        if (Array.isArray(newMutants)) {
          potentialMutants.push(...newMutants);
        }
      };
    }
  }

  // If no mutators are configured to visit any nodes, we can skip traversal.
  if (Object.keys(visitor).length === 0) {
    return [];
  }

  traverse(ast, visitor);

  return potentialMutants;
}

/**
 * Generates the full source code for a single mutation.
 *
 * It works by creating a fresh traversal of the AST. When it finds the
 * exact original node that needs to be mutated, it replaces it with the
 * replacement node and then stops the traversal immediately. Finally,
 * it generates the code from the now-mutated AST.
 *
 * @param {import('@babel/types').File} ast - The original, unmodified AST.
 * @param {Node} originalNode - The specific AST node to be replaced.
 * @param {Node} replacementNode - The node to substitute in place of the original.
 * @returns {string} The complete source code with the mutation applied.
 * @private
 */
function generateMutatedCode(ast, originalNode, replacementNode) {
  // We use structuredClone to create a deep, independent copy of the AST.
  // This ensures that each mutation generation starts from a clean slate
  // and doesn't interfere with others.
  const astCopy = structuredClone(ast);

  const visitor = {
    enter(path) {
      // We identify the correct node to replace by checking if it's the exact
      // same object reference as the `originalNode` captured earlier.
      // This is a reliable way to find the specific node instance.
      if (path.node === originalNode) {
        path.replaceWith(replacementNode);
        // Once we've performed the replacement, there's no need to continue
        // traversing the rest of the tree for this mutation.
        path.stop();
      }
    },
  };

  traverse(astCopy, visitor);

  // Generate the modified source code from the mutated AST copy.
  // The `{ comments: true }` option ensures that comments from the original
  // file are preserved in the mutated output.
  const { code } = generate(astCopy, { comments: true });

  return code;
}