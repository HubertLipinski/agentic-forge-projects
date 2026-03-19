# Git Tag Manager

A CLI for bulk managing Git tags based on semantic versioning rules. It helps developers find, delete, or retag commits across multiple remotes, cleaning up repositories with inconsistent or outdated tagging practices. It's particularly useful for projects migrating their versioning strategy or cleaning up after CI/CD mishaps.

## Features

-   **List Tags**: Find tags matching specific semver ranges (e.g., `'1.x'`, `'>=2.0.0 <3.0.0-alpha'`).
-   **Bulk Delete**: Delete tags locally and on multiple specified remotes (e.g., `'origin'`, `'upstream'`).
-   **Move Tags**: Retag a specific commit by moving an existing tag.
-   **Interactive Mode**: Visually select tags to delete from a checklist.
-   **Dry-Run Mode**: Preview all operations without making any changes to your repository.
-   **Automation-Friendly**: Non-interactive mode for scripting and CI/CD pipelines.
-   **Multi-Remote Support**: Execute commands across multiple remotes in a single operation.

## Installation

You can install `git-tag-manager` globally via npm:

```bash
npm install -g git-tag-manager
```

Alternatively, you can clone the repository and run it directly:

```bash
git clone https://github.com/your-username/git-tag-manager.git
cd git-tag-manager
npm install
npm link # To make the 'gtm' command available globally
```

## Usage

The CLI is available under the `gtm` command.

```bash
gtm <command> [options]
```

### Commands

| Command                               | Description                                                              |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `gtm list [remotes..]`                | List tags matching a semver range from local and/or remotes.             |
| `gtm delete [remotes..]`              | Delete tags matching a semver range from local and/or remotes.           |
| `gtm move <tag> <to-commit> [remotes..]` | Move a tag to a new commit hash.                                         |

### Global Options

| Option                | Alias | Description                                                        |
| --------------------- | ----- | ------------------------------------------------------------------ |
| `--help`              | `-h`  | Show command-line help.                                            |
| `--version`           | `-v`  | Show version number.                                               |
| `--dry-run`           | `-n`  | Show what would be done without executing any changes.             |
| `--yes`               | `-y`  | Skip all interactive prompts and assume "yes".                     |
| `--range <semver>`    | `-r`  | A semantic versioning range (e.g., `"1.x"`, `"<2.0.0"`).            |
| `--force`             | `-f`  | Force-push a tag when moving it (use with caution).                |

## Examples

### 1. List all pre-release tags for version 2.x

Find all tags that are pre-releases within the `2.x` range, fetched from `origin`, and display them with commit details.

**Command:**

```bash
gtm list origin --range "2.x" --details
```

**Expected Output:**

```
i Fetching tags from local repository and 1 remote(s)...
i Fetching tag details...

Tag                 Commit    Author         Date
v2.0.0-beta.2       a1b2c3d   Jane Doe       2023-10-27T10:00:00Z
v2.0.0-beta.1       e4f5g6h   Jane Doe       2023-10-26T15:30:00Z
v2.0.0-alpha.1      i7j8k9l   John Smith     2023-10-25T11:00:00Z

i Displayed 3 tag(s) with details.
```

### 2. Interactively delete old patch versions

Find all tags for version `1.0.x`, then interactively select which ones to delete from both the local repository and the `origin` remote.

**Command:**

```bash
gtm delete origin --range "1.0.x"
```

**Expected Output (Interactive Prompt):**

```
i Fetching tags to find matches for range: 1.0.x
? Select tags to delete (Space to select, Enter to confirm) (Press <space> to select, <a> to toggle all, <i> to invert selection)
❯ ◉ v1.0.3
  ◉ v1.0.2
  ◉ v1.0.1
  ◯ v1.0.0

... After selection and confirmation ...

✔ Successfully deleted local tag: v1.0.1
✔ Successfully deleted tag on origin: v1.0.1
✔ Successfully deleted local tag: v1.0.2
✔ Successfully deleted tag on origin: v1.0.2
```

### 3. Move a `latest` tag to a new commit

Move the `latest` tag from its current commit to `HEAD` on the local repository and the `upstream` remote. Use `--force` to ensure the remote tag is overwritten.

**Command:**

```bash
gtm move latest HEAD upstream --force --yes
```

**Expected Output:**

```
i Validating tag 'latest' and commit 'HEAD'...
i Skipping confirmation as requested.

Executing move operation...
✔ Deleted local tag: latest
✔ Deleted tag on upstream: latest
✔ Created new local tag: latest at 9f8e7d6
✔ Pushed tag latest to upstream

✔ Successfully moved tag 'latest' to commit 9f8e7d6.
```

## License

[MIT](LICENSE)