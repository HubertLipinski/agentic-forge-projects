/**
 * @file src/utils/string-format.js
 * @description Utility functions for string case conversion and key prefixing.
 *
 * This module provides robust and efficient functions for transforming strings,
 * which is essential for converting between INI sections/keys and .env variable names.
 * It handles various common casing styles and provides a flexible prefixing mechanism.
 */

/**
 * A map of supported case transformations.
 * This allows for easy extension with new case styles in the future.
 * @constant {Object<string, function(string): string>}
 */
export const CASE_TRANSFORMATIONS = {
  SNAKE_CASE: str => toSnakeCase(str),
  UPPERCASE: str => str.toUpperCase(),
  LOWERCASE: str => str.toLowerCase(),
  // Add other transformations like 'camelCase', 'kebab-case' if needed.
};

/**
 * Converts a string from various formats (camelCase, kebab-case, PascalCase)
 * to SNAKE_CASE. This is the standard convention for environment variables.
 *
 * The function handles multiple scenarios:
 * - `camelCase` -> `CAMEL_CASE`
 * - `kebab-case` -> `KEBAB_CASE`
 * - `PascalCase` -> `PASCAL_CASE`
 * - `already_snake_case` -> `ALREADY_SNAKE_CASE`
 * - `Spaces in string` -> `SPACES_IN_STRING`
 *
 * It's designed to be idempotent for already-compliant strings and robust
 * against mixed-casing.
 *
 * @param {string} str The input string to convert.
 * @returns {string} The SNAKE_CASED version of the string.
 * @throws {TypeError} If the input is not a string.
 */
export function toSnakeCase(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string for case conversion.');
  }

  // An empty string should remain an empty string.
  if (str.length === 0) {
    return '';
  }

  return (
    str
      // Add an underscore before any uppercase letter that is preceded by a lowercase letter.
      // e.g., "camelCase" -> "camel_Case"
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      // Add an underscore before any uppercase letter that is followed by a lowercase letter.
      // This handles acronyms like "APIKey" -> "API_Key".
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      // Replace spaces, hyphens, and multiple underscores with a single underscore.
      .replace(/[\s-]+/g, '_')
      // Convert the entire string to uppercase.
      .toUpperCase()
  );
}

/**
 * Applies a specified case transformation to a string.
 * It uses the `CASE_TRANSFORMATIONS` map to find the correct function.
 *
 * @param {string} str The string to transform.
 * @param {string} caseType The desired case type (e.g., 'SNAKE_CASE').
 * @returns {string} The transformed string.
 * @throws {Error} If the requested caseType is not supported.
 */
export function applyCase(str, caseType) {
  const transformFn = CASE_TRANSFORMATIONS[caseType];
  if (!transformFn) {
    const supportedCases = Object.keys(CASE_TRANSFORMATIONS).join(', ');
    throw new Error(
      `Unsupported case type: "${caseType}". Supported types are: ${supportedCases}.`
    );
  }
  return transformFn(str);
}

/**
 * Prefixes a key with a given section name, separated by a specified delimiter.
 * This is used to flatten INI sections into .env keys.
 *
 * Example:
 * prefixKey('user', 'database', '_') => 'database_user'
 *
 * If the section is null, undefined, or an empty string, the original key is returned.
 *
 * @param {string} key The key to be prefixed.
 * @param {string | null | undefined} section The section name to use as a prefix.
 * @param {string} [delimiter='_'] The delimiter to place between the section and key.
 * @returns {string} The prefixed key, or the original key if no section is provided.
 * @throws {TypeError} If the key is not a string.
 */
export function prefixKey(key, section, delimiter = '_') {
  if (typeof key !== 'string') {
    throw new TypeError('The "key" argument must be a string.');
  }

  // If section is falsy (null, undefined, ''), return the key as is.
  if (!section) {
    return key;
  }

  return `${section}${delimiter}${key}`;
}