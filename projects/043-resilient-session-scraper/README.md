# Resilient Session Scraper

An advanced Node.js library for web scraping that maintains session integrity across requests. It automatically manages cookies, CSRF tokens, and referer headers, making it ideal for scraping complex, stateful websites like forums, e-commerce sites, or services that require a login.

## Features

- **Automatic Cookie Management**: Integrated `tough-cookie` jar per session to handle cookies seamlessly.
- **Dynamic CSRF Token Extraction**: Automatically finds and extracts CSRF tokens from meta tags and hidden form fields.
- **Automatic Referer Management**: Sets the `Referer` header based on your session's navigation history.
- **Resilient Requests**: Built-in request retry mechanism with exponential backoff using `p-retry`.
- **User-Agent Rotation**: Automated User-Agent rotation on a per-request or per-session basis.
- **Pluggable Architecture**: Easily extend functionality with plugins for proxy management, captcha solving, and more.
- **High-Performance HTTP**: Modern HTTP/1.1 and H/2 requests via the high-performance `undici` library.
- **Familiar DOM Parsing**: Cheerio-based DOM parsing for easy and efficient data extraction.

## Installation

Install the package using npm:

```bash
npm install resilient-session-scraper
```

## Usage

The primary entry point is the `createSession` factory function. It creates a new session instance, which you can use to make stateful HTTP requests.

### Basic GET Request

```javascript
import { createSession } from 'resilient-session-scraper';

async function main() {
  // Create a new session
  const session = createSession();

  // Make a GET request
  const response = await session.get('https://httpbin.org/get');

  // Access response data
  console.log('Status Code:', response.statusCode);

  // Use the built-in Cheerio instance to parse the HTML body
  // (In this case, httpbin returns JSON, so we use the .json() helper)
  const data = await response.json();
  console.log('Origin IP:', data.origin);
}

main();
```

### API Reference: `createSession(options)`

Creates a new `Session` instance.

-   `options` `<Object>`: Configuration for the session.
    -   `headers` `<Object>`: Default headers to send with every request.
    -   `userAgent` `<string>`: A specific User-Agent to use. If not provided, a random one is generated.
    -   `userAgentRotation` `<'per-session'|'per-request'>`: Strategy for rotating the User-Agent. Defaults to `'per-session'`.
    -   `retryOptions` `<Object>`: Default options for `p-retry` (e.g., `{ retries: 5 }`). Defaults to `{ retries: 3, minTimeout: 1000 }`.

The returned `Session` object has the following methods:

-   `session.get(url, [options])`: Makes a GET request.
-   `session.post(url, [body], [options])`: Makes a POST request.
-   `session.use(plugin)`: Registers a plugin with the session.

The response object from `get` and `post` includes:

-   `statusCode`: The HTTP status code.
-   `headers`: The response headers object.
-   `body`: The raw response body as a string.
-   `json()`: A function to parse the response body as JSON.
-   `$`: A Cheerio instance loaded with the response body for DOM traversal.

## Examples

### 1. Login and Scrape a Protected Page

This example demonstrates how to log into a website and then access a page that requires authentication. The session automatically handles cookies and CSRF tokens.

```javascript
import { createSession } from 'resilient-session-scraper';

async function loginAndScrape() {
  const session = createSession();

  // 1. Visit the login page to get cookies and a CSRF token
  const loginPage = await session.get('https://example.com/login');

  // The CSRF token is automatically extracted and stored in `session.csrfToken`
  console.log('Found CSRF Token:', session.csrfToken);

  // 2. Prepare login data
  // URLSearchParams is great for 'application/x-www-form-urlencoded' forms
  const credentials = new URLSearchParams({
    username: 'myuser',
    password: 'mypassword',
    _csrf: session.csrfToken, // Use the extracted token
  });

  // 3. Submit the login form
  // The session automatically sends the necessary cookies received from the first request
  const loginResponse = await session.post('https://example.com/login', credentials);

  // Check for a successful login (e.g., a redirect to the dashboard)
  if (loginResponse.statusCode === 302 && loginResponse.headers.location === '/dashboard') {
    console.log('Login successful!');

    // 4. Scrape the protected dashboard page
    const dashboard = await session.get('https://example.com/dashboard');
    const welcomeMessage = dashboard.$('h1').text();
    console.log('Scraped from dashboard:', welcomeMessage);
  } else {
    console.error('Login failed.');
  }
}

loginAndScrape();
```

### 2. Using a Proxy Manager Plugin

This example shows how to use the built-in `ProxyManager` plugin to rotate through a list of proxies for each request.

```javascript
import { createSession, ProxyManager } from 'resilient-session-scraper';

async function scrapeWithProxy() {
  // A list of your proxy servers
  const proxies = [
    'http://user1:pass1@proxy.example.com:8080',
    'http://user2:pass2@proxy.example.com:8081',
  ];

  // Create an instance of the ProxyManager plugin
  const proxyManager = new ProxyManager({ proxies });

  // Create a session and register the plugin
  const session = createSession();
  session.use(proxyManager);

  console.log('Making request with proxy...');

  // Each request made with this session will now be routed through a proxy
  const response = await session.get('https://api.ipify.org?format=json');
  const data = await response.json();

  console.log('Response received from IP:', data.ip);
  // Expected output: The IP address of one of your proxies, not your local IP.
}

scrapeWithProxy();
```

### Writing a Custom Plugin

Plugins allow you to hook into the request lifecycle. To create one, extend the `BasePlugin` class and implement its methods.

```javascript
import { BasePlugin } from 'resilient-session-scraper';

class CustomLoggerPlugin extends BasePlugin {
  constructor() {
    // The plugin name is required
    super('CustomLogger');
  }

  // Called before every request is sent
  async preRequest(url, requestOptions) {
    console.log(`[${this.name}] Making request to: ${url.href}`);
  }

  // Called after a successful response
  async postRequest(response) {
    console.log(`[${this.name}] Received response with status: ${response.statusCode}`);
  }

  // Called if a request fails (after all retries)
  async onRequestError(error, url) {
    console.error(`[${this.name}] Request to ${url.href} failed: ${error.message}`);
  }
}

// Usage:
// const session = createSession();
// session.use(new CustomLoggerPlugin());
// await session.get('https://example.com');
```

## License

[MIT](LICENSE)