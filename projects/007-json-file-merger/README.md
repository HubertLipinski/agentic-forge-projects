# JSON File Merger

A lightweight command-line utility for intelligently merging multiple JSON or JSON5 files into a single output file. It supports deep merging of objects and concatenation of arrays, making it ideal for managing configuration files across different environments (e.g., `base.json`, `development.json`, `production.json`).

## Features

-   **CLI Interface**: Simple and powerful command-line interface for specifying inputs and options.
-   **Glob Support**: Use glob patterns to easily select multiple files (e.g., `config/**/*.json`).
-   **Deep Merging**: Intelligently merges nested objects by default.
-   **JSON5 Support**: Natively handles JSON5 files, allowing for comments, trailing commas, and more.
-   **Configurable Array Strategy**: Choose how to merge arrays: `concat` (default), `replace`, or `merge`.
-   **Watch Mode**: Automatically re-merge files when changes are detected.
-   **Verbose Logging**: Colorized, detailed logging to help debug the merge process.
-   **Pretty-Printing**: Formats the output JSON for human readability.

## Installation

You can install the tool globally via npm to use it from anywhere on your system:

```bash
npm install -g json-file-merger
```

Alternatively, you can clone the repository and run it locally:

```bash
git clone https://github.com/your-username/json-file-merger.git
cd json-file-merger
npm install
# Run using npm scripts or directly
node bin/merge-json.js --help
```

## Usage

The basic command structure is `merge-json [options] <input-files...>`

### Command

`merge-json <inputs...>`

-   **inputs...**: One or more input files or glob patterns. The order is important: later files override earlier ones.

### Options

| Option                | Alias | Description                                                               | Default     |
| --------------------- | ----- | ------------------------------------------------------------------------- | ----------- |
| `--output <path>`     | `-o`  | Path to the output file. Prints to stdout if omitted.                     | `stdout`    |
| `--array-merge <val>` | `-a`  | Array merge strategy: `concat`, `replace`, or `merge`.                    | `concat`    |
| `--watch`             | `-w`  | Watch files for changes and re-merge automatically.                       | `false`     |
| `--verbose`           | `-v`  | Enable verbose logging for debugging.                                     | `false`     |
| `--pretty-print <n>`  | `-p`  | Indent output JSON with `n` spaces.                                       | `2`         |
| `--help`              | `-h`  | Show help information.                                                    |             |

### Array Merging Strategies

-   **`concat` (default)**: Appends arrays from the source object to the target object.
    -   `[1, 2]` + `[3, 4]` = `[1, 2, 3, 4]`
-   **`replace`**: Replaces the entire target array with the source array.
    -   `[1, 2]` + `[3, 4]` = `[3, 4]`
-   **`merge`**: Deeply merges arrays by merging objects at the same index. Other elements are replaced.
    -   `[{ "a": 1 }]` + `[{ "b": 2 }]` = `[{ "a": 1, "b": 2 }]`

## Examples

Let's assume we have two configuration files: `base.json` and `development.json5`.

**`examples/base.json`**
```json
{
  "api": {
    "baseUrl": "https://api.example.com/v1",
    "timeout": 5000
  },
  "plugins": [
    "plugin-A",
    "plugin-B"
  ]
}
```

**`examples/development.json5`**
```json5
// Development overrides
{
  api: {
    // Use a local dev server
    baseUrl: "http://localhost:3000/api/v1",
  },
  // Add a dev-specific plugin
  plugins: [
    "plugin-dev-tools",
  ],
}
```

### Example 1: Basic Merge to a File

Merge `base.json` and `development.json5`, saving the result to `config.json`. The `development.json5` file's values will override `base.json` where keys conflict. Arrays are concatenated by default.

```bash
merge-json -o config.json examples/base.json examples/development.json5
```

**Output (`config.json`):**
```json
{
  "api": {
    "baseUrl": "http://localhost:3000/api/v1",
    "timeout": 5000
  },
  "plugins": [
    "plugin-A",
    "plugin-B",
    "plugin-dev-tools"
  ]
}
```

### Example 2: Using Glob and Replacing Arrays

Merge all `.json` and `.json5` files inside the `examples` directory. This time, we'll use the `replace` strategy for arrays and print the output to the console.

```bash
merge-json --array-merge replace "examples/**/*.json*"
```

**Output (stdout):**
```json
{
  "api": {
    "baseUrl": "http://localhost:3000/api/v1",
    "timeout": 30000,
    "retries": 0
  },
  "plugins": [
    "plugin-dev-tools"
  ],
  "appName": "JSON Merger App",
  "version": "1.0.0",
  "database": {
    "host": "localhost",
    "port": 5432,
    "user": "dev_user",
    "dbName": "app_db"
  },
  "features": {
    "enableAnalytics": false,
    "enableCaching": false,
    "showSplashScreen": true
  },
  "themes": [
    {
      "name": "debug",
      "path": "themes/debug.css",
      "showGrid": true
    }
  ]
}
```
*Note: The `plugins` array from `base.json` is completely replaced by the one from `development.json5`.*

### Example 3: Watch Mode with Verbose Logging

Watch all config files and automatically re-merge them into `dist/config.json` whenever a file is added, changed, or deleted. Verbose logging helps see what's happening.

```bash
merge-json -o dist/config.json --watch --verbose "examples/**/*.json*"
```

**Terminal Output:**
```
› Resolving glob patterns: examples/**/*.json*
ℹ Found 2 unique file(s) to merge.
› Files to be merged (in order):
  - examples/base.json
  - examples/development.json5
› Reading and parsing 2 file(s)...
› Successfully read file: /path/to/project/examples/base.json
› Successfully parsed file: /path/to/project/examples/base.json
› Successfully read file: /path/to/project/examples/development.json5
› Successfully parsed file: /path/to/project/examples/development.json5
› Successfully parsed 2 of 2 file(s).
› Starting merge of 2 objects.
› Using "concat" array merge strategy (default).
✔ Successfully merged files into: dist/config.json
ℹ Watch mode enabled. Watching for changes in: examples/**/*.json*
```
Now, if you edit or save any file matching the glob pattern, the merge process will run again automatically.

## License

This project is licensed under the MIT License.