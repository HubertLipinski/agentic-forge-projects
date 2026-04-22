#!/usr/bin/env node

/**
 * @file bin/env-var-mapper.js
 * @description The executable entry point for the `env-var-mapper` CLI tool.
 * This script is responsible for initiating the command-line interface logic.
 *
 * It is designed to be run directly from the command line after the package
 * is installed globally or via `npx`. It keeps its own logic minimal,
 * delegating the complex work of argument parsing and execution to the
 * main CLI module (`src/cli.js`).
 *
 * The `#!/usr/bin/env node` shebang ensures that the script is executed
 * with the Node.js interpreter available in the user's environment.
 */

// Use a self-invoking async function to handle top-level await and
// ensure a clean exit process. This pattern is robust and allows for
// proper error handling at the application's root.
(async () => {
  try {
    // Dynamically import the main CLI runner function.
    // This keeps the executable file clean and focused on its single
    // responsibility: starting the application.
    const { run } = await import('../src/cli.js');

    // Pass the process arguments (e.g., `node`, `script.js`, `arg1`, `arg2`)
    // to the CLI runner. The runner will handle parsing and execution.
    await run(process.argv);
  } catch (error) {
    // This is a top-level, last-resort error handler.
    // It catches any unhandled exceptions during the application's startup
    // or execution, such as a failure to import the main module or a
    // catastrophic, uncaught error within the application logic itself.
    // The `chalk` dependency might not be available here if the import fails,
    // so we use standard `console.error` for maximum reliability.
    console.error('A critical error occurred and the application could not start.');
    console.error('Error:', error.message);

    // Exit with a non-zero status code to signal failure to shell scripts
    // or CI/CD pipelines.
    process.exit(1);
  }
})();