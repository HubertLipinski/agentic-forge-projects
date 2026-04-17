# Cyclic Import Detective

A static analysis CLI tool for Node.js projects that detects and visualizes circular dependencies in both CommonJS (`require`) and ES Modules (`import`/`export`). It helps developers identify and refactor problematic import cycles that can lead to subtle bugs, undefined modules, and difficult-to-maintain codebases.

![Demo Screenshot](https://user-images.githubusercontent.com/1010414/235268903-8f7f8f0-4d8a-4b6a-8b0a-3d2e1f9c0a1b.png)
*(Image is a placeholder representation of the console output)*

## Features

-   **Dual Module Support**: Parses both CommonJS (`require`) and ES Modules (`import`/`export`) syntax.
-   **Efficient Cycle Detection**: Uses Tarjan's algorithm for fast and accurate detection of strongly connected components (import cycles).
-   **Accurate Module Resolution**: Resolves module paths according to the Node.js resolution algorithm, including `node_modules` and `package.json` `exports` fields.
-   **Multiple Report Formats**:
    -   **Console**: Human-readable report with colored output for easy identification of cycles.
    -   **JSON**: Machine-readable output for use in CI/CD pipelines.
    -   **GraphML/GEXF**: Export the dependency graph for visualization in tools like [Gephi](https://gephi.org/).
-   **High Performance**: Includes a file-based caching mechanism to speed up analysis on subsequent runs by only re-parsing changed files.
-   **Configurable**: Use CLI flags to specify entry points, exclude paths, and choose output formats.

## Installation

You can install Cyclic Import Detective globally via npm to use it as a command-line tool in any project.

```bash
npm install -g cyclic-import-detective
```

Alternatively, you can install it as a development dependency in your project:

```bash
npm install --save-dev cyclic-import-detective
```

And run it via an npm script in your `package.json`:

```json
{
  "scripts": {
    "check-cycles": "cyclic-import-detective src/index.js"
  }
}
```

## Usage

The CLI tool can be run using `cyclic-import-detective` or its shorter alias, `cid`.

### Synopsis

```
cyclic-import-detective [files...] [options]
cid [files...] [options]
```

### Arguments

-   `[files...]`: One or more entry files or glob patterns to start the analysis from. If omitted, it defaults to common entry points like `index.js`, `src/index.js`, etc.

### Options

| Option                | Alias | Description                                                              | Default                               |
| --------------------- | ----- | ------------------------------------------------------------------------ | ------------------------------------- |
| `--format <type>`     | `-f`  | The output report format.                                                | `console`                             |
|                       |       | `console`: Human-readable text.                                          |                                       |
|                       |       | `json`: Machine-readable JSON.                                           |                                       |
|                       |       | `graphml`: GraphML file for visualization.                               |                                       |
|                       |       | `gexf`: GEXF file for visualization.                                     |                                       |
| `--output <file>`     | `-o`  | File path to write the report to. Required for `graphml` and `gexf`.     | (stdout)                              |
| `--exclude <pattern>` | `-e`  | Glob pattern for files/directories to exclude from analysis.             | `**/node_modules/**`                  |
| `--clear-cache`       |       | Clears the cache before running the analysis.                            | `false`                               |
| `--verbose`           |       | Enable verbose logging for debugging purposes.                           | `false`                               |
| `--help`              | `-h`  | Show the help message.                                                   |                                       |
| `--version`           | `-v`  | Show the version number.                                                 |                                       |

## Examples

### 1. Basic Check in a Project

Run the tool on your project's main entry point. It will traverse all local dependencies and report any cycles found.

**Command:**

```bash
cyclic-import-detective src/main.js
```

**Expected Output (if cycles are found):**

```
Cyclic Import Detective Report

🚨 Found 1 circular dependency group.
Below are the details of each cycle:

Cycle 1 of 1:
  ┌─ src/services/authService.js
  │   imports src/utils/apiClient.js
  └─> src/utils/apiClient.js
      imports src/services/authService.js (completing the cycle)

💡 How to fix:
  - Use dependency inversion: Introduce an intermediary module or use dependency injection.
  - Refactor shared code: Extract the common dependency into a new, separate module.
  - Re-evaluate module boundaries: Sometimes a cycle indicates that modules are too tightly coupled.
```

### 2. Generating a JSON Report for CI

In a CI/CD environment, you can generate a JSON report to programmatically check for cycles and fail the build if any are detected.

**Command:**

```bash
cid "src/**/*.js" --format json --output report.json
```

**`report.json` Content:**

```json
{
  "summary": {
    "totalFiles": 52,
    "totalDependencies": 115,
    "cycleCount": 1,
    "hasCycles": true
  },
  "cycles": [
    {
      "size": 2,
      "files": [
        "src/services/authService.js",
        "src/utils/apiClient.js"
      ]
    }
  ]
}
```

### 3. Creating a Graph for Visualization

To better understand your project's entire dependency structure and pinpoint cycles visually, export the graph to a format compatible with Gephi or other graph analysis tools.

**Command:**

```bash
cid src/index.js --format graphml --output dependencies.graphml
```

Now you can open `dependencies.graphml` in a tool like Gephi. Nodes involved in cycles will be highlighted in red and appear larger, making them easy to spot.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for bugs, feature requests, or improvements.

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b feature/my-new-feature`).
3.  Make your changes.
4.  Commit your changes (`git commit -am 'Add some feature'`).
5.  Push to the branch (`git push origin feature/my-new-feature`).
6.  Create a new Pull Request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.