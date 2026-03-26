#!/usr/bin/env node

/**
 * @file src/index.js
 * @description Main entry point for the E-Commerce Price Tracker.
 * This script initializes the application, loads configurations, processes command-line
 * arguments for target URLs, and orchestrates the scraping process using a job queue.
 * It is designed to be run directly from the command line.
 */

import PQueue from 'p-queue';
import { loadSiteConfigs } from './utils/config-loader.js';
import { initializeHttpClient } from './core/http-client.js';
import { processJob } from './core/job-processor.js';

// --- Constants and Configuration ---

const DEFAULT_CONCURRENCY = 5; // Default number of parallel scraping jobs.

/**
 * Custom error class for application-level initialization or runtime failures.
 */
class AppError extends Error {
  /**
   * @param {string} message The error message.
   * @param {object} [details={}] Additional context.
   * @param {Error} [details.cause] The original underlying error.
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.cause = details.cause;
  }
}

// --- Core Functions ---

/**
 * Parses command-line arguments to extract target URLs.
 * Expects URLs to be passed as arguments after the script name.
 * @returns {string[]} An array of URL strings.
 */
function getTargetUrlsFromArgs() {
  // process.argv contains: [node executable, script path, ...args]
  return process.argv.slice(2);
}

/**
 * Matches a given URL against the `urlPattern` of all loaded site configurations.
 * @param {string} url The URL to match.
 * @param {object[]} siteConfigs An array of site configuration objects.
 * @returns {object | undefined} The matching site configuration, or undefined if no match is found.
 */
function findMatchingSiteConfig(url, siteConfigs) {
  return siteConfigs.find(config => new RegExp(config.urlPattern).test(url));
}

/**
 * The main execution function for the scraper.
 * It initializes all components, creates a job queue, and adds tasks for each target URL.
 * @param {string[]} targetUrls An array of URLs to scrape.
 */
async function runScraper(targetUrls) {
  if (targetUrls.length === 0) {
    console.log('Usage: node src/index.js <url1> <url2> ...');
    console.log('No target URLs provided. Exiting.');
    return;
  }

  console.log('--- E-Commerce Price Tracker Initializing ---');

  // Initialize shared services and load configurations in parallel for speed.
  const [siteConfigs] = await Promise.all([
    loadSiteConfigs(),
    initializeHttpClient(),
  ]);

  if (siteConfigs.length === 0) {
    throw new AppError('Initialization failed: No valid site configurations were loaded. Cannot proceed.');
  }

  console.log(`Loaded ${siteConfigs.length} site configurations.`);
  console.log(`Processing ${targetUrls.length} target URL(s) with concurrency ${DEFAULT_CONCURRENCY}.`);
  console.log('---------------------------------------------');


  const queue = new PQueue({ concurrency: DEFAULT_CONCURRENCY });
  const results = [];
  let completedJobs = 0;
  let failedJobs = 0;

  // Add a listener for when the queue is idle (all jobs have finished).
  queue.on('idle', () => {
    console.log('\n--- Scraping Complete ---');
    console.log(`Total Jobs: ${targetUrls.length}`);
    console.log(`  - Successful: ${completedJobs}`);
    console.log(`  - Failed: ${failedJobs}`);
    console.log('-------------------------');

    // Output the final results as a JSON array.
    // This can be piped to a file or another process.
    console.log(JSON.stringify(results, null, 2));
  });

  // Create and add jobs to the queue for each target URL.
  for (const url of targetUrls) {
    const siteConfig = findMatchingSiteConfig(url, siteConfigs);

    if (!siteConfig) {
      console.warn(`[WARN] No matching site configuration found for URL: ${url}. Skipping.`);
      const errorResult = {
        url,
        site: 'N/A',
        timestamp: new Date().toISOString(),
        data: null,
        error: 'No matching site configuration found.',
      };
      results.push(errorResult);
      failedJobs++;
      continue;
    }

    // The function passed to queue.add() is the job to be executed.
    queue.add(async () => {
      try {
        const result = await processJob(url, siteConfig);
        results.push(result);
        completedJobs++;
      } catch (error) {
        // `processJob` throws a `JobProcessingError` which contains useful context.
        const errorResult = {
          url,
          site: siteConfig.name,
          timestamp: new Date().toISOString(),
          data: null,
          error: error.message || 'An unknown error occurred during job processing.',
        };
        results.push(errorResult);
        failedJobs++;
      }
    });
  }
}

// --- Application Entry Point ---

/**
 * Self-invoking async function to start the application and handle top-level errors.
 */
(async () => {
  try {
    const targetUrls = getTargetUrlsFromArgs();
    await runScraper(targetUrls);
  } catch (error) {
    console.error('\n[FATAL] A critical error occurred during application execution:');
    console.error(error.message);
    if (error.cause) {
      console.error('  Cause:', error.cause.message);
    }
    process.exit(1); // Exit with a non-zero code to indicate failure.
  }
})();