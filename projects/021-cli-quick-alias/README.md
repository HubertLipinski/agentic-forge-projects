# CLI Quick Alias

A command-line tool to quickly and safely create temporary or permanent shell aliases from your recent command history. It helps developers turn long, repetitive, or hard-to-remember commands into short, memorable aliases without manually editing shell configuration files.

## Features

-   **Interactive UI**: Scans and presents recent commands in a clean, searchable list.
-   **Smart Suggestions**: Suggests a sensible default alias name (e.g., `git status --short` -> `gss`).
-   **Shell Aware**: Automatically detects your shell (`bash`, `zsh`, `fish`) and uses the correct syntax and configuration file (`.bashrc`, `.zshrc`, `.config/fish/config.fish`).
-   **Safe by Default**: Prompts for confirmation before making any changes to your files.
-   **Dry-Run Mode**: See what alias would be created and where, without modifying any files.
-   **Helpful Comments**: Adds comments to your config file with the alias creation date and the original command for easy maintenance.

## Installation

You can install `cli-quick-alias` globally using npm.

```bash
npm install -g cli-quick-alias
```

Alternatively, you can clone the repository and install it for development:

```bash
git clone https://github.com/your-username/cli-quick-alias.git
cd cli-quick-alias
npm install
npm link # To make the `quick-alias` command available globally
```

## Usage

Simply run the `quick-alias` command in your terminal. The tool will guide you through the process.

```bash
quick-alias [options]
```

**Options:**

| Option         | Alias | Description                                                        | Default |
| -------------- | ----- | ------------------------------------------------------------------ | ------- |
| `--dry-run`    | `-d`  | Show what alias would be created without modifying any files.      | `false` |
| `--limit`      | `-l`  | The number of recent history commands to display (min 10, max 200). | `50`    |
| `--help`       | `-h`  | Show help information.                                             |         |
| `--version`    | `-v`  | Show version number.                                               |         |

## Examples

### Example 1: Creating a new alias interactively

Run the command without any arguments. This will start the interactive process to create a new alias for a frequently used `docker` command.

1.  Run the tool:
    ```sh
    quick-alias
    ```

2.  The tool detects your shell and presents a list of recent commands. You select the one you want to alias.
    ```
    ? Select a recent command to alias: › - Use arrow-keys. Return to submit.
    ❯   docker-compose up --build -d
        npm run test -- --watch
        git rebase -i origin/main
        npx prettier --write .
    ```

3.  You are prompted for an alias name, with a smart default suggestion. You can accept it or type a new one.
    ```
    ? What should the alias be named? › dcub-d
    ```

4.  Finally, you confirm the action before any file is modified.
    ```
    ? Create alias "dcub-d" for command "docker-compose up --build -d" in /Users/your-user/.zshrc? › (Y/n)
    ```

5.  On confirmation, the alias is appended to your shell config file.
    ```
    ✅ Success! Alias "dcub-d" was added to "/Users/your-user/.zshrc".
    Please restart your shell or run `source /Users/your-user/.zshrc` to use it.
    ```

### Example 2: Using Dry-Run Mode

Use the `--dry-run` (or `-d`) flag to see what would happen without actually changing your configuration file. This is useful for testing or verification.

```sh
quick-alias --dry-run
```

After selecting a command and an alias name, the tool will print the output to the console instead of writing to a file.

```
-- DRY RUN MODE --
The following content would be appended to "/Users/your-user/.zshrc":

# Added by quick-alias on 2023-10-27. Original: git status --short
alias gss='git status --short'

No files were modified.
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.