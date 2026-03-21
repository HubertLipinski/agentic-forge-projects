/**
 * @file test/fixtures/project-with-errors/utils/helpers.js
 * @description A sample helper module for testing import resolution.
 * This file exports functions that are intended to be imported by other
 * files in the test fixture project.
 */

/**
 * A simple utility function to format a greeting.
 * @param {string} name - The name to include in the greeting.
 * @returns {string} A formatted greeting string.
 */
export function formatGreeting(name) {
  return `Hello, ${name}!`;
}

/**
 * A constant representing a default configuration value.
 */
export const DEFAULT_TIMEOUT = 5000;

/**
 * A default export for testing `import default` syntax.
 */
const defaultHelper = {
  id: 'default-helper',
  description: 'This is the default export from the helpers module.',
};

export default defaultHelper;