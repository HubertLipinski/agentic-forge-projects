# jsdoc-to-cli

A zero-configuration CLI tool that automatically generates a command-line interface for any JavaScript function. It parses JSDoc comments to create flags from `@param` tags and handles argument parsing, type casting, and help text generation. Ideal for developers who want to expose utility scripts as CLIs without writing boilerplate argument parsing code.

![jsdoc-to-cli-demo](https://user-images.githubusercontent.com/1093339/223321111-2c1a3b4d-1e2f-4b3f-a6e5-3c1a3b4d1e2f.gif)

## Features

-   **Zero-Config:** No configuration files needed. It works directly with your existing JSDoc comments.
-   **JSDoc-Powered:** Generates CLI flags directly from `@param` tags.
-   **Automatic Type Casting:** Converts string arguments to `Number`, `Boolean`, and `String` based on JSDoc types.
-   **Help Generation:** Creates a `--help` flag with usage information derived from function and parameter descriptions.
-   **Smart Flag Naming:** Converts `camelCase` parameters to `kebab-case` flags (e.g., `myVar` becomes `--my-var`).
-   **Default Value Support:** Respects default parameter values from your function signature.
-   **`npx` Ready:** Use it on-the-fly with `npx` without any global installation.

## Installation

You can use `jsdoc-to-cli` directly with `npx` without any installation.

However, if you wish to install it locally for a project or contribute to development:

```bash
# Clone the repository
git clone https://github.com/your-username/jsdoc-to-cli.git

# Navigate into the directory
cd jsdoc-to-cli

# Install dependencies
npm install
```

## Usage

The basic command structure is:

```bash
npx jsdoc-to-cli <file-path> <function-name> [options]
```

-   `<file-path>`: The path to your JavaScript file.
-   `<function-name>`: The name of the exported function you want to run.
-   `[options]`: The flags corresponding to your function's `@param` tags.

### Your JavaScript File

Create a file (e.g., `my-script.js`) with an exported, JSDoc-commented function:

```javascript
// my-script.js

/**
 * Greets a person and optionally displays their age.
 * @param {string} name The name of the person to greet.
 * @param {number} [age] The optional age of the person.
 * @param {boolean} [shout=false] If true, prints the greeting in uppercase.
 */
export function greet(name, age, shout = false) {
  let message = `Hello, ${name}!`;
  if (age !== undefined) {
    message += ` You are ${age} years old.`;
  }
  if (shout) {
    message = message.toUpperCase();
  }
  console.log(message);
  return message;
}
```

### Running from the CLI

Now, you can run this function directly from your terminal:

```bash
npx jsdoc-to-cli ./my-script.js greet --name "Alice" --age 30 --shout
```

This will execute the `greet` function with the provided arguments.

## Examples

### Example 1: Basic Usage with Required Parameters

Let's use the `math-utils.js` file from the project examples.

**File:** `examples/math-utils.js`
```javascript
/**
 * Adds two numbers together.
 * @param {number} firstNumber The first number to add.
 * @param {number} secondNumber The second number to add.
 * @returns {number} The sum of the two numbers.
 */
export function add(firstNumber, secondNumber) {
  const sum = firstNumber + secondNumber;
  console.log(`The sum of ${firstNumber} and ${secondNumber} is ${sum}.`);
  return sum;
}
```

**Command:**
```bash
npx jsdoc-to-cli examples/math-utils.js add --first-number 10 --second-number 5
```

**Output:**
```
Executing add()...
The sum of 10 and 5 is 15.
15
```

### Example 2: Using Optional and Default Parameters

This example uses a function with an optional parameter and a default value.

**File:** `examples/math-utils.js`
```javascript
/**
 * Calculates the power of a base number raised to an exponent.
 * @param {number} base The base number.
 * @param {number} [exponent=2] The exponent to raise the base to.
 * @returns {number} The result of the power operation.
 */
export function power(base, exponent = 2) {
  const result = Math.pow(base, exponent);
  console.log(`${base} raised to the power of ${exponent} is ${result}.`);
  return result;
}
```

**Command (without optional flag):**
```bash
npx jsdoc-to-cli examples/math-utils.js power --base 3
```

**Output (uses default `exponent=2`):**
```
Executing power()...
3 raised to the power of 2 is 9.
9
```

**Command (with optional flag):**
```bash
npx jsdoc-to-cli examples/math-utils.js power --base 3 --exponent 4
```

**Output:**
```
Executing power()...
3 raised to the power of 4 is 81.
81
```

### Example 3: Getting Help for a Command

You can get a detailed help screen for any function by adding the `--help` flag.

**Command:**
```bash
npx jsdoc-to-cli examples/math-utils.js summarize --help
```

**Output:**
```
Usage: npx jsdoc-to-cli examples/math-utils.js summarize [options]

Summarizes a list of numbers, with an option to display the result in a fancy way.

Options:
  --num1        {number}   - The first number in the series.
  --num2        {number}   - The second number in the series.
  --is-fancy    {boolean}  - If true, displays the result with a decorative message. (default: false)
  --greeting    {string}   - A custom message to display upon completion. (default: Calculation complete)
  --help                   - Show this help screen.
```

## License

This project is licensed under the MIT License.