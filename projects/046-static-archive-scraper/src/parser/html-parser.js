/**
 * @file src/parser/html-parser.js
 * @description Parses HTML content to extract links and asset URLs.
 *
 * This module uses the 'cheerio' library, which provides a fast and jQuery-like
 * API for traversing and manipulating an HTML document's DOM. Its primary role
 * is to identify all resources referenced within an HTML file so they can be
 * queued for download by the crawler.
 */

import cheerio from 'cheerio';

/**
 * Parses HTML content to extract all relevant URLs.
 *
 * This function loads the provided HTML string into a cheerio instance and
 * then systematically queries the DOM to find:
 * 1. Navigational links (`<a>` tags) to be added to the crawl queue.
 * 2. Asset links (`<link>`, `<script>`, `<img>`, etc.) to be downloaded.
 *
 * It returns a structured object containing separate arrays for each type of URL found.
 *
 * @param {string} htmlContent - The HTML content of the page as a string.
 * @returns {{links: string[], assets: string[]}} An object containing an array of page links
 *          and an array of asset URLs. Returns empty arrays if parsing fails or no URLs are found.
 * @throws {Error} If the `htmlContent` is not a non-empty string.
 */
export function parseHtml(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    throw new Error(
      'Invalid argument: "htmlContent" must be a non-empty string.',
    );
  }

  try {
    const $ = cheerio.load(htmlContent);
    const links = new Set();
    const assets = new Set();

    // 1. Extract crawlable page links from <a> tags
    $('a[href]').each((i, element) => {
      const href = $(element).attr('href')?.trim();
      if (href) {
        links.add(href);
      }
    });

    // 2. Extract asset URLs
    // Note: Using a map to define selectors and attributes makes this easily extensible.
    const assetSelectors = {
      'link[rel="stylesheet"][href]': 'href',
      'link[rel="icon"][href]': 'href',
      'link[rel="shortcut icon"][href]': 'href',
      'link[rel="apple-touch-icon"][href]': 'href',
      'script[src]': 'src',
      'img[src]': 'src',
      'img[srcset]': 'srcset', // Handle responsive images
      'source[src]': 'src',
      'source[srcset]': 'srcset',
      'video[src]': 'src',
      'video[poster]': 'poster',
      'audio[src]': 'src',
      'object[data]': 'data',
      'embed[src]': 'src',
    };

    for (const [selector, attribute] of Object.entries(assetSelectors)) {
      $(selector).each((i, element) => {
        const attrValue = $(element).attr(attribute)?.trim();
        if (!attrValue) return;

        // The 'srcset' attribute can contain multiple URLs with descriptors.
        // We need to parse them and extract just the URL part.
        // Example: "image-320w.jpg 320w, image-640w.jpg 640w, image-1280w.jpg 1280w"
        if (attribute === 'srcset') {
          const urls = attrValue
            .split(',')
            .map((part) => part.trim().split(/\s+/)[0]) // Get the URL part before the descriptor
            .filter(Boolean); // Filter out any empty strings
          urls.forEach((url) => assets.add(url));
        } else {
          assets.add(attrValue);
        }
      });
    }

    // Convert Sets to Arrays for the final return value.
    // Using Sets initially is an efficient way to handle duplicate URLs.
    return {
      links: Array.from(links),
      assets: Array.from(assets),
    };
  } catch (error) {
    console.error(`[HTML Parser] Failed to parse HTML content: ${error.message}`);
    // Return a default "empty" state to allow the crawler to proceed
    // without crashing on a single malformed HTML file.
    return {
      links: [],
      assets: [],
    };
  }
}