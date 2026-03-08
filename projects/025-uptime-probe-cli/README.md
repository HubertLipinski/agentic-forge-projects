# Uptime Probe CLI

A lightweight, zero-dependency command-line tool for monitoring the uptime and health of multiple HTTP endpoints. It periodically sends requests to a list of configured URLs and reports their status, response time, and availability percentage.

![Uptime Probe CLI Screenshot](https://raw.githubusercontent.com/your-username/uptime-probe-cli/main/docs/screenshot.png)
*(Note: Replace with an actual screenshot URL in your repository)*

## Features

-   **Concurrent Monitoring**: Checks multiple HTTP/HTTPS endpoints at the same time.
-   **YAML Configuration**: Manage endpoints, polling interval, and request parameters in a simple `probe.yml` file.
-   **Key Metrics**: Calculates and displays response time, status code, and overall availability for each service.
-   **State Persistence**: Remembers uptime statistics between runs, so your availability data is preserved.
-   **Graceful Shutdown**: Saves the latest statistics on exit (Ctrl+C) to prevent data loss.
-   **Clean Terminal UI**: Uses colors and spinners for a modern, readable dashboard experience.
-   **Zero-Dependency Runtime**: Built on pure Node.js `http`/`https` modules for a lightweight footprint.

## Installation

You can install and run `uptime-probe-cli` globally via npm, which will make the `uptime-probe` command available in your terminal.

```bash
npm install -g uptime-probe-cli
```

Alternatively, for development or local use, you can clone the repository:

```bash
git clone https://github.com/your-username/uptime-probe-cli.git
cd uptime-probe-cli
npm install
# Run locally using:
npm start
```

## Usage

1.  **Create a Configuration File**

    Create a `probe.yml` file in your project directory. You can start by copying the provided `probe.yml.example`:

    ```yaml
    # probe.yml

    # The polling interval in seconds. Minimum is 5.
    interval: 60

    # A list of endpoints to monitor.
    endpoints:
      - name: "My API"
        url: "https://api.example.com/health"

      - name: "Website Homepage"
        url: "https://www.example.com"
        timeout: 5000 # Optional: custom timeout in ms

      - name: "Internal Service"
        url: "http://localhost:8080/status"
        method: "POST" # Optional: specify HTTP method
        headers:
          X-Custom-Header: "probe-check"
    ```

2.  **Run the Monitor**

    If you created `probe.yml` in the current directory, you can start the monitor with no arguments:

    ```bash
    uptime-probe
    ```

    To specify a different configuration file, use the `--config` or `-c` flag:

    ```bash
    uptime-probe --config /path/to/my-config.yml
    ```

    Press `Ctrl+C` at any time to gracefully shut down the monitor and save its current state.

### Command-Line Options

| Option             | Alias | Description                                        | Default       |
| ------------------ | ----- | -------------------------------------------------- | ------------- |
| `--config <path>`  | `-c`  | Path to the YAML configuration file.               | `./probe.yml` |
| `--help`           | `-h`  | Show the help message.                             |               |
| `--version`        | `-v`  | Show the application version.                      |               |

## Examples

### Example 1: Basic Monitoring

With a simple `probe.yml` file:

```yaml
# probe.yml
interval: 10
endpoints:
  - name: "Public API"
    url: "https://api.publicapis.org/random"
  - name: "Down Service"
    url: "https://example.com/404"
```

Run the command:

```bash
uptime-probe
```

**Expected Output:**

The terminal will display a dashboard that updates every 10 seconds.

```
Uptime Probe Dashboard
Checking every 10 seconds. Press Ctrl+C to exit.

Status    Endpoint                 Availability     Last Check               Response Time
------------------------------------------------------------------------------------------------
✔ UP        Public API               100.00%          10/26/2023, 5:30:10 PM   152 ms
✖ DOWN      Down Service             0.00%            10/26/2023, 5:30:11 PM   88 ms
```

### Example 2: Monitoring a Slow Endpoint with Timeout

This configuration probes an endpoint that is intentionally slow. We set a short timeout to demonstrate failure detection.

```yaml
# slow-probe.yml
interval: 15
endpoints:
  - name: "Slow API"
    url: "https://httpbin.org/delay/5" # Responds after 5 seconds
    timeout: 3000 # Fails after 3 seconds
```

Run the command with the specific config file:

```bash
uptime-probe -c slow-probe.yml
```

**Expected Output:**

The probe will fail due to a timeout, and the status will be `ERROR`.

```
Uptime Probe Dashboard
Checking every 15 seconds. Press Ctrl+C to exit.

Status    Endpoint                 Availability     Last Check               Response Time
------------------------------------------------------------------------------------------------
⚠ ERROR     Slow API                 0.00%            10/26/2023, 5:35:15 PM   3005 ms
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.