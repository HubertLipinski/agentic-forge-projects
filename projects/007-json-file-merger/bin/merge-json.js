#!/usr/bin/env node

/**
 * @file The main executable for the json-file-merger CLI.
 * This script is the entry point defined in `package.json`'s `bin` field.
 * It ensures the application can be run directly from the command line.
 */

// This file is intentionally simple. It serves as the executable bridge
// to the main application logic, which resides in the `src` directory.
// This separation keeps the executable clean and allows the core application
// logic (`src/index.js`) to be potentially imported and used programmatically
// by other modules without immediately executing the CLI.

import '../src/index.js';