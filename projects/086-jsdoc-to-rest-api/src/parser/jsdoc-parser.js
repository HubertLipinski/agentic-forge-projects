/**
 * @file src/parser/jsdoc-parser.js
 * @description Parses raw JSDoc comment strings into a structured format.
 *
 * This module acts as a specialized wrapper around the 'comment-parser' library.
 * It takes a raw comment block as input and transforms it into a more refined
 * and predictable JavaScript object. It includes custom logic to handle specific
 * tags and their formats, such as parsing the HTTP method and path from a
 * `@route` tag, or extracting status codes from `@returns` and `@throws` tags.
 * This structured output is essential for the subsequent analysis and generation stages.
 */

import { parse as commentParser } from 'comment-parser';

/**
 * Parses a raw JSDoc comment string into a structured object.
 *
 * This function uses `comment-parser` to perform the initial parsing and then
 * refines the output for easier consumption by the rest of the application.
 * It specifically processes tags like `@route`, `@param`, `@returns`, and `@throws`
 * to extract key information.
 *
 * @param {string} rawComment - The raw JSDoc comment string (e.g., `/** ... */`).
 * @returns {object | null} A structured representation of the JSDoc, or null if parsing fails or the comment is empty.
 *          The object includes:
 *          - `description` (string): The main description from the comment.
 *          - `tags` (Array<object>): An array of all parsed tags.
 *          - `route` (object | null): Parsed `@route` tag info {method, path}.
 *          - `params` (Array<object>): An array of parsed `@param` tags.
 *          - `returns` (Array<object>): An array of parsed `@returns` tags with status codes.
 *          - `throws` (Array<object>): An array of parsed `@throws` tags with status codes.
 * @throws {Error} If the input `rawComment` is not a string.
 */
export function parseJSDoc(rawComment) {
  if (typeof rawComment !== 'string') {
    throw new Error('Invalid input: rawComment must be a string.');
  }

  // comment-parser expects the comment without the `/**` and `*/` markers.
  // It returns an array, but we are only ever parsing a single block.
  const parsed = commentParser(rawComment);
  const commentBlock = parsed?.[0];

  if (!commentBlock) {
    return null;
  }

  const structuredDoc = {
    description: commentBlock.description.trim(),
    tags: commentBlock.tags,
    route: null,
    params: [],
    returns: [],
    throws: [],
  };

  for (const tag of commentBlock.tags) {
    switch (tag.tag) {
      case 'route':
        // @route {METHOD} /path/to/endpoint
        structuredDoc.route = parseRouteTag(tag);
        break;
      case 'param':
        // @param {{type: 'string'}} name - Description.
        structuredDoc.params.push(parseParamTag(tag));
        break;
      case 'returns':
      case 'return':
        // @returns {200} {object} Description.
        // @returns {object} Description. (Defaults to 200)
        structuredDoc.returns.push(parseResponseTag(tag, 200));
        break;
      case 'throws':
        // @throws {404} {Error} User not found.
        // @throws {Error} User not found. (Defaults to 500)
        structuredDoc.throws.push(parseResponseTag(tag, 500));
        break;
      // Other tags are preserved in the `tags` array but not specially processed here.
    }
  }

  return structuredDoc;
}

/**
 * Parses a `@route` tag into its components (method and path).
 * Example: `@route {GET} /users/:id`
 *
 * @param {import('comment-parser').Tag} tag - The parsed tag object from comment-parser.
 * @returns {{method: string, path: string} | null} An object with method and path, or null if parsing fails.
 */
function parseRouteTag(tag) {
  if (!tag.type || !tag.name) {
    console.warn(
      `Invalid @route tag format. Expected '@route {METHOD} /path', but got: "@${tag.tag} ${tag.source[0].source.trim()}"`,
    );
    return null;
  }
  return {
    method: tag.type.toUpperCase(),
    path: tag.name,
  };
}

/**
 * Parses a `@param` tag. It handles JSDoc object literal types in the {type} part.
 * Example: `@param {{type: 'string', format: 'email'}} user.email - The user's email.`
 *
 * @param {import('comment-parser').Tag} tag - The parsed tag object from comment-parser.
 * @returns {object} A structured parameter object.
 */
function parseParamTag(tag) {
  return {
    name: tag.name,
    type: tag.type,
    description: tag.description,
    optional: tag.optional,
    // The raw source line can be useful for more complex parsing later, e.g., for schema generation.
    source: tag.source[0]?.source,
  };
}

/**
 * Parses a `@returns` or `@throws` tag, extracting the HTTP status code.
 * The status code can be specified in the type, e.g., `{200}` or `{404}`.
 * If not specified, a default is used.
 *
 * Examples:
 * - `@returns {200} {object} A user object.` -> status: 200, type: 'object'
 * - `@returns {object} A user object.` -> status: 200 (default), type: 'object'
 * - `@throws {404} User not found.` -> status: 404, type: '', description: 'User not found'
 *
 * @param {import('comment-parser').Tag} tag - The parsed tag object from comment-parser.
 * @param {number} defaultStatusCode - The status code to use if none is found.
 * @returns {{status: number, type: string, description: string}} A structured response object.
 */
function parseResponseTag(tag, defaultStatusCode) {
  let status = defaultStatusCode;
  let type = tag.type;
  let description = [tag.name, tag.description].filter(Boolean).join(' ');

  // Check if the type field is just a status code like `{404}`
  const statusMatch = tag.type.match(/^(\d{3})$/);
  if (statusMatch) {
    status = parseInt(statusMatch[1], 10);
    // The actual type is now in the `name` field, and description follows.
    type = tag.name;
    description = tag.description;
  }

  return {
    status,
    type: type.trim(),
    description: description.trim(),
  };
}