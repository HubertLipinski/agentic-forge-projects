/**
 * @file src/core/crawler.js
 * @description The main crawling logic for the static archive scraper.
 *
 * This module orchestrates the entire process of scraping a website. It manages a queue
 * of URLs to visit, tracks visited URLs to prevent infinite loops, and coordinates the
 * fetching, parsing, saving, and link-rewriting processes. It is designed to be
 * robust, handling network errors and respecting crawl depth limits.
 */

import { URL } from 'node:url';
import path from 'node:path';
import {
  resolveUrl,
  normalizeUrl,
  isExternalUrl,
  urlToFilePath,
  isAssetUrl,
} from '../utils/url-utils.js';
import { saveFile } from '../utils/file-utils.js';
import { fetchUrl } from '../http/fetcher.js';
import { parseHtml } from '../parser/html-parser.js';
import { parseCss } from '../parser/css-parser.js';
import { rewriteHtmlLinks, rewriteCssLinks } from './link-rewriter.js';

// TODO: Implement robots.txt parsing and honoring in a future version.
// For now, we proceed without it but acknowledge its importance.

/**
 * Manages the state and logic for crawling a static website.
 */
class Crawler {
  /**
   * @param {object} options - The configuration for the crawler.
   * @param {string} options.startUrl - The initial URL to begin crawling.
   * @param {string} options.outputDir - The local directory to save the archive.
   * @param {number} options.maxDepth - The maximum depth to crawl from the start URL.
   * @param {string} options.userAgent - The user-agent string for HTTP requests.
   */
  constructor({ startUrl, outputDir, maxDepth, userAgent }) {
    this.startUrl = new URL(startUrl);
    this.baseDomainUrl = new URL(this.startUrl.origin);
    this.outputDir = outputDir;
    this.maxDepth = maxDepth;
    this.userAgent = userAgent;

    // A queue of items to process. Each item is { url: URL, depth: number }.
    this.queue = [];

    // Tracks all URLs that have been added to the queue to avoid processing duplicates.
    // The key is the normalized URL string.
    this.visitedUrls = new Set();

    // Stores downloaded content before link rewriting.
    // Key: Absolute URL string, Value: { content: string | Buffer, contentType: string }
    this.downloadedContent = new Map();

    // Maps original absolute URLs to their final local file paths.
    // Key: Absolute URL string, Value: Relative local file path (from outputDir).
    this.urlToLocalPathMap = new Map();
  }

  /**
   * Adds a new URL to the crawl queue if it's valid and hasn't been visited.
   * @param {URL} urlObject - The URL object to add.
   * @param {number} depth - The current crawl depth of the URL.
   */
  addToQueue(urlObject, depth) {
    if (depth > this.maxDepth) {
      console.log(`[Crawler] Skipping URL (depth > maxDepth): ${urlObject.href}`);
      return;
    }

    if (isExternalUrl(urlObject, this.baseDomainUrl)) {
      console.log(`[Crawler] Skipping external URL: ${urlObject.href}`);
      return;
    }

    const normalized = normalizeUrl(urlObject);
    if (this.visitedUrls.has(normalized)) {
      return; // Already queued or processed
    }

    this.visitedUrls.add(normalized);
    this.queue.push({ url: urlObject, depth });
    console.log(`[Queue] Added: ${urlObject.href} (depth: ${depth})`);
  }

  /**
   * Starts the crawling process.
   * @returns {Promise<void>} A promise that resolves when the crawl is complete.
   */
  async start() {
    console.log(`[Crawler] Starting crawl at: ${this.startUrl.href}`);
    console.log(`[Crawler] Output directory: ${this.outputDir}`);
    console.log(`[Crawler] Max depth: ${this.maxDepth}`);

    this.addToQueue(this.startUrl, 0);

    while (this.queue.length > 0) {
      const { url, depth } = this.queue.shift();
      await this.processUrl(url, depth);
    }

    console.log('[Crawler] All pages and assets downloaded. Rewriting links...');
    await this.rewriteAllLinks();

    console.log('[Crawler] Crawl finished successfully!');
  }

  /**
   * Processes a single URL from the queue: fetches, parses, and discovers new links.
   * @param {URL} urlObject - The URL to process.
   * @param {number} depth - The current crawl depth.
   */
  async processUrl(urlObject, depth) {
    console.log(`[Processing] Fetching: ${urlObject.href}`);

    const { data, contentType, ok } = await fetchUrl(urlObject, this.userAgent);
    if (!ok || data === null) {
      console.warn(`[Processing] Failed to fetch or received non-OK status for: ${urlObject.href}`);
      return;
    }

    // Determine local file path and store it in the map.
    const localPath = urlToFilePath(urlObject);
    this.urlToLocalPathMap.set(urlObject.href, localPath);

    // Store content for later rewriting.
    this.downloadedContent.set(urlObject.href, { content: data, contentType });

    // If it's an asset (CSS, JS), parse it for more assets.
    // If it's an HTML page, parse it for assets and more pages to crawl.
    if (contentType?.includes('text/css')) {
      const cssAssets = parseCss(data.toString('utf-8'));
      for (const assetUrl of cssAssets) {
        const absoluteAssetUrl = resolveUrl(assetUrl, urlObject.href);
        if (absoluteAssetUrl) {
          this.addToQueue(absoluteAssetUrl, depth); // Assets are at the same depth
        }
      }
    } else if (!isAssetUrl(urlObject) && contentType?.includes('text/html')) {
      const { links, assets } = parseHtml(data.toString('utf-8'));

      // Add discovered page links to the queue with increased depth.
      for (const link of links) {
        const absoluteLinkUrl = resolveUrl(link, urlObject.href);
        if (absoluteLinkUrl) {
          this.addToQueue(absoluteLinkUrl, depth + 1);
        }
      }

      // Add discovered assets to the queue at the same depth.
      for (const asset of assets) {
        const absoluteAssetUrl = resolveUrl(asset, urlObject.href);
        if (absoluteAssetUrl) {
          this.addToQueue(absoluteAssetUrl, depth);
        }
      }
    }
  }

  /**
   * Iterates through all downloaded content, rewrites links, and saves files to disk.
   */
  async rewriteAllLinks() {
    for (const [url, { content, contentType }] of this.downloadedContent.entries()) {
      let finalContent = content;
      const localPath = this.urlToLocalPathMap.get(url);

      if (!localPath) {
        console.warn(`[Rewriter] No local path found for ${url}. Cannot save file.`);
        continue;
      }

      const absoluteFilePath = path.join(this.outputDir, localPath);

      try {
        if (contentType?.includes('text/html')) {
          console.log(`[Rewriter] Rewriting HTML: ${localPath}`);
          finalContent = rewriteHtmlLinks(
            content.toString('utf-8'),
            url,
            this.urlToLocalPathMap,
          );
        } else if (contentType?.includes('text/css')) {
          console.log(`[Rewriter] Rewriting CSS: ${localPath}`);
          finalContent = rewriteCssLinks(
            content.toString('utf-8'),
            url,
            this.urlToLocalPathMap,
          );
        }

        await saveFile(absoluteFilePath, finalContent);
        console.log(`[Save] Saved file: ${absoluteFilePath}`);
      } catch (error) {
        console.error(`[Rewriter] Failed to process or save file for ${url}: ${error.message}`);
      }
    }
  }
}

/**
 * The main entry point for the crawling functionality.
 * It initializes and starts a new Crawler instance with the provided options.
 *
 * @param {object} options - The configuration for the crawler.
 * @param {string} options.startUrl - The initial URL to begin crawling.
 * @param {string} options.outputDir - The local directory to save the archive.
 * @param {number} options.maxDepth - The maximum depth to crawl from the start URL.
 * @param {string} options.userAgent - The user-agent string for HTTP requests.
 * @returns {Promise<void>} A promise that resolves when the crawl is complete.
 */
export async function crawlWebsite(options) {
  const crawler = new Crawler(options);
  await crawler.start();
}