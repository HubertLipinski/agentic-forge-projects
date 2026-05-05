# auto-readme-generator

> A CLI tool that automates README.md creation by parsing project files like package.json, JSDoc comments, and license information.

[![npm version](https://img.shields.io/npm/v/auto-readme-generator.svg)](https://www.npmjs.com/package/auto-readme-generator)
[![CI](https://github.com/your-username/auto-readme-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/auto-readme-generator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Description

`auto-readme-generator` is a command-line tool designed to streamline the creation and maintenance of `README.md` files for your Node.js projects. It saves developers time on documentation boilerplate by intelligently parsing project files to generate a structured, professional-looking README.

The tool extracts metadata from `package.json`, generates API documentation from JSDoc comments, includes license details, and more. With support for custom Mustache templates, you can tailor the output to fit any project's style.

## Features

-   **`package.json` Parsing**: Automatically extracts project name, description, author, license, and scripts.
-   **JSDoc Integration**: Generates an API documentation section from JSDoc comments in your source files.
-   **Custom Templates**: Supports multiple output formats via user-provided Mustache templates (e.g., `default`, `compact`, or your own).
-   **Automatic Installation Instructions**: Detects the package manager (`npm`, `yarn`, `pnpm`) and generates relevant installation commands.
-   **License Section**: Reads your project's `LICENSE` file and links to it.
-   **Contribution Guidelines**: Detects if a `CONTRIBUTING.md` file exists and adds a section for it.
-   **Flexible CLI**: A simple and powerful CLI for configuration, including entry files, template path, and output file.

## Installation

You can install `auto-readme-generator` globally to use it in any of your projects.

```bash
npm install -g auto-readme-generator
```

Alternatively, you can use it without a global installation via `npx`:

```bash
npx auto-readme-generator [options]
```

For development, clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/auto-readme-generator.git
cd auto-readme-generator
npm install
```

## Usage

Run the command in the root of your project. The tool will automatically find your `package.json` and generate a `README.md`.

**Basic Usage**

This command generates a `README.md` using the default template.

```bash
auto-readme
```

**Specifying Options**

You can customize the output using CLI options.

```bash
auto-readme --template compact --entry "src/**/*.js" --output "docs/API.md"
```

### CLI Options

| Option             | Alias | Description                                                                    | Default       |
| ------------------ | ----- | ------------------------------------------------------------------------------ | ------------- |
| `--template`       | `-t`  | Path to a custom template or a built-in name (`default`, `compact`).           | `default`     |
| `--entry`          | `-e`  | Glob patterns for source files to parse for JSDoc. Can be used multiple times. | `[]`          |
| `--output`         | `-o`  | Path for the generated output file.                                            | `README.md`   |
| `--project-root`   | `-p`  | The root directory of the project to analyze.                                  | `process.cwd()` |
| `--help`           | `-h`  | Show help.                                                                     |               |
| `--version`        | `-v`  | Show version number.                                                           |               |

## Examples

Here are a few examples of how to use `auto-readme-generator`.

### Example 1: Basic Generation

For a standard project, simply running the command in the project root is enough.

**Command:**

```bash
auto-readme
```

**Result:**

A `README.md` file is created in the current directory, containing information from `package.json`, a `LICENSE` file (if found), and a `CONTRIBUTING.md` section (if the file exists).

### Example 2: Generating API Docs

If your project has JSDoc comments in its source files, you can include an API section.

**Command:**

```bash
# Parse all .js files in the src directory and its subdirectories
auto-readme --entry "src/**/*.js"
```

**Result:**

The generated `README.md` will now include an "API" section populated with markdown generated from your JSDoc comments.

### Example 3: Using a Compact Template

For a smaller library, you might prefer a more concise README. Use the built-in `compact` template.

**Command:**

```bash
auto-readme --template compact --entry "lib/index.js"
```

**Result:**

A `README.md` is generated using a more minimal layout, perfect for smaller projects.

## License

This project is licensed under the MIT License - see the `LICENSE` file for details.

---

_This README was generated with ❤️ by [auto-readme-generator](https://github.com/your-username/auto-readme-generator)_