#!/usr/bin/env node

/**
 * @file bin/mutate.js
 * @description
 * This is the executable entry point for the JavaScript Code Mutation Tester CLI.
 * It's responsible for setting up the Node.js environment and invoking the main
 * CLI logic located in `src/cli.js`.
 *
 * The `#!/usr/bin/env node` shebang ensures that this script is executed with the
 * Node.js interpreter available in the user's PATH, making the CLI command
 * portable across different environments.
 */

// We import the main CLI function and immediately execute it.
// This separation keeps the executable file clean and delegates all
// complex logic (argument parsing, orchestration, error handling)
// to the main application source code in `src/cli.js`.
import { run } from '../src/cli.js';

// The `run` function is asynchronous and contains the top-level try/catch
// block for the entire application. We don't need to wrap this call in
// another try/catch here. If an unhandled promise rejection occurs within
// `run`, Node.js will terminate the process with a non-zero exit code,
// which is the desired behavior for a failing CLI tool.
run();