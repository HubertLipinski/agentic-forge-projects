#!/usr/bin/env node

/**
 * @file bin/cli.js
 * @description The executable CLI script for starting the llm-log-streamer proxy server.
 *
 * This script serves as the entry point when the `llm-log-streamer` command is
 * run from the terminal. It is responsible for initializing and starting the
 * application's main functionality.
 *
 * It imports the main `start` function from the application's core logic (`src/index.js`)
 * and executes it. This separation keeps the CLI wrapper clean and delegates all
 * complex logic (configuration parsing, server setup, logging initialization)
 * to the main application modules.
 *
 * By centralizing the startup process in `src/index.js`, we ensure that the
 * application behaves consistently whether it's started via the CLI or imported
 * as a module.
 */

import { start } from '../src/index.js';

// The `start` function encapsulates the entire application lifecycle,
// including configuration parsing, logger setup, server creation, and
// graceful shutdown handling. Calling it here kicks off the proxy server.
start();