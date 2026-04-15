# License Header Generator

A lightweight, zero-dependency CLI tool that automatically adds or updates license headers to your source code files. It intelligently detects the file type to apply the correct comment syntax (e.g., `/* ... */` for JS, `#` for Python/Shell) and ensures your project's files are consistently licensed. Ideal for open-source maintainers and teams needing to enforce license compliance.

## Features

-   Scans directories recursively for specified file extensions.
-   Automatically detects file type to use correct comment style (e.g., `//`, `#`, `/* */`).
-   Idempotent operation: updates existing headers or adds new ones without duplication.
-   Pulls license text from a standard `LICENSE` file or a custom template.
-   Parses copyright year and author from `package.json` for dynamic header content.
-   Accepts CLI flags for specifying directories, file extensions, and license path.
-   Dry-run mode to preview changes without writing to files.
-   Generates a summary report of files modified, added, or skipped.

## Installation

You can use the tool by cloning the repository and installing its dependencies.

```bash
# Clone the repository
git clone https://github.com/your-username/license-header-generator.git

# Navigate into the project directory
cd license-header-generator

# Install dependencies
npm install

# (Optional) Link the binary for global use
npm link
```

Alternatively, if published to npm, you could install it globally:

```bash
npm install -g license-header-generator
```

## Usage

Run the tool from your project's root directory. It will automatically scan for supported files and apply the license header.

### CLI Command

```bash
license-header-generator [options]
```

### Options

| Flag                   | Alias | Description                                                  | Default                               |
| ---------------------- | ----- | ------------------------------------------------------------ | ------------------------------------- |
| `--dir <path>`         | `-d`  | Directory to scan (can be used multiple times).              | Current directory (`.`)               |
| `--ext <extensions>`   | `-e`  | Comma-separated file extensions to process.                  | `.js,.ts,.py,...` (see source)        |
| `--license <path>`     | `-l`  | Path to the license template file.                           | `./LICENSE`                           |
| `--author <name>`      |       | Override the author name (otherwise from `package.json`).    | `author` field in `package.json`      |
| `--year <year>`        |       | Override the copyright year.                                 | Current year                          |
| `--dry-run`            |       | Run without writing any changes to files.                    | `false`                               |
| `--help`               | `-h`  | Show the help message.                                       |                                       |
| `--version`            | `-v`  | Show the version number.                                     |                                       |

## Examples

### 1. Basic Usage

Run the tool in the current directory, processing all default file types. It will look for a `LICENSE` file and a `package.json` in the same directory.

```bash
license-header-generator
```

**Expected Output:**

```
🔍 Starting license header processing...
Found 58 file(s) to process.
--- Processing Summary ---
- Added:   55 file(s)
- Updated: 0 file(s)
- Skipped: 3 file(s) (already up-to-date)
- Errors:  0 file(s)
------------------------
```

### 2. Specifying Directories and Extensions

Scan only the `src` and `lib` directories for JavaScript and TypeScript files.

```bash
license-header-generator --dir src --dir lib --ext .js,.ts
```

**Expected Output:**

```
🔍 Starting license header processing...
Found 25 file(s) to process.
--- Processing Summary ---
- Added:   25 file(s)
- Updated: 0 file(s)
- Skipped: 0 file(s) (already up-to-date)
- Errors:  0 file(s)
------------------------
```

### 3. Dry Run with a Custom License Template

Preview the changes that would be made using a custom license template located in `config/license-template.txt` without actually modifying any files.

```bash
license-header-generator --dry-run --license config/license-template.txt
```

**Expected Output:**

```
🔍 Starting license header processing...
DRY RUN enabled. No files will be changed.
Found 58 file(s) to process.
--- Processing Summary ---
DRY RUN MODE: No files were modified.
- Would be added/updated: 55 file(s)
- Skipped: 3 file(s) (already up-to-date)
- Errors:  0 file(s)
------------------------
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.