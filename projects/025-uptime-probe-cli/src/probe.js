import http from 'node:http';
import https from 'node:https';

/**
 * @typedef {import('./utils/config-loader.js').EndpointConfig} EndpointConfig
 */

/**
 * @typedef {object} ProbeResult
 * @property {boolean} isSuccess - True if the response status is 2xx, false otherwise.
 * @property {number} statusCode - The HTTP status code of the response.
 * @property {number} responseTime - The time taken for the request in milliseconds.
 * @property {string} status - A descriptive status ('UP', 'DOWN', or 'ERROR').
 * @property {string|null} error - An error message if the probe failed due to a network or other error.
 */

/**
 * Selects the appropriate Node.js HTTP(S) agent based on the URL protocol.
 *
 * @param {URL} url - The parsed URL object.
 * @returns {http|https} The Node.js http or https module.
 */
function getAgent(url) {
  return url.protocol === 'https:' ? https : http;
}

/**
 * Performs a single HTTP/HTTPS probe to a given endpoint configuration.
 * It measures the response time and determines the status of the endpoint.
 *
 * This function uses Node's native `http`/`https` modules to remain zero-dependency.
 * It handles successful responses, HTTP error codes, and network-level errors (like timeouts).
 *
 * @param {EndpointConfig} endpointConfig - The configuration for the endpoint to probe.
 * @returns {Promise<ProbeResult>} A promise that resolves with the result of the probe.
 */
export async function performProbe(endpointConfig) {
  const { url: urlString, method = 'GET', headers = {}, timeout = 10000 } = endpointConfig;
  const startTime = performance.now();

  try {
    const url = new URL(urlString);
    const agent = getAgent(url);

    const options = {
      method,
      headers: {
        'User-Agent': 'Uptime-Probe-CLI/1.0.0',
        ...headers,
      },
      timeout,
      // Use a signal for more reliable and faster timeout handling
      signal: AbortSignal.timeout(timeout),
    };

    return await new Promise((resolve) => {
      const req = agent.request(url, options, (res) => {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        const statusCode = res.statusCode ?? 0;

        // A successful probe is typically a 2xx status code.
        const isSuccess = statusCode >= 200 && statusCode < 300;

        // Drain the response body to free up resources, even if we don't use it.
        res.on('data', () => {});
        res.on('end', () => {
          resolve({
            isSuccess,
            statusCode,
            responseTime,
            status: isSuccess ? 'UP' : 'DOWN',
            error: null,
          });
        });
      });

      // Handle request-level errors (e.g., DNS lookup failure, TCP connection error, timeout)
      req.on('error', (err) => {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);

        // AbortError is the specific error thrown by AbortSignal.timeout
        const errorMessage = err.name === 'AbortError'
          ? `Request timed out after ${timeout}ms`
          : err.message;

        resolve({
          isSuccess: false,
          statusCode: 0, // No status code available for network errors
          responseTime,
          status: 'ERROR',
          error: errorMessage,
        });
      });

      // Finalize the request. For methods like POST, this is where the body would be written.
      req.end();
    });
  } catch (err) {
    // This catch block handles errors during URL parsing or request setup,
    // which are less common than runtime network errors.
    const endTime = performance.now();
    return {
      isSuccess: false,
      statusCode: 0,
      responseTime: Math.round(endTime - startTime),
      status: 'ERROR',
      error: `Failed to initiate probe: ${err.message}`,
    };
  }
}