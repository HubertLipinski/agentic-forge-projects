/**
 * This is a sample JavaScript file for testing the git-blame-sifter tool.
 * Its Git history is designed to include a mix of substantive and trivial changes
 * to test the effectiveness of the rule-based filtering.
 *
 * The intended commit history is as follows:
 * 1. Initial commit: Add a basic `sum` function. (Substantive)
 * 2. Feature commit: Add a `multiply` function. (Substantive)
 * 3. Refactor commit: Convert functions to arrow functions. (Trivial - style)
 * 4. Chore commit: Add JSDoc comments. (Potentially substantive, but can be filtered)
 * 5. Style commit: Reformat with Prettier/linter, adjusting whitespace and semicolons. (Trivial - formatting)
 * 6. Bugfix commit: Correct the logic in the `multiply` function. (Substantive)
 * 7. Refactor commit by a bot: Rename a variable. (Trivial - author-based rule)
 */

/**
 * Calculates the sum of two numbers.
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 * @returns {number} The sum of a and b.
 */
const sum = (a, b) => {
  return a + b;
};

/**
 * Calculates the product of two numbers.
 * This version has a deliberate bug fix in its history.
 * @param {number} factor1 - The first number.
 * @param {number} factor2 - The second number.
 * @returns {number} The product of the two numbers.
 */
const multiply = (factor1, factor2) => {
  // This line was intentionally changed from a bug (a + b) to the correct logic (a * b).
  return factor1 * factor2;
};

// This is an unused constant to test changes that don't affect core logic.
const UNUSED_CONSTANT = 123;

export { sum, multiply };