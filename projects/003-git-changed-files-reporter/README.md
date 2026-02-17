# Git Changed Files Reporter

A Node.js utility to report on files changed in a Git repository since a specified reference (commit, tag, or branch). Useful for CI/CD pipelines to determine which files need processing or testing.

## Description

This tool leverages Git commands executed via Node.js's `child_process` to identify files that have been modified, added, or deleted between the current state of your repository and a given Git reference. It can also optionally include untracked files. The output can be formatted as a JSON array or a simple list of file paths, making it highly adaptable for various automation workflows. A key feature for CI/CD is its ability to exit with a non-zero status code if no changes are detected, which can be used to control pipeline execution.

## Features

*   **List Changed Files**: Report all files changed between the current `HEAD` and a specified Git reference (commit, tag, or branch).
*   **Filter by Extension**: Narrow down the report to only include files with specific extensions (e.g., `.js`, `.ts`, `.css`).
*   **Output Formats**: Choose between a JSON array or a plain list of file paths for the output.
*   **Include Untracked Files**: Optionally include files that are currently untracked by Git in the report.
*   **CI/CD Friendly Exit Codes**: Exits with a non-zero status code if no changes are found, enabling conditional pipeline steps.

## Installation

You can install this package globally or locally in your project.

**Option 1: Install globally (recommended for CLI usage)**

```bash
npm install -g git-changed-files-reporter
```

**Option 2: Install as a development dependency**

```bash
npm install --save-dev git-changed-files-reporter
```

If you clone the repository directly:

```bash
git clone https://github.com/your-username/git-changed-files-reporter.git
cd git-changed-files-reporter
npm install
```

## Usage

This tool can be used as a command-line interface (CLI) tool.

```bash
git-changed-files-reporter [options]
```

### CLI Options

*   `-r, --reference <string>`: The Git reference (commit, tag, or branch) to compare against. Defaults to `HEAD~1` (the previous commit).
*   `-f, --filter <string>`: Filter changes by file extension (e.g., `"js"`, `".ts"`).
*   `-o, --format <string>`: Output format: `"json"` or `"list"`. Defaults to `"list"`.
*   `-u, --include-untracked`: Include untracked files in the report.

### API Usage (within your Node.js project)

You can also import and use the `reportChangedFiles` function directly in your Node.js scripts.

```javascript
import { reportChangedFiles } from 'git-changed-files-reporter';

async function runReporter() {
  try {
    const changedFiles = await reportChangedFiles({
      reference: 'main', // Compare against the 'main' branch
      filterExtension: 'js', // Only report JS files
      includeUntracked: true, // Include untracked files
    });

    if (changedFiles.length === 0) {
      console.log('No relevant changes found.');
      return;
    }

    console.log('Changed files:');
    changedFiles.forEach(file => console.log(`- ${file}`));

  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
    process.exit(1);
  }
}

runReporter();
```

## Examples

Here are a few practical examples of how to use the CLI tool.

**1. List all changed files since the last commit (default behavior):**

```bash
git-changed-files-reporter
```

*Expected Output (example):*
```
src/index.js
lib/reporter.js
README.md
```

**2. List only JavaScript files changed since a specific tag `v1.0.0`:**

```bash
git-changed-files-reporter --reference v1.0.0 --filter js
```

*Expected Output (example):*
```
src/utils.js
src/components/Button.js
```

**3. List all changed and untracked files in JSON format, comparing against the `develop` branch:**

```bash
git-changed-files-reporter --reference develop --include-untracked --format json
```

*Expected Output (example):*
```json
[
  "src/api.js",
  "tests/api.test.js",
  "docs/new-feature.md",
  "new-untracked-file.txt"
]
```

**4. CI/CD Example: Fail the build if any non-JS files have changed since `main`:**

In your CI script (e.g., `.github/workflows/ci.yml` or `.gitlab-ci.yml`):

```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4
    with:
      fetch-depth: 0 # Fetch all history for diffing

  - name: Install dependencies
    run: npm install

  - name: Run Git Changed Files Reporter
    id: changed_files
    run: |
      # This command will exit with code 1 if no changes are found.
      # We capture the output to check if any non-JS files changed.
      # The --reference main ensures we compare against the main branch.
      # The --filter option is NOT used here to get ALL changes.
      # The --format json makes parsing easier.
      npx git-changed-files-reporter --reference main --format json > changed_files.json

  - name: Check for non-JS changes
    run: |
      # Read the JSON output and check if any file does NOT end with .js
      if jq -e '[.[] | select(test("\\.js$") | not)] | length > 0' changed_files.json; then
        echo "Error: Non-JavaScript files have changed since the 'main' branch."
        exit 1
      else
        echo "Only JavaScript files have changed (or no files changed)."
      fi
```
*(Note: This example assumes `jq` is available in your CI environment for JSON parsing. Adjust the command and logic based on your specific CI/CD platform and needs.)*

## License

MIT License

Copyright (c) 2023 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.