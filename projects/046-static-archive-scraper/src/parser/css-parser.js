/**
 * @file src/parser/css-parser.js
 * @description Parses CSS content to find and extract asset URLs.
 *
 * This module is responsible for scanning CSS files for `url()` declarations,
 * which are commonly used to link to background images, fonts, and other assets.
 * It uses regular expressions to robustly identify these URLs so they can be
 * added to the download queue.
 */

/**
 * A regular expression to find `url()` declarations in CSS content.
 *
 * Breakdown of the regex:
 * - `url\(`: Matches the literal "url(".
 * - `\s*`: Matches any whitespace characters (spaces, tabs, newlines) zero or more times.
 * - `(`: Starts a capturing group for the URL itself.
 *   - `(?: ... )`: A non-capturing group for the two main possibilities: quoted or unquoted URLs.
 *   - `"(.*?)"`: Matches a double-quoted string. `.*?` is a non-greedy match for any character.
 *   - `|`: OR
 *   - `'(.*?)'`: Matches a single-quoted string.
 *   - `|`: OR
 *   - `([^)]+?)`: Matches an unquoted string. It captures one or more characters that are not a closing parenthesis `)`.
 * - `)`: Ends the main capturing group.
 * - `\s*`: Matches any trailing whitespace before the closing parenthesis.
 * - `\)`: Matches the literal closing parenthesis ")".
 *
 * Modifiers:
 * - `g`: Global search, to find all matches in the string, not just the first one.
 * - `i`: Case-insensitive search, to match `url(...)`, `URL(...)`, etc.
 *
 * This regex correctly handles single quotes, double quotes, and unquoted URLs,
 * as well as surrounding whitespace. It is designed to be resilient against
 * common variations in CSS syntax.
 */
const CSS_URL_REGEX = /url\(\s*(?:"(.*?)"|'(.*?)'|([^)]+?))\s*\)/gi;

/**
 * Parses CSS content to extract all asset URLs found within `url()` functions.
 *
 * It iterates through the content using a regular expression to find all
 * occurrences of `url(...)` and extracts the path inside. It handles URLs
 * that are unquoted, single-quoted, or double-quoted.
 *
 * @param {string} cssContent - The CSS content as a string.
 * @returns {string[]} An array of unique asset URLs found in the CSS. Returns an
 *          empty array if the input is invalid or no URLs are found.
 * @throws {Error} If `cssContent` is not a non-empty string.
 */
export function parseCss(cssContent) {
  if (typeof cssContent !== 'string') {
    throw new Error('Invalid argument: "cssContent" must be a string.');
  }

  if (!cssContent) {
    return [];
  }

  const foundUrls = new Set();
  let match;

  // The `exec` method, when used with a global regex in a loop, will
  // find all successive matches in a string.
  while ((match = CSS_URL_REGEX.exec(cssContent)) !== null) {
    // The `match` array will contain:
    // match[0]: The full matched string, e.g., "url('font.woff')"
    // match[1]: The content of double quotes, if present (e.g., from "...")
    // match[2]: The content of single quotes, if present (e.g., from '...')
    // match[3]: The content if unquoted
    // We take the first non-undefined captured group.
    const url = match[1] || match[2] || match[3];

    // Trim whitespace and ignore empty or invalid URLs (e.g., data URIs).
    const trimmedUrl = url?.trim();
    if (trimmedUrl && !trimmedUrl.startsWith('data:')) {
      foundUrls.add(trimmedUrl);
    }
  }

  // Convert the Set to an Array to return a standard list of unique URLs.
  return Array.from(foundUrls);
}