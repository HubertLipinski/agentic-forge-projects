import { fetchHTML } from './http-client.js';
import { parseProductData } from './parser.js';

/**
 * Custom error class for job processing failures.
 * This encapsulates errors that occur during the execution of a single scrape job,
 * allowing for more specific error handling upstream.
 */
class JobProcessingError extends Error {
  /**
   * @param {string} message The primary error message.
   * @param {object} [details={}] Additional context about the failure.
   * @param {string} [details.url] The URL of the job that failed.
   * @param {string} [details.stage] The stage at which the error occurred ('fetch', 'parse').
   * @param {Error} [details.cause] The original underlying error.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'JobProcessingError';
    this.url = details.url;
    this.stage = details.stage;
    this.cause = details.cause;
  }
}

/**
 * Processes a single scraping job for a given URL and its corresponding site configuration.
 * This function orchestrates the fetching of the page's HTML, parsing the content
 * to extract product data, and returning a structured result.
 *
 * It is designed to be the core task executed by the job queue (p-queue).
 *
 * @param {string} url The target URL to scrape.
 * @param {object} siteConfig The validated configuration object for the site matching the URL.
 * @returns {Promise<object>} A promise that resolves to a result object containing:
 *   - `url`: The original URL processed.
 *   - `site`: The `name` from the site configuration.
 *   - `timestamp`: An ISO 8601 string of when the data was processed.
 *   - `data`: The extracted product data (`name`, `price`, `isInStock`).
 *   - `error`: Null if successful, or an error message string if failed.
 * @throws {JobProcessingError} If a critical, unrecoverable error occurs.
 */
export async function processJob(url, siteConfig) {
  console.log(`[INFO] Starting job for: ${url}`);
  let html;

  try {
    // Stage 1: Fetch the HTML content from the URL.
    // This step includes built-in retries, proxy/user-agent rotation.
    html = await fetchHTML(url);
  } catch (error) {
    const errorMessage = `Failed to fetch content for ${url}.`;
    console.error(`[ERROR] ${errorMessage} Reason: ${error.message}`);
    // We create a specific error to pass upstream, capturing the stage and cause.
    throw new JobProcessingError(errorMessage, {
      url,
      stage: 'fetch',
      cause: error,
    });
  }

  try {
    // Stage 2: Parse the fetched HTML to extract structured data.
    const productData = await parseProductData(html, siteConfig);

    const result = {
      url,
      site: siteConfig.name,
      timestamp: new Date().toISOString(),
      data: productData,
      error: null,
    };

    // Log success with key details for monitoring.
    const { name, price, isInStock } = productData;
    console.log(`[SUCCESS] Job for ${url} completed. Name: "${name}", Price: ${price}, In Stock: ${isInStock ?? 'N/A'}`);

    return result;
  } catch (error) {
    const errorMessage = `Failed to parse data for ${url}.`;
    console.error(`[ERROR] ${errorMessage} Reason: ${error.message}`);
    // Create a specific error for parsing failures.
    throw new JobProcessingError(errorMessage, {
      url,
      stage: 'parse',
      cause: error,
    });
  }
}