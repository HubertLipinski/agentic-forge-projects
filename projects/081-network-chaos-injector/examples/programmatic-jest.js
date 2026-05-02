/**
 * @file examples/programmatic-jest.js
 * @description Example showing how to use the injector within a Jest test suite to verify retry logic in an SDK client.
 * This example simulates a simple SDK client that fetches user data from an API.
 * We will use the Network Chaos Injector to test the client's resilience to transient
 * network failures (simulated as 503 Service Unavailable errors).
 *
 * To run this example:
 * 1. Make sure you have Jest installed (`npm install --save-dev jest`)
 * 2. Run `npx jest examples/programmatic-jest.js` from the project root.
 */

import { jest } from '@jest/globals';
import { Injector, errorResponse, packetLoss } from '../src/index.js';

// --- A Simple SDK Client to be Tested ---

/**
 * A simple SDK client that fetches user data.
 * It includes a basic retry mechanism for handling transient errors.
 */
class UserApiClient {
  /**
   * @param {object} options
   * @param {string} options.baseUrl - The base URL for the API.
   * @param {number} [options.maxRetries=2] - The maximum number of retries on failure.
   * @param {number} [options.retryDelay=100] - The delay in ms between retries.
   */
  constructor({ baseUrl, maxRetries = 2, retryDelay = 100 }) {
    if (!baseUrl) {
      throw new Error('baseUrl is required');
    }
    this.baseUrl = baseUrl;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Fetches a user by their ID.
   * @param {number} userId - The ID of the user to fetch.
   * @returns {Promise<object>} The user data.
   */
  async getUser(userId) {
    const url = `${this.baseUrl}/users/${userId}`;
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }

        const response = await fetch(url);

        if (response.ok) {
          return await response.json();
        }

        // Only retry on specific server errors
        if (response.status >= 500 && response.status < 600) {
          lastError = new Error(`API returned status ${response.status}`);
          console.log(`Attempt ${attempt + 1} failed. Retrying...`);
          continue; // Go to the next attempt
        }

        // For non-retriable errors (e.g., 4xx), fail immediately
        throw new Error(`API returned non-retriable status ${response.status}`);
      } catch (error) {
        // This catches network errors (like from packetLoss) or fetch rejections
        lastError = error;
        console.log(`Attempt ${attempt + 1} failed with network error. Retrying...`);
      }
    }

    // If all retries fail, throw the last captured error
    throw new Error(`Failed to fetch user after ${this.maxRetries + 1} attempts: ${lastError.message}`);
  }
}

// --- Jest Test Suite ---

const API_HOST = 'api.example.com';
const injector = new Injector();

describe('UserApiClient with Network Chaos', () => {
  let client;

  // Use a mock timer to control `setTimeout` for predictable retry delays
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    // Reset the injector and client before each test
    injector.clearRules();
    client = new UserApiClient({
      baseUrl: `https://api.example.com`,
      maxRetries: 2,
      retryDelay: 100,
    });
  });

  // Ensure the injector is stopped after all tests in this suite
  afterAll(() => {
    if (injector.isActive()) {
      injector.stop();
    }
    jest.useRealTimers(); // Restore real timers
  });

  it('should fetch user data successfully on the first attempt without chaos', async () => {
    // This is the "happy path" test. No chaos is injected.
    // We will mock a successful response using a different chaos rule.
    injector.addRule({
      target: { host: API_HOST, path: '/users/1' },
      scenario: errorResponse({
        statusCode: 200,
        statusMessage: 'OK',
        body: JSON.stringify({ id: 1, name: 'Leanne Graham' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    });
    injector.start();

    const user = await client.getUser(1);
    expect(user).toEqual({ id: 1, name: 'Leanne Graham' });

    injector.stop();
  });

  it('should retry on a 503 error and succeed on the second attempt', async () => {
    // This rule will only apply once, then it will be "consumed".
    // This is a common pattern for testing retry logic.
    // NOTE: Our current injector doesn't have a built-in "run once" feature.
    // We simulate it by stopping and starting the injector with different rules.
    // A more advanced test setup could use a stateful scenario.

    // --- Phase 1: First call fails with 503 ---
    injector.addRule({
      target: { host: API_HOST },
      scenario: errorResponse({ statusCode: 503, body: '{"error": "Service Unavailable"}' }),
    });
    injector.start();

    const getUserPromise = client.getUser(2);

    // Let the first failed attempt complete
    await jest.advanceTimersByTimeAsync(0);

    // --- Phase 2: Second call succeeds with 200 ---
    injector.stop(); // Stop the 503 injector
    injector.clearRules();
    injector.addRule({
      target: { host: API_HOST },
      scenario: errorResponse({
        statusCode: 200,
        body: JSON.stringify({ id: 2, name: 'Ervin Howell' }),
      }),
    });
    injector.start();

    // Advance timers to trigger the retry delay
    await jest.advanceTimersByTimeAsync(100);

    // Await the final resolution of the promise
    const user = await getUserPromise;

    expect(user).toEqual({ id: 2, name: 'Ervin Howell' });

    injector.stop();
  });

  it('should fail after exhausting all retries on persistent 503 errors', async () => {
    // This rule will cause ALL requests to the target host to fail.
    injector.addRule({
      target: { host: API_HOST },
      scenario: errorResponse({ statusCode: 503 }),
    });
    injector.start();

    const getUserPromise = client.getUser(3);

    // We expect 1 initial call + 2 retries = 3 attempts.
    // Each retry has a 100ms delay.
    await jest.advanceTimersByTimeAsync(100); // First retry
    await jest.advanceTimersByTimeAsync(100); // Second retry

    await expect(getUserPromise).rejects.toThrow('Failed to fetch user after 3 attempts: API returned status 503');

    injector.stop();
  });

  it('should retry on a simulated packet loss and succeed on the next attempt', async () => {
    // --- Phase 1: First call fails with a network error ---
    injector.addRule({
      target: { host: API_HOST },
      scenario: packetLoss(), // Causes the request to fail with a network error
    });
    injector.start();

    const getUserPromise = client.getUser(4);

    // Let the first failed attempt complete
    await jest.advanceTimersByTimeAsync(0);

    // --- Phase 2: Second call succeeds ---
    injector.stop();
    injector.clearRules();
    injector.addRule({
      target: { host: API_HOST },
      scenario: errorResponse({ statusCode: 200, body: JSON.stringify({ id: 4, name: 'Patricia Lebsack' }) }),
    });
    injector.start();

    // Advance timers for the retry delay
    await jest.advanceTimersByTimeAsync(100);

    const user = await getUserPromise;
    expect(user).toEqual({ id: 4, name: 'Patricia Lebsack' });

    injector.stop();
  });
});