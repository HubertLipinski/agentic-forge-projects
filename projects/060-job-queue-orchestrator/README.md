# Job Queue Orchestrator

A standalone, RESTful API server for orchestrating distributed, long-running jobs. It provides endpoints to enqueue, query, and cancel tasks, managing job state, retries, and concurrency. Designed for developers needing a lightweight, persistent job queue for background processing without the overhead of complex systems like RabbitMQ or Celery. It uses a file-based storage engine for simplicity and durability.

## Features

- **REST API**: Simple HTTP interface for job lifecycle management (enqueue, status, cancel, list).
- **Persistent Storage**: Durable, file-based storage (`jobs.db.jsonl`) for job state, ensuring no data loss on restart.
- **Configurable Concurrency**: Control the number of jobs that run simultaneously to manage system load.
- **Automatic Retries**: Failed tasks are automatically retried with exponential backoff.
- **Webhook Notifications**: Push notifications to a URL when a job completes or fails.
- **Graceful Shutdown**: Ensures all running jobs finish before the server stops.
- **Structured Logging**: Detailed JSON logs for easy monitoring and debugging.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/job-queue-orchestrator.git
    cd job-queue-orchestrator
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Usage

Start the server with the default configuration:

```bash
npm start
```

The server will start on `http://localhost:3000` by default.

### API Endpoints

- `POST /jobs`: Enqueue a new job.
- `GET /jobs`: List all jobs with optional filtering.
- `GET /jobs/:id`: Get the status and details of a specific job.
- `POST /jobs/:id/cancel`: Cancel a pending or running job.

### Configuration

You can customize the server by creating a `config/local.js` file or setting environment variables.

| Variable                  | `config/default.js` Key       | Description                                  | Default      |
| ------------------------- | ----------------------------- | -------------------------------------------- | ------------ |
| `PORT`                    | `port`                        | API server port.                             | `3000`       |
| `LOG_LEVEL`               | `logLevel`                    | Logging level (`info`, `debug`, `error`).    | `info`       |
| `JOS_CONCURRENCY`         | `concurrency`                 | Max number of jobs to run at once.           | `5`          |
| `JOS_STORAGE_PATH`        | `storagePath`                 | Path to the job database file.               | `data/jobs.db.jsonl` |
| `JOS_RETRY_MAX`           | `retries.max`                 | Default max retries for a job.               | `3`          |
| `JOS_RETRY_DELAY`         | `retries.delay`               | Base delay for retries (ms).                 | `1000`       |

## Examples

### 1. Enqueue a New Job

Send a `POST` request to `/jobs` to create a new job. This example creates an `image-resize` job and requests a webhook notification on completion.

**Request:**
```bash
curl -X POST http://localhost:3000/jobs \
-H "Content-Type: application/json" \
-d '{
  "type": "image-resize",
  "payload": {
    "sourceUrl": "https://example.com/image.jpg",
    "width": 800,
    "height": 600
  },
  "options": {
    "webhookUrl": "https://your-service.com/webhook-receiver"
  }
}'
```

**Response (202 Accepted):**
```json
{
  "id": "2qYpL8fJm9g-0JDMbcJqL",
  "type": "image-resize",
  "payload": {
    "sourceUrl": "https://example.com/image.jpg",
    "width": 800,
    "height": 600
  },
  "status": "pending",
  "options": {
    "maxRetries": 3,
    "webhookUrl": "https://your-service.com/webhook-receiver",
    "ttl": 86400
  },
  "history": [
    {
      "status": "pending",
      "timestamp": "2023-10-27T10:00:00.123Z"
    }
  ],
  "createdAt": "2023-10-27T10:00:00.123Z",
  "updatedAt": "2023-10-27T10:00:00.123Z",
  "runAt": "2023-10-27T10:00:00.123Z",
  "attempts": 0,
  "output": null,
  "error": null
}
```

### 2. Check Job Status

Retrieve the job's details using its ID. After a few moments, the job should move to `completed`.

**Request:**
```bash
curl http://localhost:3000/jobs/2qYpL8fJm9g-0JDMbcJqL
```

**Response (200 OK):**
```json
{
  "id": "2qYpL8fJm9g-0JDMbcJqL",
  "type": "image-resize",
  "status": "completed",
  "payload": {
    "sourceUrl": "https://example.com/image.jpg",
    "width": 800,
    "height": 600
  },
  "output": {
    "message": "Resized image from payload to 800x600.",
    "newPath": "/processed/images/2qYpL8fJm9g-0JDMbcJqL.jpg",
    "size": 342
  },
  "error": null,
  "history": [
    {
      "status": "pending",
      "timestamp": "2023-10-27T10:00:00.123Z"
    },
    {
      "status": "running",
      "timestamp": "2023-10-27T10:00:01.456Z"
    },
    {
      "status": "completed",
      "timestamp": "2023-10-27T10:00:02.789Z"
    }
  ],
  "attempts": 1,
  "createdAt": "2023-10-27T10:00:00.123Z",
  "updatedAt": "2023-10-27T10:00:02.789Z",
  "completedAt": "2023-10-27T10:00:02.789Z",
  "...": "..."
}
```

### 3. List Failed Jobs

You can filter the job list by status. This is useful for monitoring and debugging.

**Request:**
```bash
curl "http://localhost:3000/jobs?status=failed&limit=5"
```

**Response (200 OK):**
```json
{
  "count": 1,
  "limit": 5,
  "offset": 0,
  "data": [
    {
      "id": "XkZ_s9g-0JDMbcJqL-aBc",
      "type": "send-email",
      "status": "failed",
      "payload": {
        "shouldFail": true
      },
      "error": {
        "name": "Error",
        "message": "Job was instructed to fail via payload.",
        "stack": "Error: Job was instructed to fail via payload.\n    at executeJob (...)"
      },
      "attempts": 4,
      "failedAt": "2023-10-27T11:30:15.999Z",
      "...": "..."
    }
  ]
}
```

## License

This project is licensed under the MIT License.