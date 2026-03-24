/**
 * @file src/mutators/index.js
 * @description
 * This file serves as the central registry for all available mutators in the application.
 * It imports each individual mutator module and exports them in a structured way.
 * This pattern allows for easy discovery and management of mutators. The mutation engine
 * can then dynamically select which mutators to use based on user configuration.
 *
 * Each mutator is an object that conforms to a specific interface, defining its name,
 * the type of AST node it targets, and a function to generate mutations for that node.
 *
 * To add a new mutator:
 * 1. Create a new file in the `src/mutators/` directory (e.g., `new-mutator.js`).
 * 2. Implement the mutator logic and export it (e.g., `export const newMutator = { ... };`).
 * 3. Import the new mutator object here.
 * 4. Add the imported mutator to the `allMutators` array.
 * 5. Add its name to the `availableMutatorNames` array.
 */

import { binaryExpressionMutator } from './binary-expression-mutator.js';
import { logicalExpressionMutator } from './logical-expression-mutator.js';
import { stringLiteralMutator } from './string-literal-mutator.js';
// To add more mutators, import them here. For example:
// import { arrowFunctionExpressionMutator } from './arrow-function-expression-mutator.js';

/**
 * An array containing all individual mutator objects available in the system.
 * This array is used by the `MutantGenerator` to build its AST visitor based on
 * the mutators enabled in the configuration.
 *
 * @type {Readonly<object[]>}
 */
export const allMutators = Object.freeze([
  binaryExpressionMutator,
  logicalExpressionMutator,
  stringLiteralMutator,
  // Add new mutator objects here.
]);

/**
 * An array of the names of all available mutators.
 * This is useful for configuration validation, documentation, and providing
 * helpful error messages if a user tries to enable a non-existent mutator.
 * The names are derived programmatically from the `allMutators` array to ensure
 * consistency and prevent manual desynchronization.
 *
 * @type {Readonly<string[]>}
 */
export const availableMutatorNames = Object.freeze(
  allMutators.map(mutator => mutator.name)
);

/**
 * A key-value map of mutator names to their corresponding mutator objects.
 * This provides a convenient lookup mechanism, allowing for quick retrieval of a
 * mutator's implementation by its name.
 *
 * @example
 * const mutator = mutatorRegistry['BinaryExpression'];
 *
 * @type {Readonly<Record<string, object>>}
 */
export const mutatorRegistry = Object.freeze(
  Object.fromEntries(allMutators.map(mutator => [mutator.name, mutator]))
);