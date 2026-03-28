/**
 * @file src/index.js
 * @description Main library entry point for the Static Archive Scraper.
 *
 * This file serves as the public API for the scraper, allowing it to be used
 * programmatically within other Node.js projects. It exports the primary
 * `crawlWebsite` function, which encapsulates the entire crawling and archiving
 * process.
 *
 * By re-exporting the core function, we provide a clean and simple interface
 * for developers who wish to integrate this functionality into their own applications,
 * separating the library's core logic from its command-line interface implementation.
 *
 * @example
 * import { crawlWebsite } from 'static-archive-scraper';
 *
 * async function archiveMyBlog() {
 *   try {
 *     await crawlWebsite({
 *       startUrl: 'https://my-awesome-blog.com',
 *       outputDir: './my-blog-archive',
 *       maxDepth: 5,
 *       userAgent: 'MyCustomArchiver/1.0'
 *     });
 *     console.log('Blog archived successfully!');
 *   } catch (error) {
 *     console.error('Failed to archive blog:', error);
 *   }
 * }
 *
 * archiveMyBlog();
 */

import { crawlWebsite as coreCrawlWebsite } from './core/crawler.js';

/**
 * Initiates the process of crawling and archiving a static website.
 *
 * This function is the primary public interface for the library. It takes a
 * configuration object and orchestrates the entire workflow, from fetching the
 * initial URL to downloading assets, rewriting links, and saving the complete
 * site locally for offline viewing.
 *
 * @public
 * @async
 * @function crawlWebsite
 * @param {object} options - The configuration options for the crawl.
 * @param {string} options.startUrl - The starting URL of the website to archive (e.g., "https://example.com").
 * @param {string} options.outputDir - The path to the local directory where the archive will be saved.
 * @param {number} [options.maxDepth=3] - The maximum depth of links to follow from the start URL. A depth of 0 scrapes only the start page and its direct assets.
 * @param {string} [options.userAgent='StaticArchiveScraper/1.0'] - The User-Agent string to use for all HTTP requests.
 * @returns {Promise<void>} A promise that resolves when the entire archiving process is complete.
 * @throws {Error} Throws an error if the initial URL is invalid or if a critical, unrecoverable error occurs during the process.
 */
export const crawlWebsite = coreCrawlWebsite;