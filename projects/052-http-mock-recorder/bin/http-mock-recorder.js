#!/usr/bin/env node

/**
 * HTTP Mock Recorder - CLI Executable
 *
 * This is the entry point for the `http-mock-recorder` command-line tool.
 * It's responsible for parsing command-line arguments and invoking the main
 * CLI logic defined in `src/cli.js`.
 *
 * The shebang `#!/usr/bin/env node` ensures that this script is executed
 * with the Node.js interpreter when run from the command line.
 *
 * This file is kept minimal by design, delegating all complex logic to the
 * `src/cli.js` module. This improves testability and maintains a clear
 * separation of concerns, where this file is purely the "executable" layer.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 * @see {@link ../src/cli.js} for the main implementation.
 */

// Import the main CLI function from the `src/cli.js` module.
// We use an ES module import, consistent with the project's "type": "module" setting.
import { main } from '../src/cli.js';

// Execute the main CLI logic, passing the command-line arguments.
// `process.argv` contains all arguments, including the node executable and
// the script path. The `main` function, which uses `yargs`, expects this
// full array to correctly parse the user's command.
main(process.argv);