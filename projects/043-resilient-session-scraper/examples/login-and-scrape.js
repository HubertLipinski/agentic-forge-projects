'use strict';

/**
 * @fileoverview Example script demonstrating a common web scraping workflow:
 * 1. Create a scraping session.
 * 2. Visit a login page to get session cookies and a CSRF token.
 * 3. Submit a login form using a POST request with credentials and the token.
 * 4. After successful login, navigate to a protected page.
 * 5. Scrape data from the protected page.
 *
 * This example uses a mock server to simulate a real website, allowing the
 * script to be run and tested without depending on an external service.
 */

import { createServer } from 'node:http';
import { createSession } from '../index.js';

// --- Mock Server Setup ---
// This server simulates a website with a login form and a protected dashboard.
const MOCK_SERVER_PORT = 3000;
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;

/**
 * Creates and starts a mock HTTP server.
 * @returns {Promise<import('node:http').Server>} A promise that resolves with the server instance.
 */
function startMockServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, MOCK_SERVER_URL);
    const cookies = req.headers.cookie || '';

    // Route: /login (GET) - Displays the login form
    if (url.pathname === '/login' && req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html');
      // Set a session cookie
      res.setHeader('Set-Cookie', 'sessionid=abc123xyz; Path=/; HttpOnly');
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Login Page</title>
          <meta name="csrf-token" content="mock-csrf-token-from-meta">
        </head>
        <body>
          <h1>Please Log In</h1>
          <form action="/login" method="post">
            <input type="hidden" name="_csrf" value="mock-csrf-token-from-input">
            <input type="text" name="username" value="user">
            <input type="password" name="password" value="pass">
            <button type="submit">Log In</button>
          </form>
        </body>
        </html>
      `);
      return;
    }

    // Route: /login (POST) - Handles the login submission
    if (url.pathname === '/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        const params = new URLSearchParams(body);
        if (
          params.get('username') === 'testuser' &&
          params.get('password') === 'supersecret' &&
          params.get('_csrf') === 'mock-csrf-token-from-meta' // Our library prefers meta tokens
        ) {
          // Successful login, set an authentication cookie
          res.setHeader('Set-Cookie', 'authenticated=true; Path=/; HttpOnly');
          res.writeHead(302, { 'Location': '/dashboard' }); // Redirect to dashboard
          res.end();
        } else {
          res.writeHead(401);
          res.end('<h1>Login Failed</h1>');
        }
      });
      return;
    }

    // Route: /dashboard (GET) - A protected page
    if (url.pathname === '/dashboard' && req.method === 'GET') {
      if (cookies.includes('authenticated=true')) {
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html>
          <body>
            <h1 id="welcome-message">Welcome, testuser!</h1>
            <p>This is your protected dashboard.</p>
          </body>
          </html>
        `);
      } else {
        res.writeHead(403);
        res.end('<h1>Access Denied</h1>');
      }
      return;
    }

    // Default 404
    res.writeHead(404);
    res.end('Not Found');
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(MOCK_SERVER_PORT, () => {
      console.log(`Mock server running at ${MOCK_SERVER_URL}`);
      resolve(server);
    });
  });
}


/**
 * Main function to run the scraping demonstration.
 */
async function main() {
  let server;
  try {
    // Start the local server to scrape against
    server = await startMockServer();

    console.log('\n--- Starting Scraping Demo ---');

    // 1. Create a new scraping session.
    // We can set default options, like a custom User-Agent.
    const session = createSession({
      userAgent: 'MyAwesomeScraper/1.0',
      retryOptions: { retries: 2 }, // Configure retry behavior
    });
    console.log('✅ Session created.');
    console.log(`Initial User-Agent: ${session.getUserAgent()}`);

    // 2. Make a GET request to the login page.
    // The session will automatically store the 'sessionid' cookie.
    // It will also automatically find and store the CSRF token.
    console.log(`\n[Step 1] Visiting login page at ${MOCK_SERVER_URL}/login...`);
    const loginPageResponse = await session.get(`${MOCK_SERVER_URL}/login`);

    if (loginPageResponse.statusCode !== 200) {
      throw new Error(`Failed to load login page. Status: ${loginPageResponse.statusCode}`);
    }

    console.log('✅ Login page loaded successfully.');
    console.log(`   - Status Code: ${loginPageResponse.statusCode}`);
    console.log(`   - CSRF Token Found: ${session.csrfToken}`); // Should be 'mock-csrf-token-from-meta'

    // 3. Perform a POST request to log in.
    // We'll send the credentials and the automatically extracted CSRF token.
    // The body can be a URLSearchParams object for form data.
    const loginCredentials = new URLSearchParams({
      username: 'testuser',
      password: 'supersecret',
      _csrf: session.csrfToken, // Use the token we just got
    });

    console.log('\n[Step 2] Submitting login form...');
    const loginPostResponse = await session.post(
      `${MOCK_SERVER_URL}/login`,
      loginCredentials
    );

    // The mock server responds with a 302 redirect on successful login.
    // The session automatically handles the 'authenticated=true' cookie.
    if (loginPostResponse.statusCode !== 302) {
      throw new Error(`Login failed! Status: ${loginPostResponse.statusCode}`);
    }

    console.log('✅ Login successful (Redirect received).');
    console.log(`   - Status Code: ${loginPostResponse.statusCode}`);
    console.log(`   - Redirecting to: ${loginPostResponse.headers.location}`);

    // 4. Follow the redirect to the protected dashboard.
    // The session will now automatically include the 'authenticated=true' cookie.
    // The 'Referer' header will be set to the login page URL.
    const dashboardUrl = new URL(loginPostResponse.headers.location, MOCK_SERVER_URL);
    console.log(`\n[Step 3] Navigating to protected dashboard at ${dashboardUrl.href}...`);

    const dashboardResponse = await session.get(dashboardUrl);

    if (dashboardResponse.statusCode !== 200) {
      throw new Error(`Failed to access dashboard. Status: ${dashboardResponse.statusCode}`);
    }

    console.log('✅ Successfully accessed protected dashboard.');
    console.log(`   - Status Code: ${dashboardResponse.statusCode}`);

    // 5. Scrape data from the protected page using the Cheerio-powered `$` accessor.
    const welcomeMessage = dashboardResponse.$('#welcome-message').text();
    console.log(`\n[Step 4] Scraping data from dashboard...`);
    console.log(`   - Scraped Welcome Message: "${welcomeMessage}"`);

    console.log('\n--- Demo Completed Successfully ---');

  } catch (error) {
    console.error('\n--- An error occurred during the scraping demo ---');
    console.error(error);
    process.exitCode = 1;
  } finally {
    // Clean up by stopping the mock server.
    if (server) {
      server.close(() => console.log('\nMock server stopped.'));
    }
  }
}

main();