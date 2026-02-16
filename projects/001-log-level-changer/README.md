# Log Level Changer CLI

A simple command-line tool to dynamically change the log level of a running Node.js application without restarting it. Useful for debugging in production or staging environments by temporarily increasing log verbosity. Developers and operations teams can use this to quickly inspect application behavior.

## Description

The Log Level Changer CLI allows you to attach to a running Node.js process (identified by its PID) and modify its logging verbosity on the fly. This is invaluable for troubleshooting issues in live environments without the need for disruptive restarts. You can target specific modules within your application or set a global log level.

## Features

*   **Attach to Running Processes:** Connect to any Node.js application using its Process ID (PID).
*   **Dynamic Log Level Control:** Change log levels without restarting the target application.
*   **Module-Specific or Global:** Set log levels for individual modules or for the entire application.
*   **Standard Log Levels:** Supports common levels: `debug`, `info`, `warn`, `error`, `silent`.
*   **List Available Modules:** Discover which modules in the target process are configured for log level control.
*   **Colorized Output:** Clear visual feedback on success or failure of operations.

## Installation

You can install the Log Level Changer CLI globally using npm:

```bash
npm install -g log-level-changer-cli
```

Alternatively, if you clone the repository:

```bash
git clone https://github.com/your-username/log-level-changer-cli.git
cd log-level-changer-cli
npm install
npm link # To make the command available globally
```

## Usage

The CLI provides two main commands: `set` and `list`.

### Setting Log Level

Use the `set` command to change the log level.

**Syntax:**

```bash
log-level-changer set <pid> <level> [--module <moduleName>]
```

*   `<pid>`: The Process ID of the target Node.js application.
*   `<level>`: The desired log level (`debug`, `info`, `warn`, `error`, `silent`).
*   `--module <moduleName>` (optional): The name of the module to target. If omitted, the global log level is changed.

### Listing Modules

Use the `list` command to see which modules are available for log level control in a running process.

**Syntax:**

```bash
log-level-changer list <pid>
```

*   `<pid>`: The Process ID of the target Node.js application.

## Examples

Here are some practical examples of how to use the Log Level Changer CLI.

**1. Increase global log level to 'debug' for a process:**

Assume your Node.js application is running with PID `12345`.

```bash
log-level-changer set 12345 debug
```

**Expected Output:**

```
Successfully sent request to change global log level to "debug" in process 12345.
```

**2. Set log level for a specific module:**

If your application uses a module named `my-service` and you want to set its log level to `info` for PID `67890`.

```bash
log-level-changer set 67890 info --module my-service
```

**Expected Output:**

```
Successfully sent request to change log level for module "my-service" to "info" in process 67890.
```

**3. List available modules in a running process:**

To see which modules can be individually controlled for PID `11223`.

```bash
log-level-changer list 11223
```

**Expected Output (if modules are configured):**

```
Available modules in process 11223:
- logger
- database
- api-gateway
```

**Expected Output (if no specific modules are configured):**

```
No specific modules found for log level control in process 11223. Global level can still be changed.
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.