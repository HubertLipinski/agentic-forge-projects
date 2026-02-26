# INI/ENV Sync Tool

A command-line tool for converting and synchronizing configuration files between INI and .env formats. It intelligently handles comments, sections, and nested keys, making it ideal for developers managing different configuration styles across multiple environments or applications.

## Features

-   **Bi-directional Conversion**: Convert from INI to `.env` and from `.env` to INI.
-   **Key Flattening**: INI sections are flattened into prefixed keys in `.env` (e.g., `[database]` `user=` becomes `DATABASE_USER`).
-   **Section Reconstruction**: Prefixed `.env` keys are intelligently grouped back into INI sections.
-   **Watch Mode**: Use `--watch` to automatically sync files when the source file changes.
-   **Configurable Formatting**: Customize key casing (e.g., `SNAKE_CASE`) and the prefix delimiter.
-   **Robust Parsing**: Handles different quoting styles, special characters, and comments in `.env` files.

## Installation

You can use the tool by cloning the repository and installing its dependencies.

```bash
# Clone the repository
git clone https://github.com/your-username/ini-env-sync.git

# Navigate into the project directory
cd ini-env-sync

# Install dependencies
npm install

# (Optional) Link the binary for global use
npm link
```

After linking, you can use `ini-env-sync` directly from any terminal.

## Usage

The tool can be used for one-off conversions or for continuous synchronization in watch mode.

**Command Syntax:**

```
ini-env-sync <source> <destination> [options]
```

### Arguments

-   `<source>`: The path to the source file (e.g., `config.ini` or `.env`).
-   `<destination>`: The path to the destination file (e.g., `.env` or `config.ini`).

### Options

| Option               | Alias | Description                                                  | Default      |
| -------------------- | ----- | ------------------------------------------------------------ | ------------ |
| `--watch`            | `-w`  | Watch the source file for changes and sync automatically.    | `false`      |
| `--case-type`        | `-c`  | The case style to apply to keys during INI to `.env` conversion. | `SNAKE_CASE` |
| `--prefix-delimiter` | `-d`  | The delimiter used to join INI section names and keys.       | `_`          |
| `--sync-on-start`    |       | Perform an initial sync when starting watch mode.            | `true`       |
| `--help`             | `-h`  | Show the help message.                                       |              |
| `--version`          | `-v`  | Show the version number.                                     |              |

## Examples

### 1. Convert INI to .env

This example converts an INI file with sections into a flat `.env` file, using the default `SNAKE_CASE` for keys.

**Source (`config.ini`):**

```ini
; Application settings
appName=My App
debugMode=true

[database]
host=localhost
port=5432
user=my_user
```

**Command:**

```bash
ini-env-sync config.ini .env
```

**Result (`.env`):**

```dotenv
APP_NAME="My App"
DEBUG_MODE=true
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=my_user
```

### 2. Convert .env to INI

This example converts a `.env` file with prefixed keys back into a structured INI file. The `_` delimiter is used to create sections.

**Source (`.env`):**

```dotenv
APP_VERSION=2.1.0
API_AUTH_TOKEN=secret-key
API_TIMEOUT_MS=30000
```

**Command:**

```bash
ini-env-sync .env config.ini
```

**Result (`config.ini`):**

```ini
APP_VERSION = 2.1.0
[API]
AUTH_TOKEN = secret-key
TIMEOUT_MS = 30000
```

### 3. Watch for Changes

To continuously sync an INI file to a `.env` file, use the `--watch` flag. The tool will run in the background and update the destination file whenever the source file is saved.

**Command:**

```bash
ini-env-sync config.ini .env --watch
```

**Output:**

```
👁️  Watching for changes on "config.ini"...
Performing initial synchronization...
✅ Successfully synced "config.ini" to ".env".
Watcher is ready. Press Ctrl+C to stop.
```

Any subsequent changes to `config.ini` will be automatically reflected in `.env`.

## License

[MIT](./LICENSE)