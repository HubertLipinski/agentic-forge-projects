# Log Anomaly Detector

## Description

A lightweight, real-time log monitoring tool that detects anomalies in streaming log data without machine learning. It works by establishing a baseline of normal log patterns (message structure, frequency, keywords) and flagging deviations. Ideal for developers and small DevOps teams needing simple, effective anomaly detection for their applications without the complexity of full-fledged observability platforms.

## Features

- **Real-time File Watching**: Monitors log files and directories for changes in real-time using `chokidar`.
- **Log Burst Detection**: Identifies sudden spikes in log message volume that deviate from a dynamic baseline.
- **New Pattern Detection**: Flags new, previously unseen log message structures, which can indicate new errors or behavioral changes.
- **Configurable Sensitivity**: Easily tune anomaly trigger thresholds via a JSON configuration file.
- **Simple CLI Interface**: Start monitoring with a single command, specifying files and a configuration path.
- **Structured JSON Alerts**: Outputs alerts in a clean, machine-readable JSON format to `stdout` or a file.
- **Handles Log Rotation**: Automatically detects file truncation or replacement and continues monitoring seamlessly.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/log-anomaly-detector.git
    cd log-anomaly-detector
    ```

2.  Install the dependencies:
    ```bash
    npm install
    ```

3.  (Optional) Install globally to use the `log-ad` command from anywhere:
    ```bash
    npm install -g .
    ```

## Usage

The tool is run via the `log-ad` command line interface. You must specify which log file(s) or directorie(s) to watch.

### CLI Options

```
Usage: log-ad [options]

Start the log anomaly detector

Options:
  -f, --file     Path to a single log file to watch. Overrides config file
                 setting.                                             [string]
  -F, --files    Paths to multiple log files or directories to watch. Overrides
                 config file setting.                                  [array]
  -c, --config   Path to a JSON configuration file.                 [string]
  -h, --help     Show help                                           [boolean]
  -v, --version  Show version number                                 [boolean]
```

### Configuration File

For more advanced tuning, you can use a `config.json` file. See `config.example.json` for all available options.

```json
{
  "watcher": {
    "paths": ["/var/log/app.log"],
    "maxConcurrentFileReads": 10
  },
  "frequencyAnalysis": {
    "timeWindow": 60,
    "burstMultiplier": 10,
    "minLogCount": 50
  },
  "patternAnalysis": {
    "enabled": true
  },
  "alerter": {
    "output": "file",
    "filePath": "./alerts.log"
  },
  "pruneInterval": 300
}
```

To use a configuration file:

```bash
log-ad --config ./my-config.json
```

Note: CLI arguments like `--file` will always override settings in the configuration file.

## Examples

### Example 1: Monitor a single application log file

Watch a single log file and print any detected anomalies to the console (`stdout`). This is the simplest use case.

**Command:**

```bash
log-ad --file /var/log/my-app.log
```

**Expected Output (if a new error pattern appears):**

When a log line like `ERROR: Database connection failed: timeout expired` appears for the first time, the tool will output a JSON alert.

```json
{"timestamp":"2023-10-27T18:30:05.123Z","type":"NEW_PATTERN","details":{"message":"A new, previously unseen log pattern was detected.","pattern":"ERROR Database connection failed timeout expired","firstOccurrence":"2023-10-27T18:30:05.120Z","originalLine":"2023-10-27T18:30:05.120Z ERROR: Database connection failed: timeout expired"}}
```

### Example 2: Monitor multiple files and output alerts to a file

Watch an entire log directory and a specific file, using a custom configuration to write alerts to `anomalies.jsonl`.

**`custom-config.json`:**

```json
{
  "watcher": {
    "paths": ["/var/log/nginx/", "/var/log/syslog"]
  },
  "alerter": {
    "output": "file",
    "filePath": "./anomalies.jsonl"
  }
}
```

**Command:**

```bash
log-ad --config ./custom-config.json
```

**Expected Output (if a log burst occurs):**

If the number of logs suddenly spikes (e.g., due to a DoS attack or a cascading failure), an alert is written to `./anomalies.jsonl`.

```json
{"timestamp":"2023-10-27T19:00:15.456Z","type":"FREQUENCY_BURST","details":{"message":"Log volume burst detected.","logCount":550,"timeWindow":60,"currentRate":9.17,"movingAverage":0.85,"burstMultiplier":10,"minLogCount":50}}
```

## License

[MIT](LICENSE)