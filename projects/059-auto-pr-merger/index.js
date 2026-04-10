/**
 * @file index.js
 * @description Main entry point that determines whether to run in CLI or Action mode.
 *
 * This script acts as a router for the application's execution. It inspects
 * environment variables to determine if it's running within the context of a
 * GitHub Action (`GITHUB_ACTIONS` is 'true') or as a standalone script.
 *
 * - If in a GitHub Action environment, it imports and executes `runAction` from `src/modes/action.js`.
 * - Otherwise, it assumes a CLI context and imports and executes `runCli` from `src/modes/cli.js`.
 *
 * This approach allows the same codebase to power both the GitHub Action and the CLI tool,
 * ensuring consistent behavior across different execution modes. The distinction is made
 * right at the entry point, leading to a clean separation of concerns for each mode's
 * specific setup and teardown logic (e.g., reading action inputs vs. parsing command-line arguments).
 */

import { runAction } from './src/modes/action.js';
import { runCli } from './src/modes/cli.js';

/**
 * Determines if the application is running in the context of a GitHub Action.
 * The `GITHUB_ACTIONS` environment variable is always set to `true` in the GitHub Actions runner environment.
 * @see {@link https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables}
 *
 * @returns {boolean} `true` if running in a GitHub Action, `false` otherwise.
 */
function isGitHubAction() {
  return process.env.GITHUB_ACTIONS === 'true';
}

/**
 * The main execution function.
 * It checks the environment and delegates to the appropriate mode handler.
 * This function is self-invoking to start the application.
 */
(async () => {
  try {
    if (isGitHubAction()) {
      // Running in GitHub Action mode.
      // The `runAction` function will handle reading inputs from the action's context
      // and setting outputs or failing the action step.
      await runAction();
    } else {
      // Running in CLI mode.
      // The `runCli` function will handle parsing command-line arguments,
      // reading environment variables for the token, and setting process exit codes.
      await runCli();
    }
  } catch (error) {
    // This is a top-level catch block, primarily for unexpected errors that might
    // occur during the dynamic import or initial setup phase of the modes.
    // Both `runAction` and `runCli` have their own comprehensive error handling,
    // so an error reaching this point would be exceptional.
    console.error(
      'A fatal error occurred during application startup:',
      error.message
    );
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
})();