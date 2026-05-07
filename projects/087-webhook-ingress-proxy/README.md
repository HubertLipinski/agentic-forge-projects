# Webhook Ingress Proxy

A configurable, stand-alone HTTP server that proxies incoming webhooks to multiple downstream services. It provides request validation, payload transformation, and retry logic, decoupling webhook consumers from producers. Ideal for microservice architectures or integrating third-party services like Stripe, GitHub, or Twilio reliably.

## Features

-   **Dynamic Routing**: Route incoming webhooks based on path, headers, or payload content.
-   **Signature Validation**: Secure your endpoints with HMAC-SHA256 signature verification (e.g., for GitHub/Stripe).
-   **Payload Validation**: Validate incoming payloads against a user-defined JSON Schema.
-   **Payload Transformation**: Use powerful JSONata expressions to reshape payloads before forwarding.
-   **Reliable Forwarding**: Automatic retries to downstream services with configurable exponential backoff and jitter.
-   **Fan-Out**: Forward a single incoming webhook to multiple downstream targets concurrently.
-   **Configuration Driven**: Manage all behavior from a single YAML or JSON file.
-   **Structured Logging**: Detailed, machine-readable logs with Pino for excellent traceability.

## Installation

You can use this project as a standalone service.

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/webhook-ingress-proxy.git
    cd webhook-ingress-proxy
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

## Usage

The proxy is started via a CLI command, pointing to a configuration file.

```sh
# Start the server with the default example configuration
npm start

# Or use the CLI directly with a custom config file
npx webhook-proxy --config ./config/my-routes.yml

# Set a different log level
npx webhook-proxy -c ./config/production.yml --log-level warn
```

### CLI Options

-   `--config, -c`: Path to the configuration file (YAML or JSON). Defaults to `config/routes.example.yml`.
-   `--log-level, -l`: Override the log level defined in the config file.
-   `--help, -h`: Show the help message.

### Configuration

All routing and proxy behavior is defined in a single configuration file. The server loads this file at startup. See `config/routes.example.yml` for a detailed example.

**Key Concepts:**

-   **Routes**: A route matches an incoming request (e.g., `POST /webhooks/github`) and defines the steps to process it.
-   **Validation**: Each route can have signature and/or payload validation steps.
-   **Transform**: A route can modify the incoming payload using a JSONata expression.
-   **Forward**: A route defines one or more downstream `targets` to send the final payload to.
-   **Retry Policy**: Each target can have its own retry policy (max retries, backoff, etc.).

Environment variables can be used in the configuration file for sensitive data like secrets or URLs, using the `${VAR_NAME}` syntax.

```yaml
# config/my-routes.yml
server:
  port: 5000

routes:
  - id: github-push-handler
    path: /webhooks/github
    methods: ['POST']
    validation:
      signature:
        algorithm: sha256
        # Secret is loaded from the GITHUB_WEBHOOK_SECRET environment variable
        secret: "${GITHUB_WEBHOOK_SECRET}"
        header: X-Hub-Signature-256
    transform:
      expression: >
        {
          "source": "github",
          "event": $."X-GitHub-Event" ~> $lowercase(),
          "repository": repository.full_name,
          "pusher": pusher.name,
          "commit_count": $count(commits)
        }
    forward:
      targets:
        - id: audit-service
          url: "${AUDIT_SERVICE_URL}"
        - id: notification-service
          url: "${NOTIFICATION_SERVICE_URL}"
          retry:
            maxRetries: 5
            initialInterval: 2000
```

## Examples

### Example 1: Proxying a GitHub Webhook

This example demonstrates receiving a GitHub `push` event, validating its signature, transforming the payload into a simpler format, and fanning it out to two internal services.

**Configuration (`config/github.yml`):**

```yaml
routes:
  - id: github-push-events
    path: /webhooks/github
    validation:
      signature:
        algorithm: sha256
        secret: "${GITHUB_SECRET}"
        header: X-Hub-Signature-256
    transform:
      expression: >
        {
          "repo": repository.full_name,
          "pusher": pusher.name,
          "ref": ref,
          "commits": commits[].{ "id": id, "message": message }
        }
    forward:
      targets:
        - id: activity-feed-service
          url: http://localhost:8081/events
        - id: ci-trigger-service
          url: http://localhost:8082/trigger-build
```

**Start the server:**

```sh
export GITHUB_SECRET="your-github-webhook-secret"
npx webhook-proxy -c ./config/github.yml
```

When a `push` webhook is sent to `http://localhost:3000/webhooks/github`, the proxy will:
1.  Validate the `X-Hub-Signature-256` header.
2.  Send a `202 Accepted` response to GitHub immediately.
3.  Transform the large GitHub payload into the smaller format defined by the `expression`.
4.  `POST` the transformed payload to `http://localhost:8081/events` and `http://localhost:8082/trigger-build` concurrently.

### Example 2: Validating and Proxying a Stripe Webhook

This example shows how to validate an incoming Stripe event against a JSON Schema before forwarding it.

**Configuration (`config/stripe.yml`):**

```yaml
routes:
  - id: stripe-invoice-paid
    path: /webhooks/stripe
    validation:
      signature:
        algorithm: sha256
        secret: "${STRIPE_SIGNING_SECRET}"
        header: Stripe-Signature
      payload:
        schema:
          type: object
          properties:
            type:
              const: "invoice.paid"
            data:
              type: object
              properties:
                object:
                  type: object
                  properties:
                    customer:
                      type: string
                  required: ["customer"]
              required: ["object"]
          required: ["type", "data"]
    forward:
      targets:
        - id: billing-service
          url: "${BILLING_SERVICE_URL}/invoices"
```

**Start the server:**

```sh
export STRIPE_SIGNING_SECRET="whsec_..."
export BILLING_SERVICE_URL="http://localhost:9000"
npx webhook-proxy -c ./config/stripe.yml
```

When an event is received at `http://localhost:3000/webhooks/stripe`:
1.  The proxy validates the Stripe signature.
2.  It then validates the payload to ensure `type` is `invoice.paid` and `data.object.customer` exists.
3.  If both checks pass, it sends a `202 Accepted` response and forwards the original payload to the billing service.
4.  If either check fails, it returns a `403` (for signature) or logs the error (for payload) without forwarding.

## License

[MIT](./LICENSE)