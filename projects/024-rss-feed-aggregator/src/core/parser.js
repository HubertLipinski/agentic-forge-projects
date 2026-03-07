/**
 * @fileoverview Parses raw XML feed content into a structured JavaScript object.
 *
 * This module uses the 'rss-parser' library to handle the complexities of
 * parsing different feed formats (RSS, Atom, etc.). It provides a single,
 * asynchronous function that takes an XML string and returns a standardized
 * feed object, making it easy to work with feed data regardless of the source format.
 *
 * @module src/core/parser
 */

import Parser from 'rss-parser';

// Instantiate the parser once and reuse it. This is more efficient than creating
// a new instance for every parse operation. The parser instance is stateful
// regarding its configuration but stateless regarding parsing operations.
const parser = new Parser({
  // Custom fields can be used to normalize data across different feed types (RSS vs Atom).
  // For example, 'dc:creator' is a common field for author name in RSS feeds.
  // By mapping it to 'creator', we ensure consistent property names in the output.
  customFields: {
    item: ['dc:creator', 'creator'],
  },
});

/**
 * Parses a raw XML string into a structured feed object.
 *
 * This function uses the `rss-parser` library to convert the XML content of an
 * RSS or Atom feed into a standardized JavaScript object. It includes robust
 * error handling to catch and report issues with malformed XML or unexpected
 * content.
 *
 * @async
 * @param {string} xmlContent - The raw XML string content of the feed.
 * @param {string} feedUrl - The original URL of the feed, used for context in error messages.
 * @returns {Promise<object>} A promise that resolves with the parsed feed object.
 *   The object structure is defined by `rss-parser`, typically containing `title`,
 *   `link`, `description`, and an `items` array.
 * @throws {Error} Throws an error if the XML content is invalid, empty, or if
 *   the parser encounters an issue.
 */
export async function parseFeed(xmlContent, feedUrl) {
  // 1. Input validation: Ensure we have non-empty XML content to parse.
  if (!xmlContent || typeof xmlContent !== 'string' || xmlContent.trim() === '') {
    throw new Error(`Cannot parse feed from ${feedUrl}: XML content is empty or invalid.`);
  }

  // 2. Parsing logic: Use the pre-configured parser instance.
  try {
    // The `parseString` method is asynchronous and returns a Promise.
    const feed = await parser.parseString(xmlContent);

    // 3. Post-parsing validation: Ensure the parsed object has the expected structure.
    // A valid feed should at least have an `items` array, even if it's empty.
    if (!feed || !Array.isArray(feed.items)) {
      throw new Error(`Parsed object for ${feedUrl} is malformed or missing an 'items' array.`);
    }

    return feed;
  } catch (error) {
    // 4. Error handling: Catch errors from the parser and re-throw them with more context.
    // This helps in debugging by indicating which specific feed failed to parse.
    // The original error is attached using the `cause` property for better diagnostics.
    throw new Error(`Failed to parse XML for feed ${feedUrl}: ${error.message}`, { cause: error });
  }
}