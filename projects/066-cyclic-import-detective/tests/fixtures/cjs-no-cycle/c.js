/**
 * @file tests/fixtures/cjs-no-cycle/c.js
 * @description A simple CommonJS module fixture with no dependencies.
 * This file is used in tests to represent a leaf node in a dependency graph
 * that does not create or participate in any cycles.
 */

function utilityFunction() {
  return 'This is a utility from module C.';
}

module.exports = {
  utilityFunction,
  name: 'Module C',
};