# Job Queue Manager

A lightweight, Redis-backed, persistent job queue API server for Node.js. It's designed for developers who need a simple but reliable way to offload background tasks (like sending emails, processing images, or generating reports) from their main application thread. It provides a RESTful API to enqueue, check the status of, and manage jobs without the complexity of larger message queue systems.

## Features

-   **RESTful API**: Simple HTTP endpoints for enqueuing, querying, and canceling jobs.
-   **Persistent & Reliable**: Backed by Redis, ensuring jobs are not lost on application restart.
-   **Decoupled Architecture**: A dedicated worker process executes jobs, separate from the API server.
-   **Job Prioritization**: Submit high-priority jobs to be processed sooner.
-   **Delayed Execution**: Schedule jobs to run at a future time.
-   **Automatic Retries**: Failed jobs are automatically retried with configurable exponential backoff.
-   **Webhook Notifications**: Notify external services upon job completion or failure.
-   **Schema Validation**: Enforces a strict and valid job payload structure using Ajv.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/job-queue-manager.git
    cd job-queue-manager
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    Create a `.env` file by copying the example and edit it with your configuration. You must have a running Redis instance.

    ```bash
    cp .env.example .env
    ```

    Your `.env` file should look like this:

    ```ini
    # .env
    # Redis connection URL
    REDIS_URL="redis://127.0.0.1:6379"

    # API Server configuration
    SERVER_PORT=3000

    # Worker configuration (not used by the server)
    WORKER_CONCURRENCY=1

    # Logging level (e.g., 'info', 'debug', 'warn', 'error')
    LOG_LEVEL=info
    ```

## Usage

The system consists of two main components: the API server and the background worker. You need to run both for the system to be fully operational.

### 1. Start the API Server

The server exposes the RESTful API for managing jobs.

```bash
npm start server
# or
npm run server
```

The API server will start on the port specified in your `.env` file (default: `3000`).

### 2. Start the Worker

The worker polls Redis for new jobs and executes them. You can run multiple worker processes for higher throughput.

```bash
npm start worker
# or
npm run worker
```

The worker will connect to Redis and begin processing jobs from the queue.

## API Reference

### POST /jobs

Enqueues a new job.

**Request Body:**

```json
{
  "type": "send-welcome-email",
  "payload": {
    "userId": "user-123",
    "template": "welcome-v2"
  },
  "priority": 5,
  "delay": 10000,
  "webhook": {
    "url": "https://api.example.com/job-updates"
  }
}
```

-   `type` (string, **required**): An identifier for the job task (e.g., `process-image`).
-   `payload` (object, **required**): Data needed for the job.
-   `priority` (integer, optional): `10` (high) to `-10` (low). Default: `0`.
-   `delay` (integer, optional): Milliseconds to wait before the job is available. Default: `0`.
-   `retry` (object, optional): Override default retry settings (`{ "maxAttempts": 3, "backoff": 1000 }`).
-   `webhook` (object, optional): URL to notify on job completion/failure.

**Success Response (201 Created):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "type": "send-welcome-email",
  "status": "delayed",
  "createdAt": "2023-10-27T10:00:00.000Z"
}
```

### GET /jobs/:jobId

Retrieves the status and details of a specific job.

**Success Response (200 OK):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "type": "send-welcome-email",
  "payload": {
    "userId": "user-123",
    "template": "welcome-v2"
  },
  "status": "completed",
  "priority": 5,
  "createdAt": 1698397200000,
  "updatedAt": 1698397215000,
  "completedAt": 1698397215000,
  "result": {
    "success": true,
    "message": "Job a1b2c3d4... completed successfully."
  }
}
```

**Not Found Response (404 Not Found):**

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Job with ID '...' not found."
}
```

### DELETE /jobs/:jobId

Cancels a job. A job can only be canceled if its status is `waiting` or `delayed`.

**Success Response (200 OK):**

```json
{
  "message": "Job 'a1b2c3d4-e5f6-7890-1234-567890abcdef' was successfully canceled.",
  "job": {
    "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "status": "canceled",
    "updatedAt": 1698397205000
    // ... other job properties
  }
}
```

**Conflict Response (409 Conflict):**

If the job is already processing or completed.

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Job with ID '...' cannot be canceled because it is in the 'processing' state."
}
```

## Examples

Here are a few `curl` examples demonstrating how to interact with the API.

### 1. Enqueue a Simple Job

This creates a job to generate a report. It will be added to the queue immediately with default priority.

```bash
curl -X POST http://localhost:3000/jobs \
-H "Content-Type: application/json" \
-d '{
  "type": "generate-report",
  "payload": {
    "reportId": "xyz-789",
    "format": "pdf"
  }
}'
```

**Expected Output:**

```json
{
  "id": "c7a8e1b2-f3d4-4c5e-b6a7-f8d9e0c1b2a3",
  "type": "generate-report",
  "status": "waiting",
  "createdAt": "2023-10-27T10:30:00.123Z"
}
```

### 2. Enqueue a Delayed, High-Priority Job with a Webhook

This job sends a notification but is delayed by 30 seconds. It has a high priority and will notify an external service when it's done.

```bash
curl -X POST http://localhost:3000/jobs \
-H "Content-Type: application/json" \
-d '{
  "type": "send-push-notification",
  "payload": {
    "recipient": "push-token-abc",
    "message": "Your order has shipped!"
  },
  "priority": 10,
  "delay": 30000,
  "webhook": {
    "url": "https://webhook.site/your-unique-id",
    "headers": {
      "X-Auth-Token": "secret-token"
    }
  }
}'
```

**Expected Output:**

```json
{
  "id": "b1c2d3e4-f5a6-7b8c-9d0e-f1a2b3c4d5e6",
  "type": "send-push-notification",
  "status": "delayed",
  "createdAt": "2023-10-27T10:35:00.456Z"
}
```

After 30 seconds, the worker will process this job. Your webhook URL will receive a POST request similar to this:

```json
{
  "jobId": "b1c2d3e4-f5a6-7b8c-9d0e-f1a2b3c4d5e6",
  "status": "completed",
  "type": "send-push-notification",
  "completedAt": 1698399330500,
  "result": {
    "success": true,
    "message": "Job b1c2d3e4... completed successfully."
  }
}
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.