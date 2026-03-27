# Git Blame Sifter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/git-blame-sifter.svg)](https://badge.fury.io/js/git-blame-sifter)

An advanced command-line tool that analyzes `git blame` output to find the true semantic authors of code. It intelligently filters out commits that only perform trivial changes (e.g., code formatting, whitespace adjustments), producing a cleaner, more meaningful blame history.

![Git Blame Sifter Demo](https://user-images.githubusercontent.com/your-username/your-repo/assets/demo.gif) <!-- Placeholder for a cool demo GIF -->

---

### Description

Ever run `git blame` on a file only to find that every line is owned by a recent "chore: format code" or "refactor: rename variable" commit? This noise hides the original authors who wrote the actual logic.

**Git Blame Sifter** solves this problem. It acts as a smart filter on top of `git blame`. When it encounters a line blamed on a "trivial" commit (which you can define), it automatically walks back through the file's history to find the last *substantive* commit that touched that line. The result is a blame output that reflects true authorship and intent.

### Features

-   **Trivial Commit Filtering**: Identifies and skips commits based on customizable rules (commit message patterns, author exclusion, etc.).
-   **Intelligent Diff Analysis**: Uses line-by-line diffing to determine if a change is purely cosmetic (whitespace, empty lines).
-   **Historical Sifting**: For lines blamed on trivial commits, it walks the git history backwards to find the previous, meaningful author.
-   **Rich Configuration**: Configure via CLI flags, environment variables, or a `.blamesifterrc.json` file.
-   **Flexible Output**: Supports multiple output formats, including a standard colorized view, JSON for machine consumption, and a summary report.
-   **Glob Pattern Support**: Easily include or exclude files from analysis using glob patterns.
-   **High Performance**: Caches Git operations and analysis results for fast repeated runs.

### Installation

You can install `git-blame-sifter` globally via npm to use it as a command-line tool in any of your projects.

```bash
npm install -g git-blame-sifter
```

Alternatively, for development or local-only use, you can clone the repository:

```bash
git clone https://github.com/your-username/git-blame-sifter.git
cd git-blame-sifter
npm install
# Run using `node bin/git-blame-sifter.js ...` or `npm link`
```

### Usage

The primary command is `sift`, which takes a file path as an argument.

**Basic Usage:**

```bash
# Analyze a single file with default settings
sift src/utils/git-executor.js

# Use an alias for convenience
git-blame-sifter src/utils/git-executor.js
```

**Command-Line Options:**

The tool is highly configurable through CLI flags.

```bash
sift <file> [options]

Options:
  --help                Show help                                      [boolean]
  --version             Show version number                            [boolean]
  --format, -f          Output format (standard, json, summary)
                                                      [string] [default: "standard"]
  --commit-message      Regex to identify trivial commit messages.
                        [string] [default: "^(chore|style|refactor|test|build|ci)(\\(.+\\))?:"]
  --ignore-authors      A comma-separated list of author emails or names to
                        always treat as trivial.                         [array]
  --is-trivial          Enable diff-based triviality analysis.
                                                       [boolean] [default: true]
  --show-progress       Display a spinner during analysis.
                                                       [boolean] [default: true]
```

**Configuration File:**

For project-specific settings, create a `.blamesifterrc.json` file in your project root. CLI flags will override settings from the config file.

**.blamesifterrc.example.json:**
```json
{
  "commitMessage": "^(chore|style|refactor|perf|fix|ci)(\\(.+\\))?:",
  "ignoreAuthors": [
    "lint-bot@your-company.com",
    "GitHub Actions"
  ],
  "exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.lock"
  ],
  "isTrivial": true,
  "format": "standard"
}
```

### Examples

#### Example 1: Standard Sift

Analyze a file where a formatting commit recently changed every line. The sifter will look past the formatter and show the original authors.

**Command:**
```bash
sift src/components/Button.js
```

**Expected Output:**

The output looks similar to `git blame`, but lines modified by trivial commits are dimmed, and the original author is shown. The `~` marker indicates a sifted line.

```
~e9378c5 (John Doe       2023-01-15 10:30:00 -0500   1) import React from 'react'; (c1a2b3d4)
~e9378c5 (John Doe       2023-01-15 10:30:00 -0500   2)                                (c1a2b3d4)
^a0f8b7c (Jane Smith     2023-05-22 14:00:00 -0500   3) const Button = ({ children }) => {
^a0f8b7c (Jane Smith     2023-05-22 14:00:00 -0500   4)   return <button>{children}</button>;
^a0f8b7c (Jane Smith     2023-05-22 14:00:00 -0500   5) };
~e9378c5 (John Doe       2023-01-15 10:30:00 -0500   6)                                (c1a2b3d4)
~b4e6d5f (Alice Johnson  2023-02-10 11:00:00 -0500   7) export default Button;          (c1a2b3d4)
```
*Here, `c1a2b3d4` was the trivial formatting commit. The tool correctly attributes lines 1, 2, 6, and 7 to their previous authors.*

#### Example 2: Summary Report

Get a high-level overview of who *really* wrote a file by generating a summary report. This is great for understanding code ownership.

**Command:**
```bash
sift src/services/api.js --format summary
```

**Expected Output:**

The summary format shows the percentage of lines contributed by each substantive author after filtering out the noise.

```
Sifted Blame Summary for: src/services/api.js

Authorship Breakdown (after sifting):
--------------------------------------------------
  58.33% (70 lines) - Jane Smith <jane.smith@example.com>
  25.00% (30 lines) - John Doe <john.doe@example.com>
  16.67% (20 lines) - Alice Johnson <alice.j@example.com>
--------------------------------------------------
Total lines: 120
Trivial commits ignored: 4
```

#### Example 3: JSON Output for Tooling

Use the JSON output format to pipe the sifted data into other scripts or tools for further analysis.

**Command:**
```bash
sift path/to/your/file.ts --format json > blame_data.json
```

**Expected Output (in `blame_data.json`):**
```json
{
  "file": "path/to/your/file.ts",
  "processedBlame": [
    {
      "finalLine": 1,
      "content": "import { Something } from './somewhere';",
      "isTrivial": true,
      "originalCommit": {
        "hash": "c1a2b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        "author": "Code Formatter",
        "summary": "style: apply new linting rules"
      },
      "siftedCommit": {
        "hash": "e9378c5a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e",
        "author": "John Doe",
        "summary": "feat: add initial module structure"
      }
    }
  ]
}
```

### License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.