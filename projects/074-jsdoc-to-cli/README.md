# jsdoc-to-cli

A zero-configuration code generator that creates a command-line interface (CLI) directly from JSDoc annotations in your JavaScript files. It allows developers to expose functions as CLI commands automatically, parsing arguments, flags, and descriptions from their existing documentation.

![Demo GIF showing jsdoc-to-cli in action](https://example.com/demo.gif) <!-- Placeholder for a demo GIF -->

## Features

-   **Automatic Command Discovery**: Finds exported functions in your files using glob patterns.
-   **JSDoc-Powered**: Parses `@param`, `@returns`, and function descriptions to build your CLI.
-   **Smart Argument & Option Parsing**:
    -   Required parameters (`@param {string} name`) become CLI arguments (`<name>`).
    -   Optional parameters (`@param {string} [name]`) become CLI options (`--name <value>`).
-   **Type Inference**: `@param {boolean}` creates a boolean flag (e.g., `--force`), and `@param {number}` handles numeric input.
-   **Help Text Generation**: Function and parameter descriptions are used to generate rich `--help` output for each command.
-   **Zero-Config By Default**: Works out of the box by searching for `src/**/*.js` and creating `bin/cli.js`.
-   **Configurable**: Customize input files and output path via a `jsdoc-to-cli.config.js` file or command-line arguments.

## Installation

You can install `jsdoc-to-cli` as a development dependency in your project.

```bash
npm install --save-dev jsdoc-to-cli
```

It's recommended to add a script to your `package.json` to run the generator:

```json
{
  "scripts": {
    "build:cli": "jsdoc-to-cli"
  }
}
```

## Usage

### 1. Write JSDoc-annotated Functions

Create one or more JavaScript files with exported functions. Annotate them with JSDoc comments. The generator will turn each exported function into a CLI command.

**`src/utils.js`**
```javascript
/**
 * Greets a user with a customizable message.
 *
 * @param {string} name The name of the person to greet.
 * @param {string} [greeting='Hello'] The greeting to use.
 * @param {boolean} [loud=false] If true, prints the message in uppercase.
 */
export function greet(name, { greeting = 'Hello', loud = false } = {}) {
  let message = `${greeting}, ${name}!`;
  if (loud) {
    message = message.toUpperCase();
  }
  console.log(message);
}
```

### 2. Generate the CLI

Run the generator from your terminal. By default, it looks for `src/**/*.js`.

```bash
npm run build:cli
```

This command will:
1.  Find `src/utils.js`.
2.  Parse the JSDoc for the `greet` function.
3.  Generate a new executable file at `bin/generated-cli.js`.

### 3. Run Your New CLI

Your new CLI is ready to use. You can link it in `package.json`'s `bin` field to make it globally available or run it directly.

```bash
# See the generated help text
./bin/generated-cli.js greet --help

# Run the command
./bin/generated-cli.js greet "World"
# Output: Hello, World!

# Use the optional flags
./bin/generated-cli.js greet "Galaxy" --greeting "Welcome" --loud
# Output: WELCOME, GALAXY!
```

### Configuration

You can configure the input and output paths in two ways:

**Using `jsdoc-to-cli.config.js` (Recommended)**

Create a `jsdoc-to-cli.config.js` file in your project root:

```javascript
// jsdoc-to-cli.config.js
export default {
  input: ['lib/**/*.js', 'tools/scripts.js'],
  output: 'dist/my-cli.js',
};
```

**Using CLI Arguments**

Override the configuration by passing arguments directly:

```bash
jsdoc-to-cli "api/**/*.js" --output "bin/api-tool"
```

## Examples

### Example 1: Basic Math Functions

Given the following file `src/math.js`:

```javascript
/**
 * Adds two numbers and returns the sum.
 * @param {number} a The first number.
 * @param {number} b The second number.
 * @returns {number} The sum.
 */
export function add(a, b) {
  return Number(a) + Number(b);
}

/**
 * Calculates the power of a number.
 * @param {number} base The base number.
 * @param {number} [exponent=2] The exponent to raise the base to.
 * @returns {number} The result.
 */
export function power(base, exponent = 2) {
  return Math.pow(Number(base), Number(exponent));
}
```

Running `jsdoc-to-cli` generates a CLI that you can use like this:

```bash
# Add two numbers
$ ./bin/cli add 10 5
15

# Calculate a power with the default exponent
$ ./bin/cli power 3
9

# Calculate a power with a specific exponent
$ ./bin/cli power 3 --exponent 4
81
```

### Example 2: File Operations

Given a file `src/files.js` with a function to create a file:

```javascript
import fs from 'node:fs/promises';

/**
 * Creates a file with the given content.
 * @param {string} filepath The path to the new file.
 * @param {string} [content=''] The content to write to the file.
 * @param {boolean} [overwrite=false] If true, overwrites the file if it exists.
 */
export async function createFile(filepath, { content = '', overwrite = false } = {}) {
  if (!overwrite) {
    try {
      await fs.access(filepath);
      // File exists, throw error
      throw new Error(`File already exists: ${filepath}. Use --overwrite to replace it.`);
    } catch (err) {
      // File doesn't exist, which is what we want.
    }
  }
  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`Successfully created ${filepath}`);
}
```

The generated CLI would work as follows:

```bash
# Create an empty file
$ ./bin/cli create-file "hello.txt"
Successfully created hello.txt

# Create a file with content and overwrite it
$ ./bin/cli create-file "config.json" --content "{}" --overwrite
Successfully created config.json

# Attempt to create a file that exists without the overwrite flag
$ ./bin/cli create-file "hello.txt"
[Error] File already exists: hello.txt. Use --overwrite to replace it.
```

## License

This project is licensed under the MIT License.