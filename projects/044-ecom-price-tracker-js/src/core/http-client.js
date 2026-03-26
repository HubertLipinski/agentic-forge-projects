import { Agent, request, setGlobalDispatcher } from 'undici';
import { createProxyRotator } from '../utils/proxy-rotator.js';
import { createUserAgentRotator } from '../utils/user-agent-rotator.js';

/**
 * Custom error class for HTTP-related failures.
 * This helps distinguish network/request errors from parsing or logic errors.
 */
class HttpClientError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [details={}] Additional context about the error.
   * @param {number} [details.statusCode] The HTTP status code of the response, if available.
   * @param {string} [details.url] The URL that was being fetched.
   * @param {Error} [details.cause] The original underlying error.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'HttpClientError';
    this.statusCode = details.statusCode;
    this.url = details.url;
    this.cause = details.cause;
  }
}

// --- Configuration ---
const DEFAULT_RETRY_OPTIONS = {
  retries: 3, // Number of retries on failure
  factor: 2, // Exponential backoff factor
  minTimeout: 1000, // Initial delay in ms
  maxTimeout: 15000, // Maximum delay in ms
  randomize: true, // Add jitter to the delay
};

const SHARED_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1', // Do Not Track
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// --- Module-level state ---
let proxyRotator;
let userAgentRotator;
let isInitialized = false;

/**
 * Initializes the HTTP client module by setting up proxy and user-agent rotators.
 * This function must be called once before any requests are made.
 * It is designed to be idempotent.
 *
 * @returns {Promise<void>}
 */
export async function initializeHttpClient() {
  if (isInitialized) {
    return;
  }

  // Initialize rotators in parallel for faster startup.
  [proxyRotator, userAgentRotator] = await Promise.all([
    createProxyRotator(),
    createUserAgentRotator(),
  ]);

  // Set a global dispatcher to enable keep-alive connections by default.
  // This improves performance by reusing TCP connections.
  setGlobalDispatcher(new Agent({
    keepAliveTimeout: 30_000, // 30 seconds
    keepAliveMaxTimeout: 60_000, // 60 seconds
  }));

  isInitialized = true;
  console.log('HTTP Client initialized.');
}

/**
 * A utility function to introduce a delay, used for retry backoff.
 * @param {number} ms The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetches the HTML content of a given URL with retry logic, proxy, and user-agent rotation.
 *
 * @param {string} url The URL to fetch.
 * @param {object} [options={}] Optional configuration for the request.
 * @param {object} [options.retryOptions] Overrides for default retry behavior.
 * @returns {Promise<string>} A promise that resolves with the HTML content of the page.
 * @throws {HttpClientError} If the request fails after all retries or initialization is missing.
 */
export async function fetchHTML(url, options = {}) {
  if (!isInitialized) {
    throw new Error('HttpClient must be initialized before use. Call initializeHttpClient() first.');
  }

  const {
    retries,
    factor,
    minTimeout,
    maxTimeout,
    randomize,
  } = { ...DEFAULT_RETRY_OPTIONS, ...options.retryOptions };

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const proxy = proxyRotator.getProxy();
      const userAgent = userAgentRotator.getUserAgent();

      const requestOptions = {
        method: 'GET',
        headers: {
          ...SHARED_HEADERS,
          'User-Agent': userAgent,
        },
        // undici requires a specific dispatcher for proxy support
        dispatcher: proxy ? new Agent({ connect: { proxy: new URL(proxy) } }) : undefined,
      };

      const response = await request(url, requestOptions);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        // Successfully fetched the content.
        return await response.body.text();
      }

      // Handle non-successful status codes that are not retried (e.g., 4xx client errors).
      if (response.statusCode >= 400 && response.statusCode < 500) {
        // Consume the body to free up resources, even if we don't use it.
        await response.body.dump();
        throw new HttpClientError(`Client error: Received status code ${response.statusCode}`, {
          statusCode: response.statusCode,
          url,
        });
      }

      // For 5xx server errors, we will proceed to the retry logic.
      // Consume the body before throwing.
      await response.body.dump();
      throw new HttpClientError(`Server error: Received status code ${response.statusCode}`, {
        statusCode: response.statusCode,
        url,
      });

    } catch (error) {
      lastError = error instanceof HttpClientError
        ? error
        : new HttpClientError(`Request failed on attempt ${attempt + 1}`, { url, cause: error });

      if (attempt === retries) {
        // All retries failed, break the loop and throw the last error.
        break;
      }

      // Don't retry on non-retriable client errors (e.g., 404 Not Found).
      if (lastError.statusCode && lastError.statusCode >= 400 && lastError.statusCode < 500) {
        break;
      }

      // Calculate backoff delay
      let backoff = minTimeout * Math.pow(factor, attempt);
      if (randomize) {
        const jitter = backoff * 0.2 * Math.random(); // Add up to 20% jitter
        backoff += jitter;
      }
      const delayMs = Math.min(backoff, maxTimeout);

      console.warn(`Attempt ${attempt + 1}/${retries + 1} failed for ${url}. Retrying in ${Math.round(delayMs)}ms... (Reason: ${lastError.message})`);
      await delay(delayMs);
    }
  }

  // If the loop completes without a successful return, throw the last captured error.
  throw new HttpClientError(`Failed to fetch URL after ${retries} retries: ${url}`, {
    url,
    cause: lastError,
  });
}