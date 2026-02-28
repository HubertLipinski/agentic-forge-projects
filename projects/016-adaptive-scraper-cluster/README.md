# Adaptive Scraper Cluster

A distributed, fault-tolerant web scraping framework for Node.js. It coordinates multiple worker nodes to scrape websites at scale, automatically managing proxies, user-agents, and dynamic request delays to bypass anti-bot measures. Designed for data engineers and developers running large-scale, continuous scraping operations without relying on browser automation.

## Features

- **Distributed Architecture**: A central controller manages jobs and monitors multiple stateless worker nodes.
- **Durable Job Queue**: Uses Redis for a persistent, large-scale job queue, ensuring no jobs are lost.
- **Anti-Bot Evasion**:
  - Dynamic proxy rotation per request from a configurable pool.
  - User-Agent rotation to mimic different clients.
  - Adaptive request throttling with exponential backoff and cooldown based on server responses.
- **Pluggable Parsers**: Easily extendable parsing logic (e.g., Cheerio for HTML, or custom logic for JSON APIs).
- **Centralized Logging**: Structured JSON logging for easy aggregation and analysis.
- **Fault Tolerance**: Graceful shutdown and state persistence for recovery from failures.
- **Powerful CLI**: Simple command-line tools to start nodes and manage scraping jobs.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/adaptive-scraper-cluster.git
    cd adaptive-scraper-cluster
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Prerequisites:**
    - Node.js v20.0.0 or higher.
    - A running Redis instance (v5.0 or higher).

## Usage

The cluster consists of one `controller` node and one or more `worker` nodes. Jobs are submitted to the controller via a `submit` command.

### 1. Configuration

Create a `config.json` file in the project root. This file defines your proxies, user-agents, and Redis connection.

**`config.json`**
```json
{
  "redis": {
    "host": "127.0.0.1",
    "port": 6379,
    "keyPrefix": "asc:"
  },
  "proxies": [
    "http://user1:pass1@proxy.example.com:8000",
    "http://user2:pass2@proxy.example.com:8001"
  ],
  "userAgents": [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"
  ],
  "logging": {
    "level": "info",
    "pretty": true
  },
  "governor": {
    "initialDelay": 1000,
    "maxDelay": 60000
  },
  "worker": {
    "concurrency": 10
  }
}
```

### 2. Start the Controller

The controller manages the job queue and monitors workers. Run it in a dedicated terminal session.

```bash
# Using the binary
./bin/asc-controller

# Or using npm scripts
npm run controller
```

### 3. Start a Worker

Workers connect to the controller via Redis, pull jobs, and execute them. You can run multiple workers on different machines.

```bash
# Using the binary
./bin/asc-worker

# Or using npm scripts
npm run worker
```

### 4. Submit a Job

Create a JSON file defining the URLs to scrape.

**`jobs.json`**
```json
[
  {
    "id": "job-001",
    "url": "https://httpbin.org/get",
    "parser": "json-passthrough",
    "priority": 10,
    "metadata": { "category": "test" }
  },
  {
    "id": "job-002",
    "url": "https://toscrape.com/",
    "parser": "html-cheerio"
  }
]
```

Use the `asc-submit` command to add these jobs to the queue.

```bash
# Using the binary
./bin/asc-submit ./jobs.json

# Or using the global asc command
asc submit ./jobs.json
```

The controller will then distribute these jobs to available workers.

## Examples

### Example 1: Scraping a Quotes Website

This example scrapes the title and first H1 tag from `toscrape.com`.

1.  **Job Definition (`quotes-job.json`)**:
    ```json
    [
      {
        "id": "quotes-homepage",
        "url": "http://quotes.toscrape.com/",
        "parser": "html-cheerio"
      }
    ]
    ```

2.  **Submit the job**:
    ```bash
    ./bin/asc-submit ./quotes-job.json
    ```

3.  **Expected Output**:
    The worker that processes this job will log the result to a Redis `results` stream. The controller also logs aggregated metrics. In your worker's console (with pretty logging enabled), you'll see something like this:

    ```
    asc::Worker::job-quotes-homepage:: Job completed successfully.
    ```
    The actual data is pushed to Redis. A consumer application would read from the `asc:results` stream to get the parsed data:
    ```json
    {
      "jobId": "quotes-homepage",
      "status": "completed",
      "data": {
        "title": "Quotes to Scrape",
        "h1": "Quotes to Scrape",
        "url": "http://quotes.toscrape.com/"
      },
      "metadata": {}
    }
    ```

### Example 2: Scraping a JSON API

This example fetches data from a JSON endpoint and returns the parsed object.

1.  **Job Definition (`api-job.json`)**:
    ```json
    [
      {
        "id": "api-user-123",
        "url": "https://jsonplaceholder.typicode.com/todos/1",
        "parser": "json-passthrough"
      }
    ]
    ```

2.  **Submit the job**:
    ```bash
    ./bin/asc-submit ./api-job.json
    ```

3.  **Expected Output**:
    The data pushed to the Redis `asc:results` stream will contain the full JSON response:
    ```json
    {
      "jobId": "api-user-123",
      "status": "completed",
      "data": {
        "userId": 1,
        "id": 1,
        "title": "delectus aut autem",
        "completed": false
      },
      "metadata": {}
    }
    ```

## Creating Custom Parsers

The framework is designed to be extensible. To add a new parser:

1.  **Create a new parser function** in a file like `src/parser/custom-xml-parser.js`. The function must accept `(content, job)` and return the parsed data.

    ```javascript
    // src/parser/custom-xml-parser.js
    import { xml2js } from 'xml-js'; // Example library

    export async function parseXml(content, job) {
      try {
        const result = xml2js(content, { compact: true });
        return result;
      } catch (error) {
        throw new Error(`XML parsing failed: ${error.message}`);
      }
    }
    ```

2.  **Register the parser** in `src/parser/parser-factory.js`.

    ```javascript
    // src/parser/parser-factory.js
    import { parseXml } from './custom-xml-parser.js'; // Import your new parser
    // ... other imports

    const parserRegistry = new Map([
      ['html-cheerio', parseHtmlWithCheerio],
      ['json-passthrough', parseJsonPassthrough],
      ['xml-custom', parseXml], // Add your new parser here
    ]);

    // ... rest of the file
    ```

3.  **Use your new parser** in a job definition.

    ```json
    {
      "id": "sitemap-scrape",
      "url": "https://example.com/sitemap.xml",
      "parser": "xml-custom"
    }
    ```

## License

[MIT](LICENSE)