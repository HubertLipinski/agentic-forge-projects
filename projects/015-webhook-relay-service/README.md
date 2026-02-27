# Webhook Relay Service

A standalone, self-hostable API server that receives webhooks from various sources and securely relays them to internal or firewalled services. It provides a public endpoint, validation, request logging, and a configurable retry mechanism, simplifying webhook integration for developers without exposing their local or staging environments to the public internet.

## Features

*   **Dynamic Routing**: Configure webhook routes via a `routes.json` file. Changes are hot-reloaded without server restarts.
*   **Secure Ingestion**: Enforce HMAC SHA-256 signature validation on a per-route basis to ensure webhooks are from a trusted source.
*   **Reliable Delivery**: Automatic request retries with configurable exponential backoff for failed deliveries to handle transient network or service issues.
*   **Detailed Logging**: Structured JSON logging with Pino for easy debugging and monitoring of every request's lifecycle.
*   **Flexible Forwarding**: Per-route configuration for target URLs and forwarding specific HTTP headers.
*   **Configuration Validation**: Schema-based validation of `routes.json` using Ajv to prevent misconfigurations.
*   **Graceful Shutdown**: Ensures in-flight requests are completed before the server exits.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/webhook-relay-service.git
    cd webhook-relay-service
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up configuration:**
    *   Copy the example environment file: `cp .env.example .env`
    *   Copy the example routes file: `cp config/routes.example.json config/routes.json`
    *   Modify `config/routes.json` to define your webhook routes (see Configuration section below).

## Usage

### Development

For local development, this command starts the server with `pino-pretty` for human-readable logs and automatically restarts on file changes.

```bash
npm run dev
```

### Production

This command starts the server using standard `node`. Logs will be in JSON format.

```bash
npm start
```

### Environment Variables

Configure the server via a `.env` file or environment variables:

| Variable             | Description                                                   | Default       |
| -------------------- | ------------------------------------------------------------- | ------------- |
| `PORT`               | The port the server will listen on.                           | `3000`        |
| `HOST`               | The host interface to bind to.                                | `127.0.0.1`   |
| `LOG_LEVEL`          | The minimum log level to output (e.g., `info`, `debug`).      | `info`        |
| `ROUTES_CONFIG_PATH` | Absolute or relative path to the `routes.json` file.          | `config/routes.json` |

### Configuration (`config/routes.json`)

The core of the service is the `routes.json` file, which defines how incoming webhooks are handled.

```json
{
  "$schema": "./routes.schema.json",
  "routes": [
    {
      "path": "/webhooks/github",
      "targetUrl": "http://localhost:8080/hooks/github",
      "secret": "your-github-webhook-secret",
      "forwardHeaders": {
        "include": [ "X-GitHub-Event", "X-GitHub-Delivery" ]
      },
      "retry": {
        "attempts": 5,
        "initialDelay": 2000
      }
    },
    {
      "path": "/webhooks/stripe",
      "targetUrl": "http://my-billing-service:9000/stripe",
      "secret": "your-stripe-webhook-signing-secret"
    },
    {
      "path": "/webhooks/unsecured",
      "targetUrl": "http://localhost:3001/simple-hook"
    }
  ]
}
```

**Route Properties:**

*   `path` (required): The public path for the webhook (e.g., `/webhooks/github`).
*   `targetUrl` (required): The internal URL to which the webhook will be relayed.
*   `secret` (optional): The secret key for HMAC-SHA256 signature validation. If omitted, validation is skipped.
*   `forwardHeaders` (optional):
    *   `include`: An array of header names to forward from the original request.
    *   `static`: An object of static headers to add to the relayed request.
*   `retry` (optional):
    *   `attempts`: Max number of relay attempts (default: `3`).
    *   `initialDelay`: Delay in ms before the first retry (default: `1000`).
    *   `factor`: Multiplier for exponential backoff (default: `2`).
    *   `maxDelay`: Maximum delay in ms between retries (default: `30000`).

## Examples

### 1. Securely Relaying a GitHub Webhook

**`config/routes.json`:**

```json
{
  "routes": [
    {
      "path": "/webhooks/github-repo1",
      "targetUrl": "http://localhost:8080/process-push",
      "secret": "a-very-strong-and-long-secret-key"
    }
  ]
}
```

When GitHub sends a webhook to `http://<your-server>:3000/webhooks/github-repo1`, the service will:
1.  Receive the request.
2.  Validate the `X-Hub-Signature-256` header using the configured `secret`.
3.  If valid, immediately respond to GitHub with `202 Accepted`.
4.  Forward the request body and headers to `http://localhost:8080/process-push`.
5.  If the local service is down, it will retry up to 3 times with exponential backoff.

### 2. Relaying an Unsecured Webhook with Custom Headers

**`config/routes.json`:**

```json
{
  "routes": [
    {
      "path": "/webhooks/iot-device",
      "targetUrl": "http://192.168.1.50:5000/data-ingest",
      "forwardHeaders": {
        "static": {
          "Authorization": "Bearer internal-api-key",
          "X-Source": "WebhookRelay"
        }
      }
    }
  ]
}
```

When a request hits `http://<your-server>:3000/webhooks/iot-device`:
1.  No signature validation is performed as no `secret` is defined.
2.  The service responds with `202 Accepted`.
3.  The request is forwarded to `http://192.168.1.50:5000/data-ingest` with two additional headers: `Authorization` and `X-Source`.

## License

[MIT](LICENSE)