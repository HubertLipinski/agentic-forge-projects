#!/usr/bin/env node

/**
 * @fileoverview The executable file for the CLI, making it runnable from the
 * command line after installation. This script is the entry point defined in
 * `package.json`'s "bin" field.
 *
 * It imports and executes the main CLI logic from `src/cli.js`.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 * @project JSDoc to Zod Schema Generator
 */

import { run } from '../src/cli.js';

// The `run` function encapsulates all CLI logic, including argument parsing,
// file processing, and error handling. We pass `process.argv` to it, which
// contains all command-line arguments provided by the user.
// e.g., `node bin/jsdoc-to-zod.js src/**/*.js -o generated/schemas.js`
run(process.argv).catch(error => {
	// The `run` function already handles logging friendly error messages to the console
	// and calls `process.exit(1)`. This catch block is a final safeguard against
	// any unhandled promise rejections that might bubble up, preventing them
	// from crashing the process with an unhandled rejection warning.
	// In a production CLI, it's good practice to ensure all exit paths are controlled.
	console.error('[jsdoc-to-zod] A critical unhandled error occurred. Exiting.');
	// The error object itself is not logged here because the `run` function's
	// internal try/catch is expected to have already logged a more user-friendly message.
	process.exit(1);
});