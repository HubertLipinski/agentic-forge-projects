/**
 * @file src/utils/url-utils.js
 * @description URL manipulation and normalization utilities for the crawler.
 *
 * This module provides a set of helper functions to handle common URL-related tasks,
 * such as resolving relative URLs, normalizing them for consistent processing,
 * checking if they belong to the target domain, and converting them into safe
 * local file paths.
 */

import { URL } from 'node:url';
import path from 'node:path';

/**
 * Resolves a potentially relative URL against a base URL.
 * Handles absolute, root-relative, and relative paths.
 *
 * @param {string} url - The URL to resolve (can be relative or absolute).
 * @param {string} baseUrl - The base URL of the page where the URL was found.
 * @returns {URL | null} A URL object representing the absolute URL, or null if resolution fails.
 */
export function resolveUrl(url, baseUrl) {
  if (!url || !baseUrl) {
    return null;
  }

  try {
    // The URL constructor correctly handles resolving relative URLs against a base.
    // e.g., new URL('/about', 'https://example.com/path/') -> 'https://example.com/about'
    // e.g., new URL('../style.css', 'https://example.com/blog/post/') -> 'https://example.com/blog/style.css'
    // e.g., new URL('https://other.com', 'https://example.com/') -> 'https://other.com'
    return new URL(url, baseUrl);
  } catch (error) {
    // This can happen with malformed URLs like 'javascript:void(0)' or invalid protocols.
    console.warn(`[URL] Could not resolve URL "${url}" against base "${baseUrl}": ${error.message}`);
    return null;
  }
}

/**
 * Normalizes a URL to a consistent format for tracking and comparison.
 * - Removes the hash fragment (#).
 * - Removes the search parameters (?).
 * - Ensures a trailing slash on directory-like paths.
 *
 * @param {URL} urlObject - The URL object to normalize.
 * @returns {string} The normalized URL string.
 */
export function normalizeUrl(urlObject) {
  if (!(urlObject instanceof URL)) {
    throw new Error('Invalid input: normalizeUrl expects a URL object.');
  }

  const { origin, pathname } = urlObject;

  // A path is considered directory-like if it ends with a slash or has no extension.
  const hasExtension = path.extname(pathname) !== '';
  const endsWithSlash = pathname.endsWith('/');

  let normalizedPathname = pathname;
  if (!hasExtension && !endsWithSlash) {
    normalizedPathname += '/';
  }

  // Reconstruct the URL without search params or hash.
  return `${origin}${normalizedPathname}`;
}

/**
 * Checks if a given URL is external to the base domain.
 *
 * @param {URL} urlObject - The URL to check.
 * @param {URL} baseDomainUrlObject - The URL object representing the base domain of the crawl.
 * @returns {boolean} True if the URL is external, false otherwise.
 */
export function isExternalUrl(urlObject, baseDomainUrlObject) {
  if (!(urlObject instanceof URL) || !(baseDomainUrlObject instanceof URL)) {
    throw new Error('Invalid input: isExternalUrl expects two URL objects.');
  }
  // Compare the 'hostname' property, which is case-insensitive.
  // 'origin' includes the port, which might differ (e.g., http on 80 vs https on 443).
  // Hostname is more reliable for determining if it's the same "site".
  return urlObject.hostname !== baseDomainUrlObject.hostname;
}

/**
 * Converts a web URL into a relative local file path for saving to disk.
 * It preserves the directory structure and handles the root path correctly.
 *
 * Example:
 * 'https://example.com/blog/my-post/' -> 'blog/my-post/index.html'
 * 'https://example.com/style.css' -> 'style.css'
 *
 * @param {URL} urlObject - The URL to convert.
 * @param {string} [defaultFileName='index.html'] - The filename to use for directory-like URLs (e.g., '/about/').
 * @returns {string} A relative file path suitable for the local file system.
 */
export function urlToFilePath(urlObject, defaultFileName = 'index.html') {
  if (!(urlObject instanceof URL)) {
    throw new Error('Invalid input: urlToFilePath expects a URL object.');
  }

  const { pathname } = urlObject;

  // Decode URI components to handle encoded characters in filenames (e.g., %20 -> ' ').
  let decodedPathname = decodeURIComponent(pathname);

  // If the path ends with a slash, it's a directory; append the default filename.
  if (decodedPathname.endsWith('/')) {
    return path.join(decodedPathname, defaultFileName);
  }

  // If there's no file extension, treat it as a directory.
  if (path.extname(decodedPathname) === '') {
    return path.join(decodedPathname, defaultFileName);
  }

  // Otherwise, it's a path to a specific file.
  return decodedPathname;
}

/**
 * Determines if a URL points to a downloadable asset based on its file extension.
 * This helps differentiate between crawlable pages (HTML) and assets to be saved (CSS, JS, images).
 *
 * @param {URL} urlObject - The URL object to check.
 * @returns {boolean} True if the URL points to a recognized asset type.
 */
export function isAssetUrl(urlObject) {
  if (!(urlObject instanceof URL)) {
    return false;
  }

  const assetExtensions = new Set([
    // Stylesheets
    '.css',
    // Scripts
    '.js',
    // Images
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.ico',
    // Fonts
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.otf',
    // Documents
    '.pdf',
  ]);

  const extension = path.extname(urlObject.pathname).toLowerCase();
  return assetExtensions.has(extension);
}