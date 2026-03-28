/**
 * @file src/core/link-rewriter.js
 * @description Rewrites asset URLs in downloaded files to point to local copies.
 *
 * This module is a critical component for enabling offline viewing of the archived
 * site. It processes downloaded HTML and CSS content, finds all URL references
 * (like `href`, `src`, `srcset`, and `url()` in CSS), and replaces them with
 * relative paths pointing to the locally saved assets.
 */

import path from 'node:path';
import cheerio from 'cheerio';
import { resolveUrl } from '../utils/url-utils.js';

/**
 * A regular expression to find `url()` declarations in CSS content for rewriting.
 * This is similar to the parsing regex but designed for replacement.
 *
 * Breakdown:
 * - `(url\(\s*)`: Capturing group 1: Matches "url(" and any leading whitespace.
 * - `(?:"(.*?)"|'(.*?)'|([^)]+?))`: Non-capturing group for the URL itself, handling double-quoted,
 *   single-quoted, or unquoted URLs. The inner content is captured in groups 2, 3, or 4.
 * - `(\s*\))`: Capturing group 5: Matches any trailing whitespace and the closing parenthesis.
 *
 * This structure allows us to replace only the URL part while preserving the `url()` syntax and quotes.
 */
const CSS_URL_REWRITER_REGEX = /(url\(\s*)(?:"(.*?)"|'(.*?)'|([^)]+?))(\s*\))/gi;

/**
 * Rewrites URLs within a downloaded HTML file to point to their local counterparts.
 *
 * It uses Cheerio to parse the HTML, finds all elements with link attributes
 * (`href`, `src`, `srcset`, etc.), and replaces each remote URL with its
 * corresponding relative local path.
 *
 * @param {string} htmlContent - The raw HTML content of the page.
 * @param {string} pageUrl - The original URL of the HTML page. This is used as the base for resolving relative links.
 * @param {Map<string, string>} urlToLocalPathMap - A map where keys are original absolute asset URLs
 *   and values are their new local file paths.
 * @returns {string} The HTML content with all links rewritten.
 */
export function rewriteHtmlLinks(htmlContent, pageUrl, urlToLocalPathMap) {
  if (typeof htmlContent !== 'string') {
    throw new Error('Invalid argument: "htmlContent" must be a string.');
  }
  if (!pageUrl) {
    throw new Error('Invalid argument: "pageUrl" is required.');
  }
  if (!(urlToLocalPathMap instanceof Map)) {
    throw new Error('Invalid argument: "urlToLocalPathMap" must be a Map.');
  }

  const $ = cheerio.load(htmlContent);
  const pageFilePath = urlToLocalPathMap.get(pageUrl);

  if (!pageFilePath) {
    console.warn(`[LinkRewriter] Could not find local path for page URL: ${pageUrl}. Skipping rewrite for this page.`);
    return htmlContent;
  }

  const pageDirectory = path.dirname(pageFilePath);

  const rewriteAttribute = (element, attribute) => {
    const originalValue = $(element).attr(attribute);
    if (!originalValue) return;

    // Special handling for 'srcset' which contains multiple URLs
    if (attribute === 'srcset') {
      const newSrcset = originalValue
        .split(',')
        .map(part => {
          const [url, ...descriptor] = part.trim().split(/\s+/);
          const absoluteUrl = resolveUrl(url, pageUrl);
          if (!absoluteUrl) return part; // Keep original if unresolvable

          const localAssetPath = urlToLocalPathMap.get(absoluteUrl.href);
          if (!localAssetPath) return part; // Keep original if not in map

          const relativePath = path.relative(pageDirectory, localAssetPath);
          return [relativePath, ...descriptor].join(' ');
        })
        .join(', ');

      $(element).attr(attribute, newSrcset);
    } else {
      // Standard handling for single-URL attributes
      const absoluteUrl = resolveUrl(originalValue, pageUrl);
      if (!absoluteUrl) return; // Ignore unresolvable URLs like 'javascript:void(0)'

      const localAssetPath = urlToLocalPathMap.get(absoluteUrl.href);
      if (localAssetPath) {
        const relativePath = path.relative(pageDirectory, localAssetPath);
        $(element).attr(attribute, relativePath);
      }
    }
  };

  // Select all elements with attributes that might contain URLs
  $('a[href]').each((i, el) => rewriteAttribute(el, 'href'));
  $('link[href]').each((i, el) => rewriteAttribute(el, 'href'));
  $('script[src]').each((i, el) => rewriteAttribute(el, 'src'));
  $('img[src]').each((i, el) => rewriteAttribute(el, 'src'));
  $('img[srcset]').each((i, el) => rewriteAttribute(el, 'srcset'));
  $('source[src]').each((i, el) => rewriteAttribute(el, 'src'));
  $('source[srcset]').each((i, el) => rewriteAttribute(el, 'srcset'));
  $('video[src]').each((i, el) => rewriteAttribute(el, 'src'));
  $('video[poster]').each((i, el) => rewriteAttribute(el, 'poster'));
  $('audio[src]').each((i, el) => rewriteAttribute(el, 'src'));
  $('object[data]').each((i, el) => rewriteAttribute(el, 'data'));
  $('embed[src]').each((i, el) => rewriteAttribute(el, 'src'));

  return $.html();
}

/**
 * Rewrites `url()` declarations within a downloaded CSS file to point to local assets.
 *
 * It uses a regular expression to find all `url()` occurrences and replaces
 * the remote URL with a relative path calculated from the location of the CSS file.
 *
 * @param {string} cssContent - The raw CSS content.
 * @param {string} cssUrl - The original URL of the CSS file.
 * @param {Map<string, string>} urlToLocalPathMap - A map of original absolute URLs to their local file paths.
 * @returns {string} The CSS content with all `url()` paths rewritten.
 */
export function rewriteCssLinks(cssContent, cssUrl, urlToLocalPathMap) {
  if (typeof cssContent !== 'string') {
    throw new Error('Invalid argument: "cssContent" must be a string.');
  }
  if (!cssUrl) {
    throw new Error('Invalid argument: "cssUrl" is required.');
  }
  if (!(urlToLocalPathMap instanceof Map)) {
    throw new Error('Invalid argument: "urlToLocalPathMap" must be a Map.');
  }

  const cssFilePath = urlToLocalPathMap.get(cssUrl);
  if (!cssFilePath) {
    console.warn(`[LinkRewriter] Could not find local path for CSS URL: ${cssUrl}. Skipping rewrite for this file.`);
    return cssContent;
  }

  const cssDirectory = path.dirname(cssFilePath);

  return cssContent.replace(CSS_URL_REWRITER_REGEX, (match, prefix, dquoted, squoted, unquoted, suffix) => {
    const originalUrl = dquoted ?? squoted ?? unquoted;
    if (!originalUrl || originalUrl.trim().startsWith('data:')) {
      return match; // Ignore data URIs or empty urls
    }

    const absoluteUrl = resolveUrl(originalUrl, cssUrl);
    if (!absoluteUrl) {
      return match; // Keep original if URL is malformed
    }

    const localAssetPath = urlToLocalPathMap.get(absoluteUrl.href);
    if (!localAssetPath) {
      return match; // Keep original if asset was not downloaded/mapped
    }

    const relativePath = path.relative(cssDirectory, localAssetPath);

    // Reconstruct the url() declaration with the new relative path,
    // preserving the original quoting style.
    const quote = dquoted ? '"' : (squoted ? "'" : '');
    return `${prefix}${quote}${relativePath}${quote}${suffix}`;
  });
}