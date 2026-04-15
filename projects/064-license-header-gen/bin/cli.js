#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The command-line interface (CLI) executable for the License Header Generator.
 *
 * This script is the entry point when the tool is run from the terminal. It's responsible for:
 * 1. Setting up the Node.js environment.
 * 2. Importing and invoking the main application logic from `src/index.js`.
 * 3. Handling top-level errors and ensuring the process exits with an appropriate status code.
 *
 * The use of a separate `cli.js` file in `bin/` is a standard practice for Node.js
 * CLI applications, cleanly separating the executable "shim" from the core library code.
 */

// Ensure the process runs with ES module support.
// The `#!/usr/bin/env node` shebang at the top of the file makes this script executable.

import { run } from '../src/index.js';

/**
 * The main execution wrapper for the CLI.
 * This function captures command-line arguments and passes them to the core application logic.
 * It also handles uncaught exceptions and sets the process exit code.
 */
async function main() {
  try {
    // `process.argv.slice(2)` provides the arguments passed to the script,
    // excluding the node executable and the script path itself.
    const args = process.argv.slice(2);
    await run(args);
    // A clean exit with status 0 indicates success.
    process.exit(0);
  } catch (error) {
    // A centralized catch block for any unhandled errors from the application logic.
    // This ensures that users receive a clear error message and the shell
    // knows the command failed.
    console.error(`\n❌ An unexpected error occurred: ${error.message}`);
    // Exit with a non-zero status code to indicate failure, which is crucial for scripting and CI/CD pipelines.
    process.exit(1);
  }
}

// Invoke the main function to start the CLI application.
main();