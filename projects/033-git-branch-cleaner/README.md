# Git Branch Cleaner

A command-line tool that finds and interactively deletes stale or merged local Git branches. It helps developers keep their local repository clean by identifying branches that are no longer needed, based on their merged status and last commit date.

 <!-- Placeholder for a demo GIF -->

## Features

-   **List Merged Branches:** Identifies local branches that have been fully merged into your current `HEAD`.
-   **Find Stale Branches:** Flags branches as "stale" based on a configurable 'days since last commit' threshold.
-   **Interactive Mode:** Provides a clean, interactive checklist to select which branches to delete.
-   **Dry Run:** Preview which branches would be deleted without making any actual changes.
-   **Force Deletion:** Option to force-delete unmerged branches, with a clear confirmation prompt to prevent accidents.
-   **Exclusion List:** Protects important branches (like `main`, `develop`) from ever being listed for deletion.
-   **Clear Output:** Simple, color-coded status for each branch (merged, stale, protected) for at-a-glance understanding.

## Installation

You can install the tool globally via npm to make it available as a command-line utility in any terminal session.

```bash
npm install -g git-branch-cleaner
```

Alternatively, you can clone the repository and run it directly:

```bash
git clone https://github.com/your-username/git-branch-cleaner.git
cd git-branch-cleaner
npm install
# Run using: node src/cli.js
```

## Usage

Navigate to your Git repository and run the command.

```bash
git-clean-branches
```

This will start the tool in interactive mode, analyzing your local branches and prompting you to select which ones to delete.

### Command Options

| Option                  | Alias | Description                                                                                | Default     |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------ | ----------- |
| `--days <number>`       | `-d`  | Days since last commit to consider a branch stale. `0` disables staleness check.         | `90`        |
| `--force`               | `-f`  | Allow force-deletion of unmerged branches (with confirmation).                             | `false`     |
| `--dry-run`             |       | Preview which branches would be deleted without making any changes.                        | `false`     |
| `--exclude <branches...>` | `-e`  | A list of branches to protect from deletion, in addition to defaults.                      | `[]`        |
| `--version`             | `-v`  | Output the current version of the tool.                                                    |             |
| `--help`                | `-h`  | Display the help screen.                                                                   |             |

**Default Excluded Branches:** `main`, `master`, `develop`, `development`, `release`

## Examples

### 1. Basic Interactive Cleanup

Run the command with no options to find all merged branches and any branches stale for more than 90 days.

**Command:**

```bash
git-clean-branches
```

**Output:**

The tool will analyze your repository and present an interactive checklist.

```
🔍 Analyzing local branches...
The following branches can be cleaned up:
? Select branches to delete (use spacebar to select, enter to confirm):
❯◯ [merged   ] feat/user-login-form             (102 days ago)
 ◯ [merged   ] fix/header-alignment             (95 days ago)
 ◯ [stale    ] refactor/api-service             (110 days ago)
```

After you select branches and confirm, it will show the deletion results.

```
--- DELETION COMPLETE ---

✅ Successfully processed 2 branches:
  - Deleted branch feat/user-login-form
  - Deleted branch fix/header-alignment

❌ Failed to process 1 branches:
  - refactor/api-service: Branch is not fully merged. Use the '--force' flag to delete it.

✨ Cleanup finished.
```

### 2. Dry Run with Custom Staleness

Preview which branches would be deleted if the staleness threshold was 30 days, without actually deleting anything.

**Command:**

```bash
git-clean-branches --days 30 --dry-run
```

**Output:**

After selecting branches in the interactive prompt:

```
--- DRY RUN RESULTS ---
No branches were actually deleted. The following actions would be taken:

✅ Successfully processed 3 branches:
  - [DRY RUN] Would delete branch 'feat/user-login-form'.
  - [DRY RUN] Would delete branch 'fix/header-alignment'.
  - [DRY RUN] Would delete branch 'chore/update-dependencies'.

✨ Cleanup finished.
```

### 3. Force-Deleting Unmerged Stale Branches

Find stale branches (older than 180 days), and use the `--force` flag to enable deletion of unmerged ones.

**Command:**

```bash
git-clean-branches --days 180 --force
```

**Output:**

If you select an unmerged stale branch, you will get a final, explicit confirmation prompt.

```
⚠️  WARNING: You are about to force-delete unmerged branches.
This action cannot be undone and may lead to loss of work.

The following unmerged branches will be force-deleted:
  - refactor/api-service
? Are you absolutely sure you want to proceed? (y/N)
```

If you confirm, the unmerged branch will be force-deleted.

## License

[MIT](LICENSE)