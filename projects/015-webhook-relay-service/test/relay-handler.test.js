/**
 * @fileoverview Unit tests for the relay-handler module.
 *
 * These tests verify the core webhook relaying logic, particularly focusing on
 * the retry mechanism with exponential backoff. The `axios` library is mocked
 * to simulate various network and server responses (success, retryable errors,
 * non-retryable errors, and network failures) without making actual HTTP requests.
 * The tests use Node.js's built-in `node:test` and `node:assert` modules, along with
 * the modern `mock` API introduced in Node.js.
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { relayRequest } from '../src/services/relay-handler.js';
import axios from 'axios';

// --- Test Setup ---

/**
 * A mock logger to be attached to the mock request object.
 * It provides no-op implementations for logging methods to prevent console noise
 * during tests and allows for spying if needed in the future.
 */
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
};

/**
 * Creates a mock Fastify request object for testing purposes.
 *
 * @param {object} [options={}] - Options to build the mock request.
 * @param {string} [options.id='test-request-id'] - The request ID for logging.
 * @param {object} [options.headers={}] - Request headers.
 * @param {object} [options.body={}] - The parsed request body.
 * @returns {object} A mock request object with `id`, `headers`, `body`, and `log` properties.
 */
const createMockRequest = ({ id = 'test-request-id', headers = {}, body = {} } = {}) => ({
  id,
  headers,
  body,
  log: mockLogger,
});

/**
 * Creates a base route configuration for tests.
 *
 * @param {object} [overrides={}] - Properties to override in the base config.
 * @returns {object} A route configuration object.
 */
const createRouteConfig = (overrides = {}) => ({
  targetUrl: 'http://internal-service.test/hook',
  retry: {
    attempts: 3,
    initialDelay: 10, // Use a very short delay for fast tests
    factor: 2,
  },
  ...overrides,
});

// --- Test Suites ---

describe('relayRequest', () => {
  // Mock the global timer functions to control time in tests (for delays).
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  // Restore the original axios and timer implementations after each test.
  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
  });

  it('should succeed on the first attempt with a 2xx response', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig();
    const axiosMock = mock.fn(axios, {
      mockImplementation: async () => ({ status: 200, data: 'OK' }),
    });

    const result = await relayRequest({ request, routeConfig });

    assert.strictEqual(axiosMock.mock.callCount(), 1, 'axios should be called exactly once');
    assert.deepStrictEqual(result, { success: true, status: 200, finalAttempt: 1 });
  });

  it('should not retry on a non-retryable 4xx error (e.g., 400 Bad Request)', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig();
    const axiosMock = mock.fn(axios, {
      mockImplementation: async () => ({ status: 400, data: 'Bad Request' }),
    });

    const result = await relayRequest({ request, routeConfig });

    assert.strictEqual(axiosMock.mock.callCount(), 1, 'axios should be called only once');
    assert.deepStrictEqual(result, { success: false, status: 400, finalAttempt: 1 });
  });

  it('should retry on a retryable 5xx error and then succeed', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig({ retry: { attempts: 3, initialDelay: 10 } });
    const axiosMock = mock.fn(axios);

    // Fail on the first attempt, succeed on the second.
    axiosMock.mock.mockImplementationOnce(async () => ({ status: 503, data: 'Service Unavailable' }));
    axiosMock.mock.mockImplementationOnce(async () => ({ status: 202, data: 'Accepted' }));

    const promise = relayRequest({ request, routeConfig });

    // Allow the first (failed) attempt to complete.
    await mock.timers.tickAsync(0);
    assert.strictEqual(axiosMock.mock.callCount(), 1, 'axios should be called once initially');

    // Advance time past the first retry delay (10ms).
    await mock.timers.tickAsync(10);
    assert.strictEqual(axiosMock.mock.callCount(), 2, 'axios should be called a second time after delay');

    const result = await promise;
    assert.deepStrictEqual(result, { success: true, status: 202, finalAttempt: 2 });
  });

  it('should retry on a retryable 429 error', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig({ retry: { attempts: 2, initialDelay: 10 } });
    const axiosMock = mock.fn(axios);

    // Fail with 429, then succeed.
    axiosMock.mock.mockImplementationOnce(async () => ({ status: 429, data: 'Too Many Requests' }));
    axiosMock.mock.mockImplementationOnce(async () => ({ status: 200, data: 'OK' }));

    const promise = relayRequest({ request, routeConfig });

    await mock.timers.tickAsync(0); // First attempt
    await mock.timers.tickAsync(10); // Advance past delay for second attempt

    const result = await promise;
    assert.deepStrictEqual(result, { success: true, status: 200, finalAttempt: 2 });
    assert.strictEqual(axiosMock.mock.callCount(), 2);
  });

  it('should retry on network errors (axios throws) and then succeed', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig({ retry: { attempts: 3, initialDelay: 10 } });
    const axiosMock = mock.fn(axios);

    // Fail with a network error, then succeed.
    axiosMock.mock.mockImplementationOnce(async () => { throw new Error('Network Error'); });
    axiosMock.mock.mockImplementationOnce(async () => ({ status: 200, data: 'OK' }));

    const promise = relayRequest({ request, routeConfig });

    await mock.timers.tickAsync(0); // First attempt (throws)
    await mock.timers.tickAsync(10); // Advance past delay

    const result = await promise;
    assert.deepStrictEqual(result, { success: true, status: 200, finalAttempt: 2 });
    assert.strictEqual(axiosMock.mock.callCount(), 2);
  });

  it('should exhaust all retry attempts on persistent failures and return failure', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig({ retry: { attempts: 3, initialDelay: 10, factor: 2 } });
    const axiosMock = mock.fn(axios, {
      mockImplementation: async () => ({ status: 500, data: 'Internal Server Error' }),
    });

    const promise = relayRequest({ request, routeConfig });

    // Attempt 1
    await mock.timers.tickAsync(0);
    assert.strictEqual(axiosMock.mock.callCount(), 1, 'Attempt 1 failed');

    // Attempt 2 (delay = 10ms)
    await mock.timers.tickAsync(10);
    assert.strictEqual(axiosMock.mock.callCount(), 2, 'Attempt 2 failed');

    // Attempt 3 (delay = 10 * 2 = 20ms)
    await mock.timers.tickAsync(20);
    assert.strictEqual(axiosMock.mock.callCount(), 3, 'Attempt 3 failed');

    const result = await promise;
    assert.deepStrictEqual(result, { success: false, status: 500, finalAttempt: 3 });
  });

  it('should correctly calculate exponential backoff delay', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig({ retry: { attempts: 4, initialDelay: 10, factor: 3 } });
    const axiosMock = mock.fn(axios, {
      mockImplementation: async () => ({ status: 503, data: 'Service Unavailable' }),
    });

    const promise = relayRequest({ request, routeConfig });

    // Attempt 1 -> fails -> schedules retry in 10ms
    await mock.timers.tickAsync(0);
    assert.strictEqual(axiosMock.mock.callCount(), 1);

    // Attempt 2 -> fails -> schedules retry in 10 * 3 = 30ms
    await mock.timers.tickAsync(10);
    assert.strictEqual(axiosMock.mock.callCount(), 2);

    // Attempt 3 -> fails -> schedules retry in 10 * 3^2 = 90ms
    await mock.timers.tickAsync(30);
    assert.strictEqual(axiosMock.mock.callCount(), 3);

    // Attempt 4 (final) -> fails
    await mock.timers.tickAsync(90);
    assert.strictEqual(axiosMock.mock.callCount(), 4);

    const result = await promise;
    assert.deepStrictEqual(result, { success: false, status: 503, finalAttempt: 4 });
  });

  it('should respect the maxDelay configuration', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig({
      retry: { attempts: 3, initialDelay: 10, factor: 10, maxDelay: 50 },
    });
    const axiosMock = mock.fn(axios, {
      mockImplementation: async () => ({ status: 503, data: 'Service Unavailable' }),
    });

    const promise = relayRequest({ request, routeConfig });

    // Attempt 1 -> fails -> schedules retry in 10ms
    await mock.timers.tickAsync(0);
    assert.strictEqual(axiosMock.mock.callCount(), 1);

    // Attempt 2 -> fails. Next delay would be 10 * 10 = 100ms, but is capped by maxDelay.
    // Schedules retry in 50ms.
    await mock.timers.tickAsync(10);
    assert.strictEqual(axiosMock.mock.callCount(), 2);

    // Attempt 3 (final)
    await mock.timers.tickAsync(50);
    assert.strictEqual(axiosMock.mock.callCount(), 3);

    const result = await promise;
    assert.deepStrictEqual(result, { success: false, status: 503, finalAttempt: 3 });
  });

  it('should forward headers correctly (include, static, and content-type)', async () => {
    const request = createMockRequest({
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': 'guid-123',
        'x-should-be-ignored': 'some-value',
        'authorization': 'Bearer incoming-token', // This will be overridden by static config
      },
    });
    const routeConfig = createRouteConfig({
      forwardHeaders: {
        include: ['X-GitHub-Event', 'X-GitHub-Delivery'], // Test case-insensitivity
        static: {
          'X-Source': 'Webhook-Relay',
          'Authorization': 'Bearer static-internal-token',
        },
      },
    });
    const axiosMock = mock.fn(axios, {
      mockImplementation: async () => ({ status: 200, data: 'OK' }),
    });

    await relayRequest({ request, routeConfig });

    assert.strictEqual(axiosMock.mock.callCount(), 1);
    const forwardedRequestConfig = axiosMock.mock.calls[0].arguments[0];

    assert.deepStrictEqual(forwardedRequestConfig.headers, {
      // Static headers have precedence
      'X-Source': 'Webhook-Relay',
      'Authorization': 'Bearer static-internal-token',
      // Included headers
      'X-GitHub-Event': 'push',
      'X-GitHub-Delivery': 'guid-123',
      // Default forwarded header
      'content-type': 'application/json',
    });
  });

  it('should handle a single attempt configuration (attempts: 1)', async () => {
    const request = createMockRequest();
    const routeConfig = createRouteConfig({ retry: { attempts: 1 } });
    const axiosMock = mock.fn(axios, {
      mockImplementation: async () => ({ status: 500, data: 'Internal Server Error' }),
    });

    const result = await relayRequest({ request, routeConfig });

    assert.strictEqual(axiosMock.mock.callCount(), 1, 'axios should be called only once');
    assert.deepStrictEqual(result, { success: false, status: 500, finalAttempt: 1 });
  });
});