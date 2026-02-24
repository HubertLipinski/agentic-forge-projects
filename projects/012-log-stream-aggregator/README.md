# Log Stream Aggregator

A lightweight Node.js utility for aggregating multiple real-time log streams (e.g., from files, stdin, network sockets) into a single, unified, and structured JSON output stream.

It's designed for developers and system administrators who need to centralize logs from various microservices or processes for easier monitoring and analysis without a heavy log-shipping agent like Logstash or Fluentd.

## Features

-   **Multiple Sources**: Concurrently tail multiple log files, accept logs from `stdin`, and listen for logs on configurable TCP ports.
-   **Structured Output**: Parses and enriches unstructured log lines, transforming all incoming data into a standardized JSON format.
-   **Metadata Enrichment**: Automatically adds a unique ID, timestamp, and source identifier to every log entry.
-   **Resilient File Tailing**: Uses `chokidar` to robustly handle file appends, truncation, and creation.
-   **Simple CLI**: An easy-to-use command-line interface for defining all log sources.
-   **Graceful Shutdown**: Cleans up all file watchers and network connections on `SIGINT`/`SIGTERM`.
-   **Developer-Friendly Logging**: Provides its own structured, pretty-printed logs on `stderr` for easy debugging, keeping `stdout` clean for aggregated log data.

## Installation

You can install the tool globally via npm to use the `log-aggregator` command anywhere:

```bash
npm install -g log-stream-aggregator
```

Alternatively, you can clone the repository and run it directly:

```bash
git clone https://github.com/your-username/log-stream-aggregator.git
cd log-stream-aggregator
npm install
# Run using the local binary
./bin/log-aggregator --help
```

## Usage

The aggregator is controlled via the `log-aggregator` command-line tool. All aggregated logs are printed to `stdout` as newline-delimited JSON. Internal logs from the aggregator itself are printed to `stderr`.

### CLI Options

```
Usage: log-aggregator [options]

Options:
  -f, --file         Path to a log file to tail. Can be specified multiple
                     times.                                [array] [default: []]
  -t, --tcp          TCP port to listen on for logs. Can be specified multiple
                     times.                                [array] [default: []]
  -s, --stdin        Read logs from stdin.              [boolean] [default: false]
      --log-level    Set the internal logging level for the aggregator.
                     [choices: "fatal", "error", "warn", "info", "debug", "trace"]
                                                               [default: "info"]
      --pretty-logs  Enable pretty-printing for the aggregator's internal logs on
                     stderr.                              [boolean] [default: true]
  -h, --help         Show help                                         [boolean]
  -v, --version      Show version number                               [boolean]

Aggregates log streams from files, TCP, and stdin into a unified JSON output on stdout.
Internal application logs are written to stderr.

Example: log-aggregator -f /var/log/app.log -f /var/log/sys.log -t 3000 -s
```

## Examples

### 1. Tailing Two Log Files and Stdin

This command tails `app.log` and `errors.log`, and also listens for logs piped via `stdin`.

**Command:**

```bash
# In one terminal, run the aggregator
log-aggregator --file app.log --file errors.log --stdin
```

**Actions:**

```bash
# In another terminal, append to the log files
echo "User logged in" >> app.log
echo "Database connection failed" >> errors.log

# In the first terminal (where the aggregator is running), type a line and press Enter
This is a manual log entry from stdin
```

**Expected Output (on stdout):**

```json
{"id":"...","timestamp":"...","source":"app.log","raw":"User logged in","message":"User logged in"}
{"id":"...","timestamp":"...","source":"errors.log","raw":"Database connection failed","message":"Database connection failed"}
{"id":"...","timestamp":"...","source":"stdin","raw":"This is a manual log entry from stdin","message":"This is a manual log entry from stdin"}
```

### 2. Aggregating Logs from a File and a TCP Port

This example aggregates logs from `/var/log/service.log` and a TCP server on port `5000`.

**Command:**

```bash
# Run the aggregator
log-aggregator -f /var/log/service.log -t 5000
```

**Actions:**

```bash
# In another terminal, write to the file
echo "Service started successfully" >> /var/log/service.log

# In a third terminal, send a log via netcat (or any TCP client)
echo '{"level": "warn", "message": "High memory usage detected"}' | nc localhost 5000
```

**Expected Output (on stdout):**

The aggregator correctly parses both the plain text from the file and the JSON string from the TCP client.

```json
{"id":"...","timestamp":"...","source":"/var/log/service.log","raw":"Service started successfully","message":"Service started successfully"}
{"level":"warn","message":"High memory usage detected","id":"...","timestamp":"...","source":"tcp:5000","raw":"{\"level\": \"warn\", \"message\": \"High memory usage detected\"}"}
```

### 3. Piping from another process

You can easily pipe the output of any command into the aggregator.

**Command:**

```bash
# Use `journalctl` to follow system logs and pipe them into the aggregator
journalctl -f | log-aggregator --stdin
```

**Expected Output (on stdout):**

Each line from `journalctl` will be converted into a structured JSON object.

```json
{"id":"...","timestamp":"...","source":"stdin","raw":"<journalctl output line 1>","message":"<journalctl output line 1>"}
{"id":"...","timestamp":"...","source":"stdin","raw":"<journalctl output line 2>","message":"<journalctl output line 2>"}
```

## License

[MIT](LICENSE)