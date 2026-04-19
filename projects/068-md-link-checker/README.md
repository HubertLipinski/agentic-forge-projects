# Markdown Link Checker

A lightweight, zero-dependency Node.js CLI tool and library to scan Markdown files and verify that all local and remote links are valid. It's designed for developers and content creators to automate link validation in their documentation or blog posts, preventing broken links before they are published.

## Features

-   **Recursive Scanning**: Automatically finds and scans all Markdown files (`.md`, `.markdown`) in a directory.
-   **Comprehensive Checking**: Validates both local/relative file links and remote HTTP/HTTPS URLs.
-   **Configurable**: Set network timeouts, user-agent strings, and rate-limiting delays.
-   **Ignore Patterns**: Exclude specific URLs or patterns from checks using regular expressions.
-   **Project-Level Settings**: Use a `.linkcheckerrc.json` file for consistent configuration across your project.
-   **Detailed Reports**: Generates a clear summary of valid, broken, and ignored links.
-   **CI/CD Friendly**: Exit with a non-zero status code on finding broken links, perfect for automated workflows.
-   **Programmatic API**: Integrate link checking directly into your own Node.js applications.

## Installation

You can use `markdown-link-checker` as a command-line tool or as a library in your project.

### For CLI usage (Global Install)

```bash
npm install -g markdown-link-checker
```

### For Programmatic Usage (Local Install)

```bash
npm install markdown-link-checker
```

## Usage

### Command-Line Interface (CLI)

The CLI is the easiest way to get started. Run it against files or directories.

```
Usage:
  link-checker [paths...] [options]

Arguments:
  paths                 One or more file or directory paths to scan.
                        Defaults to the current directory if not provided.

Options:
  --help, -h            Show this help message.
  --version, -v         Show the version number.
  --config <path>       Path to a custom configuration file.
  --timeout <ms>        Network request timeout in milliseconds. (Default: 10000)
  --request-delay <ms>  Delay between each HTTP request in milliseconds. (Default: 100)
  --user-agent <string> User-Agent string for network requests.
  --ignore <pattern>    A regex pattern for URLs to ignore. Can be used multiple times.
  --fail-on-broken      Exit with a non-zero code if any broken links are found.
```

### Programmatic API

You can also use `markdown-link-checker` as a library in your Node.js projects.

```javascript
import { check, LINK_STATUS } from 'markdown-link-checker';

// Scan a directory and provide custom options
const results = await check('./docs', {
  timeout: 5000, // 5-second timeout
  ignorePatterns: ['http://localhost:.*'], // Ignore local dev links
});

const brokenLinks = results.filter(link => link.status === LINK_STATUS.BROKEN);

if (brokenLinks.length > 0) {
  console.error('Found broken links:');
  console.log(brokenLinks);
} else {
  console.log('All links are valid!');
}
```

### Configuration File

For project-level settings, create a `.linkcheckerrc.json` file in your project root. CLI flags will override settings from this file.

```json
// .linkcheckerrc.json
{
  "timeout": 8000,
  "requestDelay": 200,
  "ignorePatterns": [
    "http://localhost:.*",
    "https://twitter.com/.*"
  ]
}
```

## Examples

### 1. Basic Scan of the Current Directory

Scan all Markdown files in the current directory and its subdirectories.

**Command:**

```bash
link-checker
```

**Expected Output:**

```
Parsing Markdown Files...
✔ Parsed docs/guide.md (12 links found)
✔ Parsed README.md (8 links found)

Validating 20 Links...

Broken Links Found:
✖ https://example.com/broken-page
  in docs/guide.md:42
  Reason: (Status: 404)
✖ ./non-existent-image.png
  in docs/guide.md:58
  Reason: (Error: Local file not found: ENOENT: no such file or directory...)

Scan Summary:
Total links checked: 20
✔ Valid links: 18
✖ Broken links: 2
! Ignored links: 0
```

### 2. Scan Specific Files and Ignore Patterns

Scan a specific file and directory while ignoring links to GitHub issues.

**Command:**

```bash
link-checker ./README.md ./docs --ignore "https://github.com/.*"
```

**Expected Output:**

```
Parsing Markdown Files...
✔ Parsed ./README.md (8 links found)
✔ Parsed docs/guide.md (12 links found)
✔ Parsed docs/install.md (5 links found)

Validating 25 Links...

Scan Summary:
Total links checked: 25
✔ Valid links: 22
✖ Broken links: 0
! Ignored links: 3
```

### 3. Use in a CI/CD Pipeline

Scan the `docs` folder and fail the build if any broken links are found. This is perfect for a `test` script in `package.json`.

**Command:**

```bash
link-checker ./docs --fail-on-broken
```

**Behavior:**

-   If all links are valid, the command will exit with code `0`.
-   If any broken links are found, a report is printed, and the command exits with code `2`, causing the CI pipeline step to fail.

## License

[MIT](LICENSE)