/**
 * @file src/tokenizers/simple-tokenizer.js
 * @description A basic, pure-JavaScript tokenizer that approximates token counts for cost estimation.
 * This tokenizer is designed to be lightweight and dependency-free, providing a reasonable
 * estimate without the overhead of more complex libraries like `tiktoken`.
 *
 * The logic is based on common tokenization patterns observed in models like GPT:
 * - Text is split on whitespace and punctuation.
 * - A common rule of thumb is that one token is approximately 4 characters of English text.
 *   This tokenizer refines that by splitting on word boundaries and punctuation, which is more accurate.
 *
 * This approach is sufficient for cost estimation, where a small margin of error is acceptable.
 */

/**
 * A regular expression to split text into token-like chunks.
 * It splits by:
 * - Spaces, newlines, and tabs (`\s+`)
 * - Punctuation marks like periods, commas, question marks, etc.
 *   (keeps the punctuation as separate tokens).
 * The `( ... )` around the punctuation part is a capturing group, which causes
 * `String.prototype.split()` to include the matched separators in the resulting array.
 *
 * This pattern will handle cases like "hello, world" -> ["hello", ",", " ", "world"].
 * We then filter out empty strings and pure whitespace chunks.
 *
 * @private
 * @type {RegExp}
 */
const TOKENIZATION_REGEX = /(\s+|[.,!?;:"'()[\]{}])/;

/**
 * Estimates the number of tokens in a given string of text.
 *
 * This function provides a fast and lightweight approximation of token count. It is not
 * a precise replacement for model-specific tokenizers (like `tiktoken` for OpenAI models)
 * but is generally accurate enough for cost estimation purposes.
 *
 * The method splits the text by common delimiters (whitespace, punctuation) and
 * counts the resulting non-empty parts.
 *
 * @param {string | null | undefined} text The input text to tokenize. Handles null or undefined inputs gracefully.
 * @returns {number} The estimated number of tokens. Returns 0 if the input is empty, null, or not a string.
 *
 * @example
 * // A simple sentence
 * countTokens("Hello, world! This is a test."); // returns 8
 *
 * @example
 * // Handling code and special characters
 * countTokens("const x = 10; // A comment"); // returns 9
 *
 * @example
 * // Handling empty or invalid input
 * countTokens(null); // returns 0
 * countTokens(""); // returns 0
 */
export function countTokens(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return 0;
  }

  // Split the string by the regex. The regex includes capturing groups
  // for punctuation so that they are kept in the resulting array.
  const parts = text.split(TOKENIZATION_REGEX);

  // Filter out empty strings and strings that are only whitespace.
  // This gives us a list of word-like and punctuation-like segments.
  const tokens = parts.filter(part => part && part.trim().length > 0);

  return tokens.length;
}