# Discord Performance Monitor Bot

## Description

An advanced Discord bot that provides real-time performance monitoring and analytics for Discord.js bots. It hooks into the client's events to track command latency, API request rates, gateway event processing times, and resource usage (memory, CPU), presenting the data through aggregated commands and an optional Prometheus-compatible metrics endpoint.

This tool is designed for bot developers who need to understand the performance characteristics of their application in a production environment. It helps identify bottlenecks, prevent rate-limiting, and ensure a smooth user experience.

## Features

- **Command Latency Tracking**: Measures command execution latency with p50, p90, and p99 percentiles.
- **API Request Monitoring**: Tracks Discord API request rates, response times, and 429 (rate limit) responses.
- **Gateway Event Analysis**: Measures the processing time for critical gateway events like `messageCreate` and `interactionCreate`.
- **Prometheus Integration**: Exposes a `/metrics` endpoint for Prometheus scraping, enabling advanced monitoring and alerting with Grafana.
- **On-Demand Summaries**: Provides a `/perf-summary` slash command to get a quick, human-readable performance snapshot directly in Discord.
- **Resource Tracking**: Monitors Node.js process memory (RSS, Heap) and CPU usage.
- **Error Reporting**: Counts unhandled promise rejections and uncaught exceptions, exposing them as a metric.
- **Low Overhead**: Built with an efficient, low-overhead design using streaming aggregators and non-blocking monitoring.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/example/discord-performance-monitor.git
    cd discord-performance-monitor
    ```

2.  **Install dependencies:**

    This project uses `npm` for package management.

    ```bash
    npm install
    ```

3.  **Configure environment variables:**

    Create a `.env` file in the root of the project and add your bot's configuration.

    ```env
    # .env
    DISCORD_BOT_TOKEN="your_bot_token_here"
    DISCORD_CLIENT_ID="your_bot_client_id_here"
    DISCORD_OWNER_ID="your_discord_user_id"
    METRICS_PORT="9090"
    # Optional: Channel ID for error reporting
    # ERROR_REPORTING_CHANNEL_ID="your_channel_id_here"
    ```

## Usage

The monitor is designed to be integrated into an existing Discord.js bot or run as a standalone monitoring instance. The `src/index.js` file provides a complete example of how to initialize the client and attach all monitors.

### Running the Bot

1.  **Deploy Slash Commands:**

    Before starting the bot, you need to register its slash commands (`/perf-summary`) with Discord.

    ```bash
    npm run deploy-commands
    ```

2.  **Start the Bot:**

    This command starts the Node.js process, initializes the Discord client, attaches all performance monitors, and starts the Prometheus metrics server.

    ```bash
    npm start
    ```

    You should see output similar to this in your console:
    ```
    [INFO] Bot is logged in as YourBot#1234
    [INFO] Command Latency Monitor attached.
    [INFO] API Request Monitor attached.
    [INFO] Gateway Event Monitor attached.
    [INFO] Process Stats Monitor attached. Sampling every 15000ms.
    [INFO] Prometheus metrics server listening on http://localhost:9090/metrics
    [INFO] Bot is ready!
    ```

### Integrating with Prometheus

1.  Ensure the bot is running and the `METRICS_PORT` is accessible from your Prometheus server.
2.  Add a new scrape configuration to your `prometheus.yml` file:

    ```yaml
    # prometheus.yml
    scrape_configs:
      - job_name: 'discord-bot'
        scrape_interval: 15s
        static_configs:
          - targets: ['<your_bot_server_ip>:9090']
    ```

3.  Restart Prometheus. It will now begin scraping metrics from your bot's `/metrics` endpoint. You can then use these metrics to build dashboards in Grafana or set up alerts.

## Examples

### Example 1: Getting a Performance Summary in Discord

Use the `/perf-summary` slash command in any server where the bot is present (or in a DM to the bot if you are the owner). This provides a quick, real-time snapshot of the bot's health.

**Command:**
`/perf-summary`

**Expected Output (as a Discord Embed):**


> **📈 Performance Summary**
>
> **⚡ Command Latency**
> **p50 (Median):** `120ms`
> **p90:** `250ms`
> **p99:** `680ms`
> *Total Executions: 1,428*
>
> **🌐 Discord API**
> **Gateway Ping:** `45ms`
> **Requests (last min):** `88`
> **Rate Limits (last min):** `0`
> *Serving 250 guilds*
>
> **🖥️ Process & Memory**
> **Memory (RSS):** `125.50 MB`
> **Memory (Heap):** `75.20 / 102.00 MB`
> **Process Uptime:** `3d 4h 15m 2s`
> **Client Uptime:** `1d 2h 5m 10s`

### Example 2: Querying Metrics in Prometheus

After integrating with Prometheus, you can query the collected metrics. For example, to see the 95th percentile command latency over the last hour, you would use a PromQL query like this:

```promql
# Query for the 95th percentile latency of the 'play' command in seconds
histogram_quantile(0.95, sum(rate(discord_command_latency_seconds_bucket{command_name="play"}[5m])) by (le))
```

To view the rate of 429 (rate limit) responses:

```promql
# Query for the number of API requests per second that resulted in a 429 status code
sum(rate(discord_api_requests_total{status_code="429"}[1m]))
```

These queries can be used to build powerful and informative dashboards in Grafana.

## License

This project is licensed under the ISC License. See the `LICENSE` file for details.