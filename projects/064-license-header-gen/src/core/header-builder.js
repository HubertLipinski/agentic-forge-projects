/**
 * @file src/core/header-builder.js
 * @description Constructs a formatted license header string based on language-specific comment styles.
 *
 * This module is responsible for taking raw license text, dynamic data (like copyright
 * year and author), and a comment style definition, then weaving them together into a
 * polished, correctly formatted header ready to be prepended to a source file.
 */

import { CommentStyleType } from '../utils/comment-styles.js';

/**
 * A template literal tag for replacing placeholders in a string.
 * Placeholders are in the format `{{key}}`.
 *
 * @param {string[]} strings - The static parts of the template literal.
 * @param {...string} keys - The keys to look up in the data object.
 * @returns {function(object): string} A function that takes a data object and returns the interpolated string.
 */
const template = (strings, ...keys) => (data) => {
  const result = [strings[0]];
  keys.forEach((key, i) => {
    const value = data[key] ?? ''; // Use nullish coalescing to handle undefined/null values gracefully
    result.push(value, strings[i + 1]);
  });
  return result.join('');
};

/**
 * Formats the license text by replacing dynamic placeholders.
 * Supported placeholders: `{{year}}`, `{{author}}`.
 *
 * @param {string} licenseText - The raw license text, potentially with placeholders.
 * @param {object} data - The dynamic data to inject.
 * @param {string} [data.year] - The copyright year.
 * @param {string} [data.author] - The copyright author.
 * @returns {string} The license text with placeholders replaced.
 */
function formatLicenseText(licenseText, { year, author }) {
  // A simple, focused template replacer. More robust than basic string.replace().
  const yearPlaceholder = '{{year}}';
  const authorPlaceholder = '{{author}}';

  let processedText = licenseText;

  if (year) {
    // Using a regular expression with the 'g' flag ensures all instances are replaced.
    processedText = processedText.replace(new RegExp(yearPlaceholder, 'g'), year);
  }
  if (author) {
    processedText = processedText.replace(new RegExp(authorPlaceholder, 'g'), author);
  }

  return processedText;
}

/**
 * Builds a license header string formatted according to the specified comment style.
 *
 * This function handles both block-style (e.g., /* ... * /) and line-style (e.g., # ...)
 * comments, ensuring the final output is correctly formatted and ready for insertion.
 *
 * @param {object} options - The options for building the header.
 * @param {string} options.licenseText - The raw text of the license.
 * @param {import('../utils/comment-styles.js').CommentStyle} options.commentStyle - The comment style object for the target file type.
 * @param {object} [options.dynamicData={}] - An object containing dynamic data for placeholders.
 * @param {string} [options.dynamicData.year] - The copyright year.
 * @param {string} [options.dynamicData.author] - The copyright author.
 * @returns {string} The fully formatted license header string.
 * @throws {Error} If the provided comment style is invalid or unsupported.
 */
export function buildHeader(options) {
  const { licenseText, commentStyle, dynamicData = {} } = options;

  if (!licenseText || typeof licenseText !== 'string') {
    throw new Error('Invalid or empty licenseText provided to buildHeader.');
  }

  if (!commentStyle || typeof commentStyle.type !== 'string') {
    throw new Error('Invalid commentStyle object provided to buildHeader.');
  }

  const processedLicenseText = formatLicenseText(licenseText, dynamicData);
  const licenseLines = processedLicenseText.trim().split('\n');

  switch (commentStyle.type) {
    case CommentStyleType.BLOCK: {
      const { start, middle = '', end } = commentStyle;

      // For block comments with a middle prefix (e.g., ' *'), apply it to each line.
      // For those without (e.g., XML/HTML '<!-- -->'), just indent the content.
      const content = licenseLines
        .map(line => `${middle}${line ? ` ${line}` : ''}`.trimEnd())
        .join('\n');

      // Construct the final block, handling the presence of start and end delimiters.
      const headerParts = [];
      if (start) headerParts.push(start);
      headerParts.push(content);
      if (end) headerParts.push(end);

      return headerParts.join('\n');
    }

    case CommentStyleType.LINE: {
      const { start } = commentStyle;
      // For line comments, prefix each line with the comment character.
      return licenseLines
        .map(line => `${start}${line ? ` ${line}` : ''}`.trimEnd())
        .join('\n');
    }

    default:
      // Defensive programming: throw if an unknown comment style type is encountered.
      throw new Error(`Unsupported comment style type: "${commentStyle.type}"`);
  }
}