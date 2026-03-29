# npm-dependency-grapher

A CLI tool that scans a JavaScript project's `package.json` and `node_modules` to build an accurate, interactive dependency graph. It resolves version conflicts, identifies circular dependencies, and visualizes the entire tree as a Graphviz DOT file. This helps developers understand their project's dependency hell, find opportunities to prune dependencies, and diagnose complex versioning issues without relying on `npm ls`'s often cumbersome output.

![Example Dependency Graph](https://raw.githubusercontent.com/your-username/npm-dependency-grapher/main/assets/example-graph.png)
*(Note: You will need to generate and add an actual example image to your repository)*

## Features

-   **Comprehensive Scan**: Scans `package.json` for all dependency types (prod, dev, peer, optional).
-   **Accurate Tree**: Recursively reads `package.json` files within `node_modules` to build a complete and accurate tree, respecting hoisted and nested dependencies.
-   **Monorepo Support**: Automatically detects and links internal workspace packages from `pnpm-workspace.yaml` or `package.json` `workspaces` configurations.
-   **Conflict Analysis**: Uses `semver` to analyze and flag version mismatches where a resolved package does not satisfy a dependent's required version range.
-   **Cycle Detection**: Implements a fast, DFS-based cycle detection algorithm to find and report circular dependencies.
-   **Graphviz Visualization**: Generates a Graphviz DOT file representing the full dependency graph, with nodes and edges styled for clarity (e.g., highlighting conflicts, cycles, and workspace packages).
-   **CLI Control**: Provides flexible command-line options to control graph depth, include/exclude dev dependencies, and specify the output file.
-   **Summary Report**: Outputs a concise summary to the console detailing total packages, version conflicts, and cycles found.

## Installation

You can install `npm-dependency-grapher` globally to use it in any project:

```bash
npm install -g npm-dependency-grapher
```

Alternatively, you can clone the repository and run it locally:

```bash
git clone https://github.com/your-username/npm-dependency-grapher.git
cd npm-dependency-grapher
npm install
npm link # To make the 'dep-grapher' command available globally
```

**Prerequisite:** You must have [Graphviz](https://graphviz.org/download/) installed to render the output `.dot` file into an image.

After installing Graphviz, you can convert the DOT file to a PNG like this:
```bash
dot -Tpng -o dependency-graph.png dependency-graph.dot
```

## Usage

The CLI tool is invoked with the `dep-grapher` command. Run it from the root of your project.

### Basic Command

```bash
dep-grapher [options] [path]
```

-   `[path]` (optional): The path to the project directory to scan. Defaults to the current working directory (`.`).

### Options

| Option                  | Alias | Description                                                              | Default                  |
| ----------------------- | ----- | ------------------------------------------------------------------------ | ------------------------ |
| `--output <file>`       | `-o`  | The output file path for the generated DOT graph.                        | `dependency-graph.dot`   |
| `--depth <number>`      | `-d`  | Maximum depth to scan for dependencies.                                  | `Infinity`               |
| `--no-dev`              |       | Exclude `devDependencies` from the scan and graph.                       | `false` (dev included)   |
| `--json`                |       | Output the final analysis report as JSON instead of a summary table.     | `false`                  |
| `--log-level <level>`   | `-l`  | Set the logging level (`silent`, `error`, `warn`, `info`, `debug`).        | `info`                   |
| `--help`                | `-h`  | Display help for the command.                                            |                          |

## Examples

### 1. Basic Scan of the Current Project

Run a standard scan on the project in your current directory, including dev dependencies, and save the output to `dependency-graph.dot`.

**Command:**
```bash
dep-grapher
```

**Console Output:**
```
[INFO] Starting dependency scan from: /path/to/your-project/package.json
[INFO] Searching for monorepo workspace packages...
[INFO] No monorepo configuration found. Assuming a single-package project.
...
[INFO] Scan complete. Found 258 unique packages.
[INFO] Analyzing dependency versions for conflicts...
[WARN] Found 2 version conflict(s).
[INFO] Starting cycle detection...
[WARN] Found 1 circular dependenc(y/ies).
[INFO] Building DOT graph string...
[INFO] DOT graph string built successfully.
[INFO] Graphviz DOT file written to /path/to/your-project/dependency-graph.dot

NPM Dependency Grapher Report
-----------------------------------

Scan Summary for: your-project

  • Total Unique Packages: 258
  • Version Conflicts:     2
  • Circular Dependencies: 1

Graph visualization saved to: dependency-graph.dot

Version Conflicts (2)
A conflict occurs when a resolved version doesn't satisfy a required semantic version range.

  1. some-dependency
     - Required by: your-project@1.0.0
     - Required version: ^1.5.0
     - Resolved version: 2.1.0

  2. another-lib
     - Required by: some-dependency@2.1.0
     - Required version: ~3.2.0
     - Resolved version: 3.4.1

Circular Dependencies (1)
These are dependency chains that loop back onto themselves.

  1. a@1.0.0 → b@2.0.0 → c@3.0.0 → a@1.0.0

-----------------------------------
Report finished.
```

### 2. Scan with Limited Depth and No Dev Dependencies

Scan the project, but only go 3 levels deep and exclude all `devDependencies`. This is useful for analyzing only your production dependency tree.

**Command:**
```bash
dep-grapher --depth 3 --no-dev -o prod-graph.dot
```

**Console Output:**
```
[INFO] Starting dependency scan from: /path/to/your-project/package.json
...
[INFO] Scan complete. Found 97 unique packages.
...
Graph visualization saved to: prod-graph.dot
...
```

### 3. Scan a Monorepo Project

If you run `dep-grapher` in the root of a monorepo (e.g., one using PNPM workspaces), it will automatically detect and correctly link the internal packages.

**Command:**
```bash
# At the root of a monorepo
dep-grapher -o monorepo-graph.dot
```

**Console Output:**
```
[INFO] Starting dependency scan from: /path/to/monorepo/package.json
[INFO] Searching for monorepo workspace packages...
[INFO] Found pnpm-workspace.yaml, scanning for PNPM workspaces.
[INFO] Found 4 potential workspace package(s).
[INFO] Successfully registered 4 workspace package(s).
...
```
The resulting `monorepo-graph.dot` file will visually distinguish workspace packages (e.g., with a different shape or color) and show how they link to each other and to external dependencies.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.