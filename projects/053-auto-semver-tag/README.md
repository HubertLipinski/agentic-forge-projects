# Auto SemVer Tagger

A CLI utility that automates Semantic Versioning for Git repositories by analyzing Conventional Commits. It calculates the next appropriate version (patch, minor, or major), generates a changelog from commit messages, creates a new Git tag, and optionally pushes it to a remote. This tool streamlines the release process for developers and maintainers who follow Conventional Commits.

[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

-   **Automated Version Calculation**: Parses Git history since the last SemVer tag and determines the next version (major, minor, or patch) based on Conventional Commits.
-   **Changelog Generation**: Automatically creates a formatted changelog for the new version, grouped by features, fixes, and breaking changes.
-   **Git Tagging**: Creates a new annotated Git tag with the new version and the generated changelog.
-   **Pre-releases**: Full support for pre-release versions (e.g., `alpha`, `beta`, `rc`) using the `--prerelease` flag.
-   **Dry Run Mode**: Preview the new version and changelog without making any changes to your repository using `--dry-run`.
-   **Push to Remote**: Optionally push the new tag directly to your remote repository with the `--push` flag.
-   **Configurable**: Customize behavior per-project via a `.semverrc` file or a `auto-semver-tagger` key in your `package.json`.

## Installation

You can install the tool globally to use it in any of your projects:

```bash
npm install -g auto-semver-tagger
```

Alternatively, you can add it as a `devDependency` to your project and run it via an npm script:

```bash
npm install --save-dev auto-semver-tagger
```

Then, add a script to your `package.json`:

```json
{
  "scripts": {
    "release": "auto-semver-tag --push"
  }
}
```

## Usage

Run the command in the root of your Git repository. The tool will automatically find the last tag, analyze commits since then, and propose a new version.

### CLI Command

```bash
auto-semver-tag [options]
```

### CLI Options

| Option                | Alias | Description                                                                    | Default     |
| --------------------- | ----- | ------------------------------------------------------------------------------ | ----------- |
| `--dry-run`           | `-d`  | Preview changes without creating a tag or pushing.                             | `false`     |
| `--push`              |       | Push the new tag to the remote repository.                                     | `false`     |
| `--prerelease[=id]`   | `-p`  | Create a pre-release version with an optional identifier (e.g., `alpha`).      | `false`     |
| `--tag-prefix`        |       | The prefix for Git tags.                                                       | `v`         |
| `--remote`            |       | The Git remote to push to.                                                     | `origin`    |
| `--verbose`           | `-v`  | Enable detailed logging for debugging.                                         | `false`     |
| `--help`              | `-h`  | Show the help message.                                                         |             |

### Configuration

For project-specific settings, you can create a `.semverrc` file in your project root:

```json
{
  "tagPrefix": "",
  "push": true,
  "remote": "origin"
}
```

Alternatively, you can add the configuration to your `package.json` under the `auto-semver-tagger` key:

```json
{
  "name": "my-project",
  "version": "1.4.2",
  "auto-semver-tagger": {
    "tagPrefix": "v",
    "prerelease": "beta"
  }
}
```

**Priority Order**: CLI arguments > `.semverrc` file > `package.json` config > default values.

## Examples

### Example 1: Standard Patch Release

Imagine your last tag was `v1.2.3` and you have made a few `fix` commits.

**Command:**

```bash
auto-semver-tag --dry-run
```

**Expected Output:**

```
[INFO] --- Running Pre-flight Checks ---
[INFO] Dry run mode: Skipping working directory check.
[INFO] --- Analyzing Git History ---
[INFO] Found latest SemVer tag: v1.2.3
[INFO] Fetching commit history for range: v1.2.3..HEAD
[INFO] Parsed 2 conventional commits.
[INFO] --- Calculating Next Version ---
[SUCCESS] Calculated next version: 1.2.4
[INFO] --- Generating Changelog ---
## 1.2.4 (2023-10-27)

### 🐛 Bug Fixes
- **auth**: correct token validation logic
- **ui**: prevent button from being clicked twice

[INFO] --- Release Execution ---
[INFO] --- DRY RUN ---
[INFO] Would create tag: v1.2.4
[INFO] --- END DRY RUN ---
[SUCCESS] Dry run completed successfully.
```

### Example 2: Minor Pre-release with Push

Your last tag was `v2.0.0` and you have added a new feature. You want to create a release candidate.

**Command:**

```bash
auto-semver-tag --prerelease=rc --push
```

**Expected Output:**

```
[INFO] --- Running Pre-flight Checks ---
[SUCCESS] Working directory is clean.
[INFO] --- Analyzing Git History ---
[INFO] Found latest SemVer tag: v2.0.0
[INFO] Fetching commit history for range: v2.0.0..HEAD
[INFO] Parsed 3 conventional commits.
[INFO] --- Calculating Next Version ---
[SUCCESS] Calculated next version: 2.1.0-rc.0
[INFO] --- Generating Changelog ---
## 2.1.0-rc.0 (2023-10-27)

### ✨ Features
- **api**: add new user profile endpoint

### 🐛 Bug Fixes
- resolve issue with database connection pooling

[INFO] --- Release Execution ---
[INFO] Creating annotated tag: v2.1.0-rc.0
[SUCCESS] Successfully created tag 'v2.1.0-rc.0'
[INFO] Pushing tag 'v2.1.0-rc.0' to remote 'origin'...
[SUCCESS] Successfully pushed tag 'v2.1.0-rc.0' to 'origin'
[SUCCESS] Auto-versioning process completed successfully!
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.