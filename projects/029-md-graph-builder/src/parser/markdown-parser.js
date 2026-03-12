import { Marked } from 'marked';

/**
 * @fileoverview
 * This module is responsible for parsing Markdown content to extract all link
 * destinations (hrefs). It uses the 'marked' library to walk the Abstract
 * Syntax Tree (AST) of the document, ensuring that links from various Markdown
 * constructs (e.g., standard links, image links, reference-style links) are
 * all captured.
 */

/**
 * A custom Marked extension that provides a walker to traverse the AST and
 * collect link `href` values. This approach is more robust and efficient than
 * using regular expressions on the raw text, as it correctly handles the
 * structured nature of Markdown.
 *
 * @param {Set<string>} links - A Set to which all found link hrefs will be added.
 *   Using a Set automatically handles deduplication of links within the same file.
 * @returns {object} A Marked extension object.
 */
const createLinkCollectorExtension = (links) => {
  return {
    // The 'walkTokens' method is called for each token in the parsed AST.
    walkTokens(token) {
      // Standard links: [text](href)
      if (token.type === 'link') {
        links.add(token.href);
      }
      // Image links: ![alt](src)
      // We treat image sources as links since they often point to local assets.
      else if (token.type === 'image') {
        links.add(token.href);
      }
      // Reference-style links: [text][ref]
      // The 'link' token for reference-style links also has an 'href',
      // resolved from the link definition. The definition token itself
      // ('def') is also walked, but we only need to capture the href
      // from the usage site ('link' or 'image').
    },
  };
};

/**
 * Parses the content of a Markdown file and extracts all unique link destinations.
 *
 * It initializes a 'marked' instance with a custom extension that traverses the
 * token stream (AST) and collects `href` attributes from `link` and `image` tokens.
 * This function is designed to be pure and does not perform any I/O; it only operates
 * on the provided string content.
 *
 * @param {string} markdownContent - The raw string content of the Markdown file.
 * @returns {Promise<string[]>} A promise that resolves to an array of unique link
 *   destinations (hrefs) found in the content. The order is not guaranteed.
 * @throws {Error} If the `markdownContent` is not a string.
 */
export async function extractLinks(markdownContent) {
  if (typeof markdownContent !== 'string') {
    throw new Error('markdownContent must be a string.');
  }

  // A Set is used to store links, which efficiently handles duplicates.
  const links = new Set();
  const linkCollectorExtension = createLinkCollectorExtension(links);

  const marked = new Marked({
    // We only need parsing, not rendering, so we can disable most features
    // for a slight performance gain. The gfm and breaks options can affect
    // tokenization, so they are kept at their defaults.
    gfm: true,
    breaks: false,
    // Use the custom extension to collect links during tokenization.
    extensions: [linkCollectorExtension],
  });

  try {
    // The 'marked.lexer' method is a synchronous but potentially CPU-intensive
    // operation that parses the Markdown into a stream of tokens (the AST).
    // The 'walkTokens' method of our extension is called during this process.
    // We wrap it in a Promise to maintain an async interface consistent with
    // other file processing modules, allowing for future-asynchronous parsers.
    marked.lexer(markdownContent);

    // Convert the Set of links to an array.
    return Array.from(links);
  } catch (error) {
    // Although marked.lexer is quite robust, we catch potential errors.
    console.error('Error parsing Markdown content:', error);
    // Re-throw a more specific error for the caller to handle.
    throw new Error(`Failed to extract links from Markdown. Reason: ${error.message}`);
  }
}