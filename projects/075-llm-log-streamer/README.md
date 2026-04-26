# LLM Log Streamer

A Node.js utility to intercept and stream OpenAI API requests/responses to various log transports. It acts as a lightweight proxy, adding detailed logging for debugging, auditing, and cost analysis without altering application logic. Ideal for developers and teams needing better visibility into their LLM interactions.

## Features

-   **Local Proxy:** Acts as a local proxy server for the OpenAI API.
-   **Detailed Logging:** Automatically logs request headers, body, and timing for every API call.
-   **Stream Support:** Captures and logs both standard and streamed responses.
-   **Token Calculation:** Calculates and logs token usage (prompt, completion, total) for each call.
-   **Pluggable Transports:** A flexible transport system for sending logs (e.g., console, file).
-   **Security:** Masks sensitive information like API keys in logs by default.
-   **Graceful Shutdown:** Ensures pending logs are written before the application exits.
-   **CLI Interface:** Easy to start and configure via command-line flags.

## Installation

You can install and run the package directly via `npx` or clone the repository for development.

**Option 1: Using `npx` (Recommended for quick use)**

No installation is needed. You can run the proxy directly:

```bash
npx llm-log-streamer
```

**Option 2: Cloning the Repository**

This is useful if you want to contribute or modify the code.

```bash
# 1. Clone the repository
git clone https://github.com/your-username/llm-log-streamer.git

# 2. Navigate into the project directory
cd llm-log-streamer

# 3. Install dependencies
npm install

# 4. Run the proxy
npm start
```

## Usage

### 1. Start the Proxy Server

Run the following command in your terminal. This will start the proxy on `http://127.0.0.1:8080`.

```bash
npx llm-log-streamer
```

You should see output indicating the server is running:

```
INFO: LLM Log Streamer is running
    url: "http://127.0.0.1:8080"
    openaiTarget: "https://api.openai.com"
```

#### Command-Line Options

You can customize the proxy's behavior using flags. Run `npx llm-log-streamer --help` for a full list.

| Flag              | Alias | Environment Variable              | Description                                  | Default         |
| ----------------- | ----- | --------------------------------- | -------------------------------------------- | --------------- |
| `--port`          | `-p`  | `LLM_LOG_STREAMER_PORT`           | The port for the proxy server to listen on.  | `8080`          |
| `--host`          | `-h`  | `LLM_LOG_STREAMER_HOST`           | The hostname for the proxy server.           | `127.0.0.1`     |
| `--log-level`     |       | `LLM_LOG_STREAMER_LOG_LEVEL`      | The minimum log level to output.             | `info`          |
| `--no-log-pretty` |       | `LLM_LOG_STREAMER_LOG_PRETTY=false` | Disable pretty-printing for console logs.    | `true` (enabled) |

Example: Run on port `9000` with debug logging.

```bash
npx llm-log-streamer --port 9000 --log-level debug
```

### 2. Configure Your OpenAI Client

Update your application code to point the OpenAI client to the local proxy server. Set the `baseURL` to the proxy's address.

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  // The API key is read from the OPENAI_API_KEY environment variable.
  // The proxy will forward it to OpenAI.
  baseURL: 'http://127.0.0.1:8080/v1', // Use the proxy's URL
});

// Now, all calls using this `openai` instance will be logged.
async function main() {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'What is the capital of France?' }],
  });

  console.log(completion.choices[0].message.content);
}

main();
```

## Examples

The following examples assume the proxy is running and you are executing a script like `examples/basic-usage.js`.

### Example 1: Non-Streaming Request

When you make a standard API call, the proxy logs the complete request and response object, including token usage.

**Client Code:**

```javascript
const chatCompletion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'What is the capital of France?' }],
});
```

**Proxy Log Output (pretty-printed):**

```
INFO: OpenAI API call processed [id:a1b2c3d4-...]
    req: {
      "method": "POST",
      "url": "/v1/chat/completions",
      "headers": {
        "host": "127.0.0.1:8080",
        "authorization": "********",
        ...
      },
      "body": {
        "model": "gpt-3.5-turbo",
        "messages": [
          { "role": "user", "content": "What is the capital of France?" }
        ]
      }
    }
    res: {
      "statusCode": 200,
      "body": {
        "id": "chatcmpl-...",
        "choices": [
          { "message": { "role": "assistant", "content": "The capital of France is Paris." } }
        ],
        ...
      }
    }
    timing: {
      "totalMs": 543.21
    }
    usage: {
      "prompt_tokens": 15,
      "completion_tokens": 7,
      "total_tokens": 22
    }
```

### Example 2: Streaming Request

For streaming requests, the proxy logs the initial request and then captures all the server-sent event (SSE) chunks in the response body.

**Client Code:**

```javascript
const stream = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Write a short poem about Node.js.' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

**Proxy Log Output (pretty-printed):**

The log will show the `res.body` as an array of all the JSON objects received in the stream.

```
INFO: OpenAI API call processed [id:e5f6g7h8-...]
    req: {
      "method": "POST",
      "url": "/v1/chat/completions",
      "body": {
        "model": "gpt-3.5-turbo",
        "messages": [ ... ],
        "stream": true
      }
    }
    res: {
      "statusCode": 200,
      "body": [
        { "id": "chatcmpl-...", "choices": [ { "delta": { "role": "assistant", "content": "" } } ] },
        { "id": "chatcmpl-...", "choices": [ { "delta": { "content": "Async" } } ] },
        { "id": "chatcmpl-...", "choices": [ { "delta": { "content": " events" } } ] },
        { "id": "chatcmpl-...", "choices": [ { "delta": { "content": " flow," } } ] },
        ...
        { "special_event": "DONE" }
      ]
    }
    timing: {
      "totalMs": 890.12
    }
    usage: null // Token usage appears in the final stream chunk if available from the model
```

## License

This project is licensed under the MIT License.