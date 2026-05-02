/**
 * @file examples/cli-usage/app.js
 * @description A simple Node.js application that makes HTTP requests.
 * This app is designed to be a target for the `chaos-run` CLI tool,
 * demonstrating how network chaos affects its behavior.
 */

import { setInterval } from 'node:timers/promises';

// A list of public APIs to query.
// These will be targeted by the rules in `chaos.config.js`.
const API_ENDPOINTS = [
  { name: 'Public APIs', url: 'https://api.publicapis.org/random' },
  { name: 'Cat Facts', url: 'https://catfact.ninja/fact' },
  { name: 'Bored API', url: 'https://www.boredapi.com/api/activity' },
  { name: 'JSON Placeholder (posts)', url: 'https://jsonplaceholder.typicode.com/posts/1' },
  { name: 'JSON Placeholder (users)', url: 'https://jsonplaceholder.typicode.com/users/1' },
];

/**
 * A simple color logger to make the output more readable.
 */
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  success: (message) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`),
  warn: (message) => console.log(`\x1b[33m[WARN]\x1b[0m ${message}`),
  error: (message) => console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`),
};

/**
 * Fetches data from a given URL and logs the outcome.
 * It measures the request duration to make latency visible.
 *
 * @param {string} name - The human-readable name of the API endpoint.
 * @param {string} url - The URL to fetch.
 */
async function fetchData(name, url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout
  const startTime = Date.now();

  try {
    logger.info(`Requesting data from "${name}" at ${url}...`);

    const response = await fetch(url, { signal: controller.signal });
    const duration = Date.now() - startTime;

    if (response.ok) {
      // We don't need the body, just confirmation of success.
      logger.success(
        `Received successful response from "${name}" (Status: ${response.status}) in ${duration}ms.`
      );
    } else {
      logger.warn(
        `Received error response from "${name}" (Status: ${response.status}) in ${duration}ms.`
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error.name === 'AbortError') {
      logger.error(
        `Request to "${name}" timed out after ${duration}ms.`
      );
    } else {
      // This is where we expect to see errors from 'packet-loss' scenarios.
      logger.error(
        `Request to "${name}" failed after ${duration}ms. Reason: ${error.message}`
      );
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * The main function of the application.
 * It continuously makes requests to a set of APIs at a regular interval.
 */
export async function main() {
  console.log('--------------------------------------------------');
  console.log('🚀 Starting Example Application...');
  console.log('This app will make requests to various APIs every 3 seconds.');
  console.log('Run this with `chaos-run` to see network chaos in action.');
  console.log('To stop, press CTRL+C.');
  console.log('--------------------------------------------------');

  // Use an async iterator for the interval timer.
  // This is a modern and clean way to handle repeated async tasks.
  for await (const _ of setInterval(3000)) {
    console.log(`\n--- [${new Date().toISOString()}] Starting new request cycle ---`);

    // Create an array of promises for all the fetch operations.
    const requests = API_ENDPOINTS.map(endpoint =>
      fetchData(endpoint.name, endpoint.url)
    );

    // Wait for all requests in the current cycle to complete (or fail).
    await Promise.allSettled(requests);
  }
}

// The following block ensures that `main()` is called only when the script
// is executed directly, not when it's imported as a module.
try {
  await main();
} catch (error) {
  // This will catch any unhandled promise rejections from the main loop.
  logger.error('A critical error occurred in the main application loop:');
  console.error(error);
  process.exit(1);
}