/**
 * @fileoverview Orchestrates fetching, parsing, and aggregating multiple feeds.
 *
 * This module provides the core logic of the application. It takes a list of
 * feed URLs, processes them concurrently, and returns a single, chronologically
* sorted list of feed items. It handles errors gracefully, ensuring that the
 * failure of one feed does not prevent others from being processed.
 *
 * @module src/core/aggregator
 */

import { fetchFeed } from './fetcher.js';
import { parseFeed } from './parser.js';

/**
 * Normalizes a single feed item into a standardized structure.
 *
 * This function ensures that every item in the final aggregated list has a
 * consistent shape, regardless of variations in the source feed format (RSS vs. Atom).
 * It extracts key properties, provides sensible defaults, and adds metadata about
 * the source feed.
 *
 * @param {object} item - The raw item object from `rss-parser`.
 * @param {object} feed - The parsed feed object containing metadata.
 * @returns {object} A normalized feed item object.
 */
function normalizeItem(item, feed) {
  // Use structuredClone for a deep copy to avoid mutating the original parsed object.
  // This is a good practice for ensuring function purity.
  const normalized = structuredClone(item);

  // Add source feed metadata to each item for context.
  normalized.feed = {
    title: feed.title ?? 'Untitled Feed',
    link: feed.link ?? null,
  };

  // Standardize the publication date. `isoDate` is preferred as it's normalized by rss-parser.
  // Fall back to `pubDate` if `isoDate` is not available.
  const dateValue = item.isoDate ?? item.pubDate;
  normalized.isoDate = dateValue ? new Date(dateValue).toISOString() : null;

  // Ensure 'creator' is consistent, falling back from 'dc:creator' to 'author'.
  normalized.creator = item.creator ?? item['dc:creator'] ?? item.author ?? null;

  return normalized;
}

/**
 * Fetches, parses, and aggregates multiple RSS/Atom feeds.
 *
 * This is the main orchestration function. It takes an array of feed URLs and
 * processes them in parallel to maximize efficiency. For each URL, it fetches
 * the raw XML, parses it into a structured object, and normalizes its items.
 * All items from all successful feeds are then merged into a single array and
 * sorted chronologically with the newest items first.
 *
 * @async
 * @param {string[]} feedUrls - An array of URLs for the feeds to aggregate.
 * @param {object} [options={}] - Configuration options.
 * @param {number} [options.timeout] - The request timeout in milliseconds for each feed fetch.
 * @returns {Promise<object>} A promise that resolves to an object containing the
 *   aggregated `items` and a list of `errors` that occurred during processing.
 *   - `items`: An array of normalized, sorted feed items.
 *   - `errors`: An array of objects, each detailing a failed feed URL and the reason for failure.
 */
export async function aggregateFeeds(feedUrls, options = {}) {
  if (!Array.isArray(feedUrls)) {
    throw new TypeError('feedUrls must be an array of strings.');
  }

  const allItems = [];
  const errors = [];

  // Use Promise.allSettled to process all feeds concurrently.
  // This ensures that we wait for all promises to either resolve or reject,
  // allowing us to collect all results and errors without stopping on the first failure.
  const results = await Promise.allSettled(
    feedUrls.map(async (url) => {
      try {
        // Step 1: Fetch the raw XML content.
        const xmlContent = await fetchFeed(url, options);
        // Step 2: Parse the XML into a structured object.
        const parsedFeed = await parseFeed(xmlContent, url);
        return parsedFeed;
      } catch (error) {
        // If any step fails, re-throw the error to be caught by allSettled.
        // This ensures the promise for this specific URL is rejected.
        throw error;
      }
    })
  );

  // Step 3: Process the results of all settled promises.
  results.forEach((result, index) => {
    const url = feedUrls[index];
    if (result.status === 'fulfilled') {
      const feed = result.value;
      if (feed && Array.isArray(feed.items)) {
        // Normalize and add items from the successfully processed feed.
        const normalizedItems = feed.items.map(item => normalizeItem(item, feed));
        allItems.push(...normalizedItems);
      }
    } else {
      // If a promise was rejected, record the error.
      errors.push({
        url,
        // Provide a clean, user-friendly error message.
        reason: result.reason?.message ?? 'An unknown error occurred.',
      });
    }
  });

  // Step 4: Sort all collected items chronologically (newest first).
  // This sort is stable and handles items without a valid date by placing them at the end.
  allItems.sort((a, b) => {
    const dateA = a.isoDate ? new Date(a.isoDate) : null;
    const dateB = b.isoDate ? new Date(b.isoDate) : null;

    if (!dateA && !dateB) return 0; // Both are invalid, keep original order
    if (!dateA) return 1;          // a is invalid, sort it after b
    if (!dateB) return -1;         // b is invalid, sort it after a

    return dateB - dateA; // Sort descending (newest first)
  });

  // Step 5: Return the final aggregated data and any errors encountered.
  return {
    items: allItems,
    errors,
  };
}