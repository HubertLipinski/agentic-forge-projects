#!/usr/bin/env node

/**
 * @file bin/auto-pr-merger.js
 * @description The executable script for the CLI, making it runnable from the command line.
 *
 * This script serves as the entry point for the command-line interface. It's what gets
 * executed when a user runs `auto-pr-merger` in their terminal. Its sole responsibility
 * is to import and execute the main CLI logic from `src/modes/cli.js`. This separation
 * keeps the executable file clean and delegates all complex logic to the main source code.
 */

import { runCli } from '../src/modes/cli.js';

// The shebang `#!/usr/bin/env node` at the top of this file ensures that this script
// is executed with the Node.js runtime. The `runCli` function contains all the
// logic for parsing arguments, loading configuration, and processing the repository.
// By calling it here, we kick off the entire CLI application.
runCli();