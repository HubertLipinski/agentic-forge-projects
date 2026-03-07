/**
 * @fileoverview Example script demonstrating programmatic usage of the rss-feed-aggregator library.
 *
 * This script shows how to import and use the `aggregateFeeds` function to fetch,
 * parse, and aggregate content from multiple RSS feeds. It includes examples of
 * handling both successful results and potential errors.
 *
 * To run this example:
 * 1. Make sure you have installed the project dependencies (`npm install`).
 * 2. From the project root, run `node examples/basic-usage.js`.
 */

// Import the main function from the library's entry point.
// In a real-world application, you would import from the package name:
// import { aggregateFeeds } from 'rss-feed-aggregator';
import { aggregateFeeds } from '../src/index.js';

// A list of sample RSS feed URLs to aggregate.
// This list includes a mix of valid and potentially problematic URLs for demonstration.
const feedUrls = [
  'https://www.theverge.com/rss/index.xml', // A valid, popular tech news feed
  'https://hnrss.org/frontpage',           // Hacker News front page RSS
  'https://www.wired.com/feed/rss',        // Another valid tech news feed
  'https://httpstat.us/404',               // A URL that will return a 404 Not Found error
  'https://example.com/invalid-feed.xml',  // A non-existent feed URL
];

/**
 * An asynchronous self-invoking function to run the example.
 * This pattern is used to allow top-level `await` while keeping the code clean.
 */
(async () => {
  console.log('Starting feed aggregation for the following URLs:');
  console.log(feedUrls.join('\n'));
  console.log('\n--------------------------------------------------\n');

  try {
    // Call the aggregateFeeds function with the list of URLs.
    // We can also pass an options object, for example, to set a custom timeout.
    const { items, errors } = await aggregateFeeds(feedUrls, { timeout: 8000 });

    // --- Handle Errors ---
    // It's important to check for non-critical errors that may have occurred.
    // The aggregator continues processing other feeds even if some fail.
    if (errors.length > 0) {
      console.error('⚠️  Encountered errors while processing some feeds:');
      for (const error of errors) {
        console.error(`  - URL: ${error.url}`);
        console.error(`    Reason: ${error.reason}\n`);
      }
      console.log('--------------------------------------------------\n');
    }

    // --- Process Successful Results ---
    if (items.length > 0) {
      console.log(`✅ Successfully aggregated ${items.length} items.`);
      console.log('Here are the 5 newest items:\n');

      // Display the top 5 newest items from the aggregated list.
      const newestItems = items.slice(0, 5);
      newestItems.forEach((item, index) => {
        console.log(`[${index + 1}] Title: ${item.title}`);
        console.log(`    Author: ${item.creator || 'N/A'}`);
        console.log(`    Source: ${item.feed.title}`);
        console.log(`    Date: ${new Date(item.isoDate).toUTCString()}`);
        console.log(`    Link: ${item.link}`);
        console.log('\n');
      });
    } else {
      console.log('No items were successfully aggregated.');
    }

  } catch (error) {
    // A catch block here will handle critical, unrecoverable errors,
    // such as providing invalid input (e.g., not an array of URLs).
    console.error('A critical error occurred during the aggregation process:');
    console.error(error);
    process.exit(1); // Exit with a failure code for critical errors.
  }
})();