# JS Import Resolver

A command-line tool that analyzes a Node.js project to find and fix broken ES module imports. It scans for `ERR_MODULE_NOT_FOUND` errors, suggests corrections for typos, missing extensions (.js, .mjs, .cjs), and incorrect relative paths. Ideal for developers migrating projects to ESM or refactoring large codebases.

## Features

-   **Static Analysis**: Scans `import` and `export` statements in `.js`, `.mjs`, and `.cjs` files.
-   **Error Detection**: Finds common import errors like typos, missing file extensions, and incorrect relative paths.
-   **Smart Suggestions**: Uses Levenshtein distance for typo correction and suggests path and extension fixes.
-   **Interactive Mode**: Apply suggested fixes one by one with a simple command-line prompt.
-   **Automatic Fixes**: Automatically apply all "safe" fixes (those with a single, verifiable suggestion).
-   **Watch Mode**: Use `--watch` to continuously scan for broken imports during development.
-   **Modern JS Support**: Respects `exports` in `package.json` for module resolution.
-   **Configurable**: (Coming soon) Configure custom rules and ignored paths via `import-resolver.config.js`.

## Installation

You can install the tool globally to use it in any project:

```bash
npm install -g js-import-resolver
```

Alternatively, you can install it as a development dependency in your project:

```bash
npm install --save-dev js-import-resolver
```

If installed locally, you'll need to run it via `npx` or add it to your `package.json` scripts.

## Usage

The tool provides two main commands: `scan` and `fix`.

### `scan`

Analyzes your project and reports any broken imports it finds, along with suggestions. This command does not modify any files.

**Usage:**
`resolve-imports scan [path] [options]`

**Arguments:**
- `path`: The path to the project directory to scan (defaults to the current directory).

**Options:**
- `--watch`: Run in watch mode to re-analyze on file changes.
- `--verbose`: Show detailed error reasons for each broken import.
- `-h, --help`: Display help for the command.

**Example:**
```bash
# Run a single scan on the current project
resolve-imports scan

# Run in watch mode for continuous feedback
resolve-imports scan --watch
```

### `fix`

Analyzes your project and provides an interface to fix broken imports.

**Usage:**
`resolve-imports fix [path] [options]`

**Arguments:**
- `path`: The path to the project directory to fix (defaults to the current directory).

**Options:**
- `--interactive`: Enter an interactive mode to approve or reject each fix individually.
- `-h, --help`: Display help for the command.

**Example:**
```bash
# Automatically apply all "safe" fixes
resolve-imports fix

# Start an interactive session to review each fix
resolve-imports fix --interactive
```

## Examples

### Example 1: Scanning for Errors

Imagine you have a file `src/index.js` with a typo in an import:

```javascript
// src/index.js
import { something } from './util/helpers.js'; // Should be './utils/helpers.js'
```

Running the `scan` command will produce a report like this:

```bash
$ resolve-imports scan

--- Analysis Report ---

src/index.js
  ✖ Broken import: 'util/helpers.js'
    Suggestions:
      › ./utils/helpers.js

ℹ Found 1 problem in 1 file.
ℹ Run with fix command to apply suggestions.
```

### Example 2: Automatic Fixing

Given the same error as above, running the `fix` command without any flags will automatically apply the single, verifiable suggestion.

```bash
$ resolve-imports fix

--- Analysis Report ---
# ... (same report as above) ...

Attempting to apply safe fixes automatically...
A fix is "safe" if it has a single, verifiable suggestion.
  ✔ Fixed: In src/index.js, replaced 'util/helpers.js' → './utils/helpers.js'

✔ Successfully applied 1 fix across 1 file.
```

The file `src/index.js` will be updated to:
```javascript
// src/index.js
import { something } from './utils/helpers.js';
```

### Example 3: Interactive Fixing

If an import has multiple possible suggestions, the interactive mode lets you choose the correct one.

Suppose `src/app.js` has a broken import:
```javascript
// src/app.js
import { logger } from './loger'; // Could be 'logger.js' or 'log.js'
```

Running `resolve-imports fix --interactive` will prompt you:

```bash
$ resolve-imports fix --interactive

# ... (analysis report) ...

Starting interactive fixing mode...

In file src/app.js:
  Broken import: './loger'
  Please choose a fix from the options below:
    1: ./logger.js
    2: ./log.js
    s: Skip this fix
    q: Quit interactive mode
? Your choice (1-2, s, q): 1

  ✔ Fixed: In src/app.js, replaced './loger' → './logger.js'

✔ Successfully applied 1 fix across 1 file.
```

## License

[MIT](LICENSE)