/**
 * @file src/parser.js
 * @description Core parsing logic for Markdown with YAML front-matter.
 * This module provides a function to parse a string of Markdown content,
 * separating the YAML front-matter from the main body content. It uses
 * `js-yaml` to parse the front-matter into a JavaScript object.
 */

import yaml from 'js-yaml';

// Regular expression to detect and capture YAML front-matter.
// It looks for a block of text enclosed by `---` at the very start of the string.
// - `^`: Asserts position at the start of the string.
// - `---`: Matches the opening delimiter.
// - `\r?\n`: Matches the newline after the opening delimiter.
// - `([\s\S]*?)`: Captures the content between the delimiters. `[\s\S]*?` is a non-greedy
//   match for any character, including newlines.
// - `\r?\n`: Matches the newline before the closing delimiter.
// - `---`: Matches the closing delimiter.
// The 'm' flag is not needed as `^` is sufficient for our "start of string" requirement.
const FRONT_MATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Parses a Markdown string to separate YAML front-matter from the body content.
 *
 * If front-matter is found, it's parsed as YAML. If not, an empty object is
 * returned for the attributes, and the entire string is treated as the body.
 * This ensures a consistent return structure regardless of whether front-matter
 * is present.
 *
 * @param {string} content - The raw string content of the Markdown file.
 * @returns {{attributes: object, body: string}} An object containing the parsed
 *          front-matter `attributes` and the `body` of the markdown content.
 * @throws {Error} Throws a `YAMLException` via `js-yaml` if the front-matter
 *                 is present but contains invalid YAML syntax.
 */
export function parseMarkdown(content) {
  if (typeof content !== 'string') {
    // Return a default state for non-string inputs to prevent downstream errors.
    // This is a defensive measure, though callers should ideally provide strings.
    return { attributes: {}, body: '' };
  }

  const match = FRONT_MATTER_REGEX.exec(content);

  if (!match) {
    // No front-matter found. The entire content is considered the body.
    return { attributes: {}, body: content };
  }

  const yamlContent = match[1]; // The captured YAML string.
  const body = content.substring(match[0].length).trimStart(); // The rest of the content.

  try {
    // js-yaml's load function returns `undefined` for an empty string, which is not
    // ideal. We'll default to an empty object for consistency.
    const attributes = yaml.load(yamlContent) ?? {};
    return { attributes, body };
  } catch (error) {
    // The YAML was malformed. Re-throw the error from js-yaml, which is descriptive.
    // Consumers of this function should be prepared to handle parsing errors.
    // Example: A YAMLException will be thrown.
    const newError = new Error(`Failed to parse YAML front-matter: ${error.message}`);
    newError.cause = error;
    newError.name = 'YAMLParseError';
    throw newError;
  }
}