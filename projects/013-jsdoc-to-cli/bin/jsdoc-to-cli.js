#!/usr/bin/env node

/**
 * @file bin/jsdoc-to-cli.js
 * @description The executable entry point for the jsdoc-to-cli command.
 * It handles initial argument parsing, help flag logic, and orchestrates
 * the execution of the target user function.
 */

import path from 'node:path';
import { parseCliArgs } from '../src/parser/argument-parser.js';
import { parseJsdoc } from '../src/parser/jsdoc-parser.js';
import { generateHelpScreen } from '../src/utils/text-formatter.js';
import { run } from '../src/cli-runner.js';

/**
 * Displays a formatted help screen for a given function and exits the process.
 * This is triggered when the --help flag is used or when essential arguments are missing.
 *
 * @param {string} [filePath] - The path to the user's script file.
 * @param {string} [functionName] - The name of the target function.
 * @returns {Promise<void>} A promise that resolves after logging, before exiting.
 */
async function showHelpAndExit(filePath, functionName) {
  // If we have enough info, generate a detailed help screen.
  if (filePath && functionName) {
    try {
      const absoluteFilePath = path.resolve(process.cwd(), filePath);
      const { functionDescription, params } = await parseJsdoc(
        absoluteFilePath,
        functionName
      );
      const helpText = generateHelpScreen({
        filePath,
        functionName,
        functionDescription,
        params,
      });
      console.log(helpText);
      process.exit(0);
    } catch (error) {
      // If parsing fails (e.g., file not found), fall back to the generic usage message.
      console.error(`Error generating help: ${error.message}`);
      // Fallthrough to show generic help
    }
  }

  // Generic help for when file/function is unknown.
  console.log('JSDoc-to-CLI: Automatically generate a CLI from a JSDoc-commented function.\n');
  console.log('Usage: npx jsdoc-to-cli <file-path> <function-name> [options]');
  console.log('\nExample: npx jsdoc-to-cli ./my-script.js myFunc --name "World"');
  console.log('\nUse the --help flag after specifying a file and function for more details:');
  console.log('  npx jsdoc-to-cli <file-path> <function-name> --help');
  process.exit(1); // Exit with an error code as this indicates incorrect usage.
}

/**
 * The main execution function for the CLI.
 * It parses arguments, handles the --help flag, and invokes the core runner logic.
 *
 * @param {string[]} argv - The command-line arguments array, typically `process.argv`.
 */
export async function main(argv) {
  try {
    const args = parseCliArgs(argv);
    const [filePath, functionName, ...rest] = args._;

    // Handle cases where required positional arguments are missing.
    if (!filePath || !functionName) {
      // If --help is present without file/function, show generic help.
      if (args.help) {
        await showHelpAndExit();
      }
      console.error('Error: Missing required arguments: <file-path> and <function-name>.\n');
      await showHelpAndExit();
      return; // Should be unreachable due to process.exit, but good practice.
    }

    // If there are unexpected positional arguments, it's likely a user error.
    if (rest.length > 0) {
        console.warn(`Warning: Ignoring unexpected positional arguments: ${rest.join(', ')}`);
    }

    // If the --help flag is present with file and function, show specific help.
    if (args.help) {
      await showHelpAndExit(filePath, functionName);
      return;
    }

    // Proceed with the main execution logic.
    const result = await run(filePath, functionName, args);

    // Output the result if it's not undefined. This allows scripts to return
    // values that can be piped or used in other shell commands.
    if (result !== undefined) {
      // For objects or arrays, JSON.stringify provides a clean, readable output.
      // For primitives, it just prints the value.
      if (typeof result === 'object' && result !== null) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result);
      }
    }

    process.exit(0);
  } catch (error) {
    // Catch and display errors gracefully to the user.
    console.error(`\n❌ Error: ${error.message}`);
    // For developers running this in debug mode, the stack trace is useful.
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    process.exit(1);
  }
}

// Execute the main function with the process arguments.
// This check ensures the script only runs when executed directly.
if (process.argv[1] && (process.argv[1].endsWith('jsdoc-to-cli.js') || process.argv[1].endsWith('jsdoc-to-cli'))) {
    main(process.argv);
}