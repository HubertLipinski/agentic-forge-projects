/**
 * @file examples/run-scraper.js
 * @description An example script demonstrating how to programmatically use the
 *              E-Commerce Price Tracker library.
 *
 * This script shows how to:
 * 1. Initialize the scraper's core components (HTTP client, configurations).
 * 2. Define a list of target product URLs.
 * 3. Create and manage a job queue (p-queue) to process these URLs.
 * 4. Add scraping jobs to the queue and handle their results.
 * 5. Listen for queue events to know when all scraping is complete.
 * 6. Log the final structured data or any errors encountered.
 *
 * To run this example:
 *   node examples/run-scraper.js
 *
 * Note: This script uses example URLs. For them to work, you must have
 * corresponding site configuration files (e.g., `sites/amazon-product.yaml`,
 * `sites/bestbuy-product.yaml`) correctly set up.
 */

import PQueue from 'p-queue';
import { loadSiteConfigs } from '../src/utils/config-loader.js';
import { initializeHttpClient } from '../src/core/http-client.js';
import { processJob } from '../src/core/job-processor.js';

// --- Configuration ---

// A list of product URLs to scrape.
// Add your own target URLs here to test with your site configurations.
const TARGET_URLS = [
  // A valid Best Buy product URL
  'https://www.bestbuy.com/site/sony-wh1000xm4-wireless-noise-cancelling-over-the-ear-headphones-black/6408356.p?skuId=6408356',
  // A valid Amazon product URL
  'https://www.amazon.com/dp/B0863FR3S9',
  // An example of a URL that will not match any configuration
  'https://www.example.com/product/12345',
  // A malformed URL that might cause a fetch error
  'https://www.bestbuy.com/site/non-existent-product/00000.p?skuId=00000',
];

// Configure the job queue. `concurrency` limits how many requests run in parallel.
const QUEUE_OPTIONS = {
  concurrency: 2, // A lower concurrency is safer to avoid rate-limiting.
};

/**
 * Matches a given URL against the `urlPattern` of all loaded site configurations.
 *
 * @param {string} url The URL to match.
 * @param {object[]} siteConfigs An array of site configuration objects.
 * @returns {object | undefined} The matching site configuration, or undefined if no match is found.
 */
function findMatchingSiteConfig(url, siteConfigs) {
  return siteConfigs.find(config => new RegExp(config.urlPattern).test(url));
}

/**
 * The main function to orchestrate the scraping process.
 */
async function main() {
  console.log('🚀 Starting programmatic scraper example...');

  // --- 1. Initialization ---
  // Initialize shared services (HTTP client, rotators) and load site configs.
  // This should be done once at the start of your application.
  const [siteConfigs] = await Promise.all([
    loadSiteConfigs(),
    initializeHttpClient(),
  ]);

  if (siteConfigs.length === 0) {
    console.error('❌ No site configurations found. Please add valid configs to the `sites/` directory.');
    return;
  }

  console.log(`✅ Initialized with ${siteConfigs.length} site configurations.`);
  console.log(`🎯 Will attempt to scrape ${TARGET_URLS.length} URLs.`);

  // --- 2. Setup Job Queue ---
  const queue = new PQueue(QUEUE_OPTIONS);
  const allResults = [];
  let successCount = 0;
  let failureCount = 0;

  // --- 3. Add Jobs to Queue ---
  for (const url of TARGET_URLS) {
    const siteConfig = findMatchingSiteConfig(url, siteConfigs);

    if (!siteConfig) {
      console.warn(`[SKIP] No matching configuration for: ${url}`);
      const errorResult = {
        url,
        timestamp: new Date().toISOString(),
        data: null,
        error: 'No matching site configuration found.',
      };
      allResults.push(errorResult);
      failureCount++;
      continue;
    }

    // Add a job to the queue. The function will be executed when a worker is available.
    queue.add(async () => {
      try {
        // `processJob` handles fetching, parsing, and returns a structured result.
        const result = await processJob(url, siteConfig);
        allResults.push(result);
        successCount++;
      } catch (error) {
        // `processJob` throws a `JobProcessingError` on failure, which we catch here.
        console.error(`[FAIL] Job failed for ${url}. Reason: ${error.message}`);
        const errorResult = {
          url,
          site: siteConfig.name,
          timestamp: new Date().toISOString(),
          data: null,
          error: error.message,
          cause: error.cause?.message, // Include underlying cause if available
        };
        allResults.push(errorResult);
        failureCount++;
      }
    });
  }

  // --- 4. Handle Completion ---
  // The 'idle' event fires when the queue becomes empty and all promises have settled.
  queue.on('idle', () => {
    console.log('\n--- ✨ All Jobs Processed ✨ ---');
    console.log(`Total: ${TARGET_URLS.length} | Successful: ${successCount} | Failed: ${failureCount}`);
    console.log('\n--- Final Results (JSON) ---');
    // Output the collected results in a clean, readable JSON format.
    console.log(JSON.stringify(allResults, null, 2));
    console.log('🏁 Scraper example finished.');
  });
}

// --- Run the main function and handle top-level errors ---
main().catch(error => {
  console.error('\n[FATAL] An unexpected error occurred during the script execution:');
  console.error(error);
  process.exit(1);
});