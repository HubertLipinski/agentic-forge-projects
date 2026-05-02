/**
 * @file examples/cli-usage/chaos.config.js
 * @description Sample configuration file for the `chaos-run` CLI tool.
 * This file demonstrates how to define a set of chaos rules to be applied
 * to a target application.
 *
 * The configuration must be a default export of an object with a `rules` property.
 * The `rules` property must be an array of rule objects.
 *
 * Each rule object consists of:
 * - `target`: Specifies which requests to intercept.
 * - `scenario`: Defines the chaos to inject.
 * - `probability` (optional): A number between 0 and 1 for the chance of applying the chaos.
 */

// Import scenario helpers for better readability and to avoid magic strings.
// Note: In a real config, you might not have these helpers available globally.
// This example assumes a structure similar to the programmatic API for clarity.
// The CLI itself only cares about the final JSON-like object structure.
import {
  latency,
  errorResponse,
  packetLoss
} from '../../src/index.js';

/**
 * A helper function to create a scenario object.
 * This is just for demonstration; you can define the objects directly.
 * The CLI only needs the final object structure, not how it's created.
 */
const createScenario = (type, options) => ({ type, options });

export default {
  rules: [
    // Rule 1: High Latency for a specific API endpoint
    // Target: Any POST request to 'api.example.com' on the path '/v1/data'.
    // Effect: Adds a random delay between 500ms and 1500ms.
    // Probability: 75% of matching requests will be delayed.
    {
      target: {
        host: 'api.example.com',
        method: 'POST',
        path: '/v1/data',
      },
      scenario: createScenario('latency', { minDelay: 500, maxDelay: 1500 }),
      probability: 0.75,
    },

    // Rule 2: Simulate Service Unavailability for another API
    // Target: Any request to 'api.anotherservice.io'.
    // Effect: Intercepts the request and immediately returns a 503 Service Unavailable error.
    // Probability: 100% (default).
    {
      target: {
        host: 'api.anotherservice.io',
      },
      scenario: createScenario('error-response', {
        statusCode: 503,
        statusMessage: 'Service Unavailable',
        body: JSON.stringify({ message: 'This service is temporarily down due to chaos testing.' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    },

    // Rule 3: Simulate intermittent network failures for a third-party service
    // Target: Any GET request to 'third-party-api.com'.
    // Effect: Simulates a sudden connection drop, causing a socket error.
    // Probability: 30% of matching requests will fail.
    {
      target: {
        host: 'third-party-api.com',
        method: 'GET',
      },
      scenario: createScenario('packet-loss', { delay: 50 }), // Destroy after 50ms
      probability: 0.30,
    },

    // Rule 4: Target using a Regular Expression
    // Target: Any request to a path that looks like a user profile (e.g., /users/123, /users/456/profile).
    // Effect: Returns a 429 Too Many Requests error.
    {
      target: {
        path: /^\/users\/\d+(\/.*)?$/,
      },
      scenario: createScenario('error-response', {
        statusCode: 429,
        headers: { 'Retry-After': '60' },
      }),
    },

    // Rule 5: A general, low-impact latency rule for all other outgoing calls
    // Target: Any request not matched by the more specific rules above.
    // Effect: Adds a small, fixed delay of 100ms.
    // Note: The rule engine processes rules in order, so this acts as a fallback.
    {
      target: {
        // No specific host, method, or path means it matches everything.
      },
      scenario: createScenario('latency', { delay: 100 }),
      probability: 0.1, // Only apply this mild chaos 10% of the time.
    },
  ],
};