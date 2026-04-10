/**
 * @file src/github/client.js
 * @description Initializes and exports a pre-configured Octokit client instance.
 *
 * This module is responsible for creating a singleton instance of the Octokit client,
 * which is used for all interactions with the GitHub API. It handles authentication
 * by sourcing the GitHub token from environment variables, making it suitable for
 * both GitHub Actions and CLI execution environments. The client is configured with a
 * custom user agent to identify API requests originating from this tool.
 */

import { Octokit } from 'octokit';
import { name as appName, version as appVersion } from '../../package.json';
import logger from '../utils/logger.js';

/**
 * A singleton instance of the Octokit client.
 * This variable is lazily initialized by `getOctokitClient` to ensure it's
 * created only once per application lifecycle.
 * @type {Octokit | null}
 */
let octokitInstance = null;

/**
 * Creates and configures a new Octokit client instance.
 *
 * This function handles the authentication logic by retrieving the GitHub token
 * from standard environment variables (`GITHUB_TOKEN` or `GH_TOKEN`). It also
 * sets a custom User-Agent string for all API requests, which is a best practice
 * for identifying traffic to the GitHub API.
 *
 * @returns {Octokit} A configured Octokit client instance.
 * @throws {Error} If the GitHub token is not found in the environment variables.
 */
function createOctokitClient() {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

  if (!token) {
    const errorMessage =
      'GitHub token is missing. Please set the GITHUB_TOKEN or GH_TOKEN environment variable.';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  const userAgent = `${appName}/${appVersion}`;
  logger.info(`Initializing Octokit client with User-Agent: ${userAgent}`);

  return new Octokit({
    auth: token,
    userAgent,
    // Node.js 20+ comes with a stable `fetch` implementation.
    // This tells Octokit to use the globally available `fetch`.
    request: {
      fetch: global.fetch,
    },
  });
}

/**
 * Provides a singleton instance of the configured Octokit client.
 *
 * This function ensures that the Octokit client is initialized only once. On the
 * first call, it creates the client using `createOctokitClient`. On subsequent calls,
 * it returns the existing instance. This pattern prevents unnecessary re-instantiation
 * and ensures a consistent client is used throughout the application.
 *
 * @returns {Octokit} The singleton Octokit client instance.
 * @throws {Error} If the client fails to initialize (e.g., missing token).
 */
export function getOctokitClient() {
  if (!octokitInstance) {
    try {
      octokitInstance = createOctokitClient();
    } catch (error) {
      // The error is already logged by createOctokitClient.
      // Re-throwing is important to halt execution if the client cannot be created,
      // as the application cannot function without it.
      throw error;
    }
  }
  return octokitInstance;
}