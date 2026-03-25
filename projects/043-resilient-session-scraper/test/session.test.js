'use strict';

import { test, describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'node:http';
import { createSession, Session } from '../lib/session.js';
import { BasePlugin } from '../lib/plugins/base-plugin.js';
import { ProxyManager } from '../lib/plugins/proxy-manager.js';

/**
 * @fileoverview Unit and integration tests for the Session class.
 * This test suite uses a mock HTTP server to simulate various web scenarios
 * and verifies that the Session class correctly handles cookies, CSRF tokens,
 * referer headers, User-Agent rotation, and plugin integration.
 */

// --- Mock Server Setup ---
const MOCK_SERVER_PORT = 3001; // Use a different port than the example
const MOCK_SERVER_URL = `http://localhost:${MOCK_SERVER_PORT}`;
let server;
const serverRequests = [];

/**
 * Starts a mock HTTP server for testing purposes.
 * It records incoming request headers and provides various endpoints
 * to test session functionality.
 */
before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, MOCK_SERVER_URL);
    const requestData = {
      method: req.method,
      path: url.pathname,
      headers: req.headers,
    };
    serverRequests.push(requestData);

    // Endpoint to inspect headers
    if (url.pathname === '/inspect-headers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(req.headers));
      return;
    }

    // Endpoint for cookie handling
    if (url.pathname === '/set-cookie') {
      res.writeHead(200, {
        'Set-Cookie': ['test_cookie=12345; Path=/', 'session_id=abc; HttpOnly'],
      });
      res.end('Cookies set.');
      return;
    }

    // Endpoint for CSRF token extraction
    if (url.pathname === '/login-form') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><meta name="csrf-token" content="meta-token-value"></head>
          <body>
            <form>
              <input type="hidden" name="_csrf" value="input-token-value">
            </form>
          </body>
        </html>
      `);
      return;
    }

    // Endpoint for testing POST requests
    if (url.pathname === '/submit' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received_body: body, received_headers: req.headers }));
      });
      return;
    }

    // Endpoint for testing retries (fails twice, then succeeds)
    if (url.pathname === '/retry-test') {
      if (serverRequests.filter(r => r.path === '/retry-test').length <= 2) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Service Unavailable');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Success on third attempt');
      }
      return;
    }
    
    // Endpoint for testing 4xx errors (should not retry)
    if (url.pathname === '/not-found') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }

    // Default endpoint
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>OK</h1>');
  });

  await new Promise((resolve) => server.listen(MOCK_SERVER_PORT, resolve));
  // Clear requests before each test run
  test.beforeEach(() => {
    serverRequests.length = 0;
  });
});

/**
 * Stops the mock server after all tests are complete.
 */
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('Session Class', () => {
  it('should be instantiated with default options', () => {
    const session = createSession();
    assert.ok(session instanceof Session, 'createSession should return a Session instance');
    assert.strictEqual(session.csrfToken, null, 'Initial CSRF token should be null');
    assert.ok(session.cookieJar, 'Session should have a cookie jar');
    assert.ok(session.getUserAgent(), 'Session should have a default User-Agent');
  });

  it('should accept custom headers and User-Agent at creation', async () => {
    const customUserAgent = 'TestScraper/1.0';
    const session = createSession({
      headers: { 'X-Custom-Header': 'TestValue' },
      userAgent: customUserAgent,
    });

    await session.get(`${MOCK_SERVER_URL}/inspect-headers`);

    assert.strictEqual(serverRequests.length, 1, 'Should have made one request');
    const lastRequest = serverRequests[0];
    assert.strictEqual(lastRequest.headers['x-custom-header'], 'TestValue');
    assert.strictEqual(lastRequest.headers['user-agent'], customUserAgent);
  });

  it('should automatically manage cookies', async () => {
    const session = createSession();
    await session.get(`${MOCK_SERVER_URL}/set-cookie`);

    const cookies = await session.cookieJar.getCookies(`${MOCK_SERVER_URL}/`);
    assert.strictEqual(cookies.length, 2, 'Should have stored two cookies');
    assert.ok(cookies.some(c => c.key === 'test_cookie' && c.value === '12345'), 'Should have test_cookie');
    assert.ok(cookies.some(c => c.key === 'session_id' && c.value === 'abc'), 'Should have session_id');

    await session.get(`${MOCK_SERVER_URL}/inspect-headers`);

    assert.strictEqual(serverRequests.length, 2, 'Should have made two requests');
    const lastRequest = serverRequests[1];
    assert.strictEqual(lastRequest.headers.cookie, 'test_cookie=12345; session_id=abc');
  });

  it('should automatically manage the Referer header', async () => {
    const session = createSession();
    const firstUrl = `${MOCK_SERVER_URL}/page1`;
    const secondUrl = `${MOCK_SERVER_URL}/page2`;

    await session.get(firstUrl);
    assert.strictEqual(serverRequests[0].headers.referer, undefined, 'First request should not have a referer');

    await session.get(secondUrl);
    assert.strictEqual(serverRequests[1].headers.referer, firstUrl, 'Second request should have referer from the first');

    // POST requests should not update the navigation history
    await session.post(`${MOCK_SERVER_URL}/submit`, {});
    assert.strictEqual(serverRequests[2].headers.referer, secondUrl, 'POST request should use previous referer');

    // A subsequent GET should still use the last GET's URL as referer
    await session.get(`${MOCK_SERVER_URL}/page3`);
    assert.strictEqual(serverRequests[3].headers.referer, secondUrl, 'Referer should not be updated by POST');
    
    session.clearHistory();
    await session.get(`${MOCK_SERVER_URL}/page4`);
    assert.strictEqual(serverRequests[4].headers.referer, undefined, 'Referer should be undefined after clearing history');
  });

  it('should extract CSRF token from meta tag (priority)', async () => {
    const session = createSession();
    await session.get(`${MOCK_SERVER_URL}/login-form`);
    assert.strictEqual(session.csrfToken, 'meta-token-value', 'Should prioritize meta tag for CSRF token');
  });

  it('should return a SessionResponse with functional helpers', async () => {
    const session = createSession();
    const response = await session.get(`${MOCK_SERVER_URL}/login-form`);

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.body.includes('<html>'), 'Response body should be a string');
    assert.ok(response.headers['content-type'].includes('text/html'), 'Response should have headers');
    
    const $ = response.$;
    assert.strictEqual(typeof $, 'function', 'Response should have a Cheerio instance');
    assert.strictEqual($('meta[name="csrf-token"]').attr('content'), 'meta-token-value');

    const postResponse = await session.post(`${MOCK_SERVER_URL}/submit`, { key: 'value' });
    const jsonBody = postResponse.json();
    assert.deepStrictEqual(jsonBody.received_body, '{"key":"value"}');
  });

  it('should handle POST requests with different body types', async () => {
    const session = createSession();

    // JSON body
    await session.post(`${MOCK_SERVER_URL}/submit`, { test: 'json' });
    let lastRequest = serverRequests.pop();
    let response = JSON.parse(lastRequest.headers['x-post-body']);
    assert.strictEqual(lastRequest.headers['content-type'], 'application/json; charset=utf-8');
    assert.deepStrictEqual(JSON.parse(response.received_body), { test: 'json' });

    // URLSearchParams body
    const formBody = new URLSearchParams({ test: 'form' });
    await session.post(`${MOCK_SERVER_URL}/submit`, formBody);
    lastRequest = serverRequests.pop();
    response = JSON.parse(lastRequest.headers['x-post-body']);
    assert.strictEqual(lastRequest.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.strictEqual(response.received_body, 'test=form');

    // String body
    await session.post(`${MOCK_SERVER_URL}/submit`, 'plain text');
    lastRequest = serverRequests.pop();
    response = JSON.parse(lastRequest.headers['x-post-body']);
    assert.strictEqual(response.received_body, 'plain text');
  });

  describe('User-Agent Rotation', () => {
    it('should use the same User-Agent per session by default', async () => {
      const session = createSession();
      await session.get(`${MOCK_SERVER_URL}/inspect-headers`);
      const firstUserAgent = serverRequests[0].headers['user-agent'];
      await session.get(`${MOCK_SERVER_URL}/inspect-headers`);
      const secondUserAgent = serverRequests[1].headers['user-agent'];
      assert.strictEqual(firstUserAgent, secondUserAgent);
    });

    it('should rotate User-Agent per request when configured', async () => {
      const session = createSession({ userAgentRotation: 'per-request' });
      await session.get(`${MOCK_SERVER_URL}/inspect-headers`);
      const firstUserAgent = serverRequests[0].headers['user-agent'];
      await session.get(`${MOCK_SERVER_URL}/inspect-headers`);
      const secondUserAgent = serverRequests[1].headers['user-agent'];
      assert.notStrictEqual(firstUserAgent, secondUserAgent, 'User-Agents should be different for each request');
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry on 5xx server errors and eventually succeed', async () => {
      const session = createSession({
        retryOptions: { retries: 2, minTimeout: 10, factor: 1 },
      });
      const response = await session.get(`${MOCK_SERVER_URL}/retry-test`);
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body, 'Success on third attempt');
      const requestsToEndpoint = serverRequests.filter(r => r.path === '/retry-test');
      assert.strictEqual(requestsToEndpoint.length, 3, 'Should have made 3 attempts');
    });

    it('should not retry on 4xx client errors', async () => {
      const session = createSession({
        retryOptions: { retries: 2, minTimeout: 10 },
      });

      await assert.rejects(
        session.get(`${MOCK_SERVER_URL}/not-found`),
        (err) => {
          assert.strictEqual(err.name, 'RequestHandlerError', 'Error should be a RequestHandlerError');
          assert.strictEqual(err.statusCode, 404, 'Status code should be 404');
          return true;
        },
        'Request should fail with a 404 error'
      );

      const requestsToEndpoint = serverRequests.filter(r => r.path === '/not-found');
      assert.strictEqual(requestsToEndpoint.length, 1, 'Should have made only 1 attempt');
    });
  });

  describe('Plugin System', () => {
    it('should throw an error if a non-plugin is used', () => {
      const session = createSession();
      assert.throws(
        () => session.use({}),
        /Plugin must be an instance of BasePlugin/,
        'Should throw TypeError for invalid plugin'
      );
    });

    it('should execute plugin preRequest and postRequest hooks', async () => {
      const preRequestHook = mock.fn();
      const postRequestHook = mock.fn();

      class TestPlugin extends BasePlugin {
        constructor() { super('TestPlugin'); }
        async preRequest(url, options) {
          options.headers['X-Plugin-Header'] = 'Injected';
          preRequestHook();
        }
        async postRequest(response) {
          assert.strictEqual(response.statusCode, 200);
          postRequestHook();
        }
      }

      const session = createSession();
      session.use(new TestPlugin());
      await session.get(`${MOCK_SERVER_URL}/inspect-headers`);

      assert.strictEqual(preRequestHook.mock.callCount(), 1, 'preRequest hook should be called once');
      assert.strictEqual(postRequestHook.mock.callCount(), 1, 'postRequest hook should be called once');
      const lastRequest = serverRequests[0];
      assert.strictEqual(lastRequest.headers['x-plugin-header'], 'Injected');
    });

    it('should execute plugin onRequestError hook on failure', async () => {
        const onRequestErrorHook = mock.fn();
        
        class ErrorPlugin extends BasePlugin {
            constructor() { super('ErrorPlugin'); }
            async onRequestError(error, url, options) {
                assert.ok(error instanceof Error);
                assert.strictEqual(error.statusCode, 404);
                assert.strictEqual(url.pathname, '/not-found');
                onRequestErrorHook(error);
            }
        }
        
        const session = createSession({ retryOptions: { retries: 0 } });
        session.use(new ErrorPlugin());

        await assert.rejects(session.get(`${MOCK_SERVER_URL}/not-found`));
        
        assert.strictEqual(onRequestErrorHook.mock.callCount(), 1, 'onRequestError hook should be called once');
    });

    it('should integrate with the ProxyManager plugin', async () => {
        const proxyUrl = 'http://user:pass@proxy.local:8080';
        const proxyManager = new ProxyManager({ proxies: [proxyUrl] });
        
        // We can't actually connect to a proxy, so we mock the dispatcher assignment
        const preRequestSpy = mock.method(proxyManager, 'preRequest', proxyManager.preRequest);

        const session = createSession();
        session.use(proxyManager);

        const requestOptions = {};
        await proxyManager.preRequest(new URL(MOCK_SERVER_URL), requestOptions);
        
        assert.ok(requestOptions.dispatcher instanceof Object, 'Dispatcher should be set');
        assert.strictEqual(requestOptions.context.proxyHref, proxyUrl, 'Proxy href should be in context');
        assert.strictEqual(preRequestSpy.mock.callCount(), 1);
    });
  });
});