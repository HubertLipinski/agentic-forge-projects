/**
 * @file examples/math-utils.js
 * @description A collection of example mathematical functions to demonstrate
 * the capabilities of the jsdoc-to-cli tool.
 *
 * Each exported function is a potential target for the CLI.
 *
 * To run an example:
 * npx jsdoc-to-cli examples/math-utils.js add --first-number 10 --second-number 5
 *
 * To see the help screen for a function:
 * npx jsdoc-to-cli examples/math-utils.js add --help
 */

/**
 * Adds two numbers together.
 * This is a basic example demonstrating required number parameters.
 *
 * @param {number} firstNumber The first number to add.
 * @param {number} secondNumber The second number to add.
 * @returns {number} The sum of the two numbers.
 */
export function add(firstNumber, secondNumber) {
  const sum = firstNumber + secondNumber;
  console.log(`The sum of ${firstNumber} and ${secondNumber} is ${sum}.`);
  return sum;
}

/**
 * Calculates the power of a base number raised to an exponent.
 * This example showcases a parameter with a default value.
 *
 * @param {number} base The base number.
 * @param {number} [exponent=2] The exponent to raise the base to.
 * @returns {number} The result of the power operation.
 */
export function power(base, exponent = 2) {
  const result = Math.pow(base, exponent);
  console.log(`${base} raised to the power of ${exponent} is ${result}.`);
  return result;
}

/**
 * Summarizes a list of numbers, with an option to display the result in a fancy way.
 * This function demonstrates a boolean flag and a default value in the JSDoc.
 *
 * @param {number} num1 The first number in the series.
 * @param {number} num2 The second number in the series.
 * @param {boolean} [isFancy=false] - If true, displays the result with a decorative message.
 * @param {string} [greeting="Calculation complete"] - A custom message to display upon completion.
 * @returns {object} An object containing the sum and the count of numbers.
 */
export function summarize(num1, num2, isFancy = false, greeting = 'Calculation complete') {
  const sum = num1 + num2;
  const result = { sum, count: 2 };

  if (isFancy) {
    console.log('✨ ~~~ FANCY RESULT ~~~ ✨');
    console.log(`The grand total is: ${sum}`);
    console.log('✨ ~~~~~~~~~~~~~~~~~~~~ ✨');
  } else {
    console.log(`Sum: ${sum}`);
  }

  console.log(`\n${greeting}!`);
  return result;
}

/**
 * A function with no parameters.
 * This demonstrates how the tool handles functions without any JSDoc `@param` tags.
 * The generated CLI will have no custom flags, only the default `--help`.
 *
 * @returns {string} A simple greeting message.
 */
export function sayHello() {
  const message = 'Hello from a parameter-less function!';
  console.log(message);
  return message;
}

/**
 * This function is NOT exported and therefore should not be callable by the CLI tool,
 * even though it has a valid JSDoc comment. This serves as a negative test case.
 *
 * @param {string} message A message that will never be seen.
 */
function privateFunction(message) {
  console.log(`This is a private function. Message: ${message}`);
}