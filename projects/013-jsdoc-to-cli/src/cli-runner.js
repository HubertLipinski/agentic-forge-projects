/**
 * @file src/cli-runner.js
 * @description Core logic that orchestrates the process: reads the file, parses JSDoc,
 * parses CLI arguments, validates inputs, casts types, and executes the target function.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseJsdoc } from './parser/jsdoc-parser.js';
import { castValue } from './utils/type-caster.js';
import { camelCaseToKebabCase } from './utils/text-formatter.js';

/**
 * A custom error class for CLI execution-related failures.
 * This helps distinguish runtime errors from parsing or I/O errors.
 */
class CliRunnerError extends Error {
  /**
   * @param {string} message The error message.
   */
  constructor(message) {
    super(message);
    this.name = 'CliRunnerError';
  }
}

/**
 * Dynamically imports a JavaScript module from a given file path.
 *
 * @param {string} filePath - The absolute path to the module.
 * @returns {Promise<object>} A promise that resolves to the imported module's exports.
 * @throws {CliRunnerError} If the module cannot be imported.
 */
async function importModule(filePath) {
  try {
    // Use a cache-busting query parameter to ensure the latest version of the file is loaded.
    // This is crucial for a tool that might be run multiple times on a changing file.
    // `pathToFileURL` is necessary for dynamic import on Windows.
    const moduleUrl = `${path.pathToFileURL(filePath).href}?t=${Date.now()}`;
    return await import(moduleUrl);
  } catch (error) {
    throw new CliRunnerError(
      `Failed to import module: ${filePath}. Reason: ${error.message}`
    );
  }
}

/**
 * Validates that all required parameters have been provided in the CLI arguments.
 * It checks the parsed JSDoc parameters against the provided CLI arguments.
 *
 * @param {Array<object>} params - The array of JSDoc parameter objects.
 * @param {object} cliArgs - The parsed CLI arguments from yargs-parser.
 * @throws {CliRunnerError} If a required parameter is missing.
 */
function validateRequiredParams(params, cliArgs) {
  const missingParams = [];

  for (const param of params) {
    // A parameter is considered missing if it's not optional, has no default value,
    // and is not present in the provided CLI arguments.
    if (!param.optional && param.default === undefined && cliArgs[param.name] === undefined) {
      missingParams.push(param.name);
    }
  }

  if (missingParams.length > 0) {
    const missingFlags = missingParams.map(p => `--${camelCaseToKebabCase(p)}`).join(', ');
    throw new CliRunnerError(`Missing required arguments: ${missingFlags}`);
  }
}

/**
 * Prepares the arguments for function execution by applying defaults, casting types,
 * and ordering them correctly.
 *
 * @param {Array<object>} params - The array of JSDoc parameter objects.
 * @param {object} cliArgs - The parsed CLI arguments.
 * @returns {Array<any>} An ordered array of arguments ready to be passed to the target function.
 */
function prepareFunctionArguments(params, cliArgs) {
  return params.map((param) => {
    const cliValue = cliArgs[param.name];

    // Priority: CLI value > JSDoc default > undefined
    let value = cliValue ?? param.default;

    // If the value is still undefined after checking CLI args and defaults,
    // and the param is optional, we pass `undefined`. Otherwise, validation
    // should have already caught the missing required param.
    if (value === undefined) {
      return undefined;
    }

    // Cast the value to its target type defined in JSDoc.
    // We cast even default values to ensure type consistency.
    try {
      return castValue(value, param.type);
    } catch (error) {
      // Re-throw with more context about which flag failed.
      const flag = `--${camelCaseToKebabCase(param.name)}`;
      throw new CliRunnerError(`Invalid value for flag ${flag}: ${error.message}`);
    }
  });
}

/**
 * The main orchestration function for the CLI.
 * It reads the target file, parses JSDoc and CLI args, validates, and executes the function.
 *
 * @param {string} filePath - The path to the user's script file.
 * @param {string} functionName - The name of the function to execute.
 * @param {object} cliArgs - The parsed command-line arguments.
 * @returns {Promise<any>} A promise that resolves with the return value of the executed function.
 */
export async function run(filePath, functionName, cliArgs) {
  const absoluteFilePath = path.resolve(process.cwd(), filePath);

  // 1. Parse JSDoc for the target function to get parameter metadata.
  const { params } = await parseJsdoc(absoluteFilePath, functionName);

  // 2. Validate that all required arguments were provided via the CLI.
  validateRequiredParams(params, cliArgs);

  // 3. Prepare the arguments for the function call (casting, defaults).
  const functionArgs = prepareFunctionArguments(params, cliArgs);

  // 4. Dynamically import the user's module.
  const userModule = await importModule(absoluteFilePath);
  const targetFunction = userModule[functionName];

  if (typeof targetFunction !== 'function') {
    throw new CliRunnerError(
      `Export "${functionName}" from ${filePath} is not a function.`
    );
  }

  // 5. Execute the target function with the prepared arguments.
  console.log(`Executing ${functionName}()...`);
  const result = await Promise.resolve(targetFunction(...functionArgs));

  return result;
}