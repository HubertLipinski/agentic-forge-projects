# REST Client Generator

A CLI tool that generates a ready-to-use JavaScript client for any RESTful API based on a simple JSON configuration file. It creates a modern, `async/await`-based class with methods for each defined endpoint, automatically handling URL parameters, query strings, and request bodies.

This tool eliminates the boilerplate of writing API fetching logic, especially for internal microservices or common third-party APIs, allowing you to focus on your application logic.

## Features

-   **Declarative API Definition**: Define your entire API client in a single, easy-to-understand JSON file.
-   **Modern JavaScript**: Generates a clean, modern ES Module class using `async/await` and the `fetch` API.
-   **Full REST Support**: Handles path parameters (e.g., `/users/:id`), query parameters, and JSON request bodies.
-   **Robust Validation**: Validates your configuration file against a JSON schema, providing clear, actionable error messages.
-   **Flexible & Maintainable**: Uses Mustache.js templates, making the generated code easy to customize and update.
-   **Developer-Friendly CLI**: A simple and powerful command-line interface built with `yargs` for easy integration into your workflow.

## Installation

You can install the tool globally to use it anywhere on your system:

```bash
npm install -g rest-client-generator
```

Alternatively, you can add it as a `devDependency` to your project and run it via `npx` or an npm script:

```bash
npm install --save-dev rest-client-generator
```

## Usage

The primary command generates a client from a configuration file.

### CLI Command

```bash
rest-client-gen <config> [options]
```

**Arguments:**

-   `<config>`: (Required) The path to your JSON configuration file (e.g., `api.config.json`).

**Options:**

-   `-o, --output <path>`: The path for the generated client file. If omitted, it defaults to a file next to your config (e.g., `api.config.json` -> `api.client.js`).
-   `-h, --help`: Show the help menu.
-   `-v, --version`: Show the version number.

### Configuration File (`*.config.json`)

This is the heart of the generator. You define the client's class name, base URL, and all its endpoints here.

**Core Properties:**

-   `clientClassName` (string, required): The PascalCase name for the generated class (e.g., `GitHubApiClient`).
-   `baseUrl` (string, required): The base URL for all API requests (e.g., `https://api.github.com`).
-   `defaultHeaders` (object, optional): A key-value map of headers to send with every request.
-   `endpoints` (object, required): A map where each key is a camelCase method name and the value is an object defining the endpoint.

**Endpoint Properties:**

-   `method` (string, required): The HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
-   `path` (string, required): The endpoint path, relative to `baseUrl`. Use colons for path parameters (e.g., `/users/:id`).
-   `description` (string, optional): A description used to generate a JSDoc comment for the method.
-   `queryParams` (array of strings, optional): A list of allowed query parameter names.
-   `body` (boolean, optional): Set to `true` if the endpoint expects a JSON request body.

## Examples

### 1. Basic Generation

Let's create a client for a simple JSONPlaceholder API.

**`jsonplaceholder.config.json`:**

```json
{
  "clientClassName": "JsonPlaceholderClient",
  "baseUrl": "https://jsonplaceholder.typicode.com",
  "endpoints": {
    "getPostById": {
      "method": "GET",
      "path": "/posts/:id",
      "description": "Retrieves a single post by its ID."
    },
    "listUserPosts": {
      "method": "GET",
      "path": "/posts",
      "description": "Lists all posts, with an optional filter by userId.",
      "queryParams": ["userId"]
    },
    "createPost": {
      "method": "POST",
      "path": "/posts",
      "description": "Creates a new post.",
      "body": true
    }
  }
}
```

**Run the generator:**

```bash
# This will create 'jsonplaceholder.client.js' in the same directory
rest-client-gen ./jsonplaceholder.config.json
```

**Using the generated client:**

```javascript
import { JsonPlaceholderClient } from './jsonplaceholder.client.js';

const apiClient = new JsonPlaceholderClient();

async function main() {
  try {
    // GET a single post
    const post = await apiClient.getPostById({ id: 1 });
    console.log('Fetched Post:', post.title);

    // GET posts filtered by a query parameter
    const userPosts = await apiClient.listUserPosts({ userId: 1 });
    console.log(`Found ${userPosts.length} posts for user 1.`);

    // POST a new resource
    const newPost = await apiClient.createPost({
      body: {
        title: 'My New Post',
        body: 'This is the content.',
        userId: 1,
      },
    });
    console.log('Created Post ID:', newPost.id);
  } catch (error) {
    console.error('API Error:', error.message, error.body);
  }
}

main();
```

### 2. GitHub API Client

Here's a more complex example using the GitHub API, demonstrating default headers and multiple path parameters.

**`github.config.json`:**

```json
{
  "clientClassName": "GitHubApiClient",
  "baseUrl": "https://api.github.com",
  "defaultHeaders": {
    "Accept": "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28"
  },
  "endpoints": {
    "getRepo": {
      "method": "GET",
      "path": "/repos/:owner/:repo",
      "description": "Fetches a specific repository."
    },
    "listRepoIssues": {
      "method": "GET",
      "path": "/repos/:owner/:repo/issues",
      "description": "Lists issues for a repository.",
      "queryParams": ["state", "per_page"]
    }
  }
}
```

**Run the generator with a custom output path:**

```bash
rest-client-gen ./github.config.json -o ./src/api/github.client.js
```

**Using the generated client:**

```javascript
import { GitHubApiClient } from './src/api/github.client.js';

// You can override defaults or add auth tokens in the constructor
const client = new GitHubApiClient({
  headers: {
    // Authorization: 'Bearer YOUR_PERSONAL_ACCESS_TOKEN',
  },
});

async function getRepoInfo() {
  try {
    const repo = await client.getRepo({
      owner: 'facebook',
      repo: 'react',
    });
    console.log(`Repo: ${repo.full_name}, Stars: ${repo.stargazers_count}`);

    const openIssues = await client.listRepoIssues({
      owner: 'facebook',
      repo: 'react',
      params: { state: 'open', per_page: 5 },
    });
    console.log(`Found ${openIssues.length} open issues (showing first 5).`);
  } catch (error) {
    console.error('GitHub API Error:', error.message);
  }
}

getRepoInfo();
```

## License

This project is licensed under the MIT License.