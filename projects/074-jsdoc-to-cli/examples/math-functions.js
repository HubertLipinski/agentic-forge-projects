/**
 * @fileoverview A collection of example mathematical functions.
 *
 * This file demonstrates how to use JSDoc annotations to define functions
 * that can be automatically converted into command-line interface (CLI) commands
 * by the `jsdoc-to-cli` tool. Each exported function will become a command.
 *
 * @module examples/math-functions
 */

/**
 * Adds two numbers and returns the sum.
 * This is the primary command and demonstrates basic argument handling.
 *
 * @param {number} a The first number to add.
 * @param {number} b The second number to add.
 * @returns {number} The sum of the two numbers.
 */
export function add(a, b) {
  // The generator will automatically handle parsing string inputs to numbers
  // based on the {number} type in JSDoc.
  return Number(a) + Number(b);
}

/**
 * Multiplies a list of numbers.
 * This function demonstrates handling multiple arguments and optional flags.
 *
 * @param {number[]} numbers A list of numbers to multiply together.
 * @param {boolean} [log=false] If true, prints the result to the console with a label.
 * @param {string} [prefix='Result:'] A prefix string to use when logging the result.
 * @returns {number} The product of the numbers.
 */
export function multiply(numbers, { log = false, prefix = 'Result:' } = {}) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error('The "numbers" argument must be a non-empty array of numbers.');
  }

  const product = numbers.reduce((acc, val) => acc * Number(val), 1);

  if (log) {
    console.log(`${prefix} ${product}`);
    // Return nothing when logging, to demonstrate silent exit.
    return;
  }

  return product;
}

/**
 * Calculates the power of a number.
 * This demonstrates a required argument and an optional argument with a default value.
 *
 * @param {number} base The base number.
 * @param {number} [exponent=2] The exponent to raise the base to.
 * @returns {number} The result of the exponentiation.
 */
export function power(base, exponent = 2) {
  return Math.pow(Number(base), Number(exponent));
}

/**
 * A private function that should NOT be exposed in the CLI.
 * The generator should ignore this because it is not exported.
 *
 * @param {string} message The message to log.
 * @private
 */
function internalHelper(message) {
  console.log(`Internal helper: ${message}`);
}

/**
 * Greets a user. This function does not return a value.
 * The generated CLI command should simply execute and exit silently.
 *
 * @param {string} name The name of the person to greet.
 */
export function greet(name) {
  console.log(`Hello, ${name}!`);
  internalHelper('Greeting was successful.');
}

// This function is not exported, so it should be ignored by the generator.
const subtract = (a, b) => a - b;