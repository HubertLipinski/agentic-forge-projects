# Git Worktree Organizer (gwo)

A command-line utility to simplify the management of Git worktrees. It provides a standardized directory structure and simple commands for creating, listing, and cleaning up worktrees, making it easier for developers to manage parallel branches without cluttering their main project directory.

## Features

-   **Interactive CLI**: Create new worktrees with an interactive branch selection menu.
-   **Standardized Structure**: Automatically organizes worktrees into a `.gwo/` directory.
-   **Clear Overview**: List all worktrees, their branches, and on-disk paths in a clean table.
-   **Automated Cleanup**: Find and remove stale worktrees for branches that have been deleted.
-   **Scripting Support**: Non-interactive mode with a `--force` flag for CI/CD and automation.
-   **Customizable**: Configure the worktree directory path via a `.gworc` file.

## Installation

You can install `git-worktree-organizer` globally via npm to make the `gwo` command available in any of your projects.

```bash
npm install -g git-worktree-organizer
```

Alternatively, you can clone the repository and link it for development:

```bash
git clone https://github.com/your-username/git-worktree-organizer.git
cd git-worktree-organizer
npm install
npm link
```

## Usage

Navigate to any directory within a Git repository and run `gwo` with one of the available commands.

```bash
gwo <command> [options]
```

**Commands:**

-   `gwo add [branch]`: Create a new worktree. If `[branch]` is omitted, it will launch an interactive prompt to select a branch.
-   `gwo list` (or `ls`): List all worktrees for the current repository.
-   `gwo clean`: Find and remove stale worktrees whose branches have been deleted.

**Configuration:**

You can customize the default worktree directory by creating a `.gworc` file in the root of your repository. By default, worktrees are stored in `.gwo/`.

**Example `.gworc`:**

```json
{
  "worktreeDir": ".worktrees"
}
```

## Examples

### 1. Create a new worktree interactively

Run `gwo add` without any arguments to see a list of available branches to create a worktree from.

```bash
$ gwo add
```

**Expected Output:**

An interactive prompt will appear, allowing you to select a branch.

```
? Select a branch to create a worktree for: › - Use arrow keys. Return to submit.
❯   feature/user-authentication
    feature/new-dashboard-widgets
    bugfix/login-page-css
    origin/dependabot/npm/chalk-5.3.0
```

After selecting a branch (e.g., `feature/user-authentication`), the worktree is created.

```
Creating worktree for branch 'feature/user-authentication'...
✓ Worktree created successfully!
  Branch: feature/user-authentication
  Path:   /path/to/your/project/.gwo/feature-user-authentication

To switch to the new worktree, run: cd /path/to/your/project/.gwo/feature-user-authentication
```

### 2. List all worktrees

Run `gwo list` to see a table of all current worktrees, including the main project directory.

```bash
$ gwo list
```

**Expected Output:**

```
Worktrees for repository: /path/to/your/project

Branch                                Path                                 Status
──────────────────────────────────────────────────────────────────────────────────
main (main)                           .                                    OK
bugfix/login-page-css                 .gwo/bugfix-login-page-css           OK
feature/user-authentication           .gwo/feature-user-authentication     OK
```

### 3. Clean up stale worktrees

If you delete a branch (e.g., `bugfix/login-page-css`) that has an associated worktree, `gwo clean` will help you remove it.

```bash
$ gwo clean
```

**Expected Output:**

The command first identifies prunable worktrees and asks for confirmation.

```
Checking for stale worktrees...
The following worktrees are linked to deleted branches and can be cleaned up:
  - bugfix/login-page-css at /path/to/your/project/.gwo/bugfix-login-page-css

? Proceed with removing these 1 worktree(s)? (y/N) › false
```

If you confirm `yes`, the worktree directory will be removed.

```
? Proceed with removing these 1 worktree(s)? Yes
Removing 1 worktree(s)...
  ✓ Removed: /path/to/your/project/.gwo/bugfix-login-page-css

✓ Cleanup complete. All stale worktrees have been removed.
```

To bypass the confirmation prompt (for example, in a script), use the `--force` flag:

```bash
gwo clean --force
```

## License

[MIT](LICENSE)