/**
 * @file src/generator/code-formatter.js
 * @description Post-processes generated code using Prettier and ESLint.
 *
 * This module provides functionality to format and lint generated code strings
 * using the programmatic APIs of Prettier and ESLint. This ensures that all
 * output from the generator is clean, consistently formatted, and adheres to
 * best practices, making it production-ready.
 */

import { ESLint } from 'eslint';
import prettier from 'prettier';
import path from 'node:path';

// --- Prettier Configuration ---

/**
 * Default Prettier configuration for formatting generated code.
 * This ensures a consistent and readable style for the output.
 * @type {import('prettier').Options}
 */
const PRETTIER_CONFIG = {
  parser: 'babel', // Use babel parser for modern JavaScript syntax
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  printWidth: 80,
  tabWidth: 2,
};

// --- ESLint Configuration ---

/**
 * A singleton instance of ESLint.
 * Initializing ESLint can be slow, so we create one instance and reuse it.
 * This instance is configured to fix linting errors automatically.
 * @type {ESLint | null}
 */
let eslintInstance = null;

/**
 * Initializes and returns a singleton ESLint instance.
 * @returns {ESLint} The configured ESLint instance.
 */
function getEslintInstance() {
  if (!eslintInstance) {
    eslintInstance = new ESLint({
      // `fix: true` enables ESLint to apply automatic fixes to the code.
      fix: true,
      // `useEslintrc: false` prevents ESLint from searching for and using
      // `.eslintrc` files from the user's project or filesystem. We want
      // a self-contained, predictable linting environment.
      useEslintrc: false,
      // Define the base configuration for linting generated code.
      overrideConfig: {
        env: {
          es2022: true, // Supports modern ES syntax
          node: true, // Defines Node.js global variables and scope
        },
        extends: ['eslint:recommended'],
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
        },
        // Define rules for the generated code. We can be more or less strict here.
        // For example, we might disable 'no-unused-vars' if we know the generator
        // sometimes creates placeholders that will be used by the user.
        rules: {
          'no-console': 'warn', // Warn about console logs in generated server code
          'no-unused-vars': [
            'warn',
            { args: 'none', ignoreRestSiblings: true },
          ],
        },
      },
    });
  }
  return eslintInstance;
}

/**
 * Formats a JavaScript code string using Prettier.
 *
 * @param {string} code - The raw JavaScript code string to format.
 * @returns {Promise<string>} A promise that resolves to the formatted code string.
 * @throws {Error} If Prettier fails to format the code.
 */
async function formatWithPrettier(code) {
  try {
    // `prettier.format` is an async function that takes the code and options.
    return await prettier.format(code, PRETTIER_CONFIG);
  } catch (error) {
    // Provide context if Prettier encounters a syntax error it can't handle.
    console.error('Prettier formatting failed. This might indicate a syntax error in the generated code.');
    throw new Error(`Prettier error: ${error.message}`);
  }
}

/**
 * Lints and fixes a JavaScript code string using ESLint.
 *
 * @param {string} code - The JavaScript code string to lint.
 * @param {string} filePath - The virtual file path for the code, used by ESLint for context.
 * @returns {Promise<string>} A promise that resolves to the linted and fixed code string.
 * @throws {Error} If ESLint fails during the process.
 */
async function lintWithEslint(code, filePath) {
  const eslint = getEslintInstance();
  try {
    // `lintText` processes a string as if it were a file.
    const results = await eslint.lintText(code, { filePath });

    // We expect exactly one result object for the single string we passed.
    const [result] = results;

    // `result.output` contains the fixed code if fixes were applied.
    // If no fixes were needed, `output` may be undefined, so we fall back
    // to the original source code from the result object.
    return result?.output ?? result?.source ?? code;
  } catch (error) {
    console.error(`ESLint failed for virtual path "${filePath}".`);
    throw new Error(`ESLint error: ${error.message}`);
  }
}

/**
 * Formats and lints a given JavaScript code string.
 *
 * This function orchestrates the post-processing of generated code. It first
 * formats the code with Prettier for consistent style, and then runs ESLint
 * to apply automatic fixes for common issues. This two-step process ensures
 * the final code is both beautiful and robust.
 *
 * @param {string} code - The raw JavaScript code to process.
 * @param {string} outputFileName - The target filename for the code (e.g., 'server.js').
 *        This is used to provide context to the linters.
 * @returns {Promise<string>} A promise that resolves to the fully formatted and linted code.
 * @throws {Error} If either the formatting or linting process fails.
 */
export async function formatAndLintCode(code, outputFileName = 'generated.js') {
  if (typeof code !== 'string') {
    throw new Error('Invalid input: `code` must be a string.');
  }

  try {
    // Step 1: Format with Prettier to establish a consistent style.
    const formattedCode = await formatWithPrettier(code);

    // Step 2: Lint and apply fixes with ESLint.
    // We provide a virtual file path so ESLint can apply path-based rules if any.
    const lintedCode = await lintWithEslint(
      formattedCode,
      path.join(process.cwd(), outputFileName),
    );

    return lintedCode;
  } catch (error) {
    // Log the intermediate failure but re-throw a more generic error to the caller.
    console.error(
      `Failed to format and lint code for "${outputFileName}". The original (unformatted) code may be used.`,
    );
    // The specific error from Prettier/ESLint will be logged by the helper functions.
    // We re-throw to allow the caller to decide how to handle the failure.
    throw new Error(`Code processing failed: ${error.message}`);
  }
}