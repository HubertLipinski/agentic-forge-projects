import crypto from 'node:crypto';

/**
 * @typedef {object} RequestToHash
 * @property {string} method - The HTTP method (e.g., 'GET', 'POST').
 * @property {string} path - The URL path and query string (e.g., '/users?id=123').
 * @property {string | object | undefined} [body] - The request body.
 * @property {string} [scope] - The base URL of the request (e.g., 'https://api.example.com').
 */

/**
 * Normalizes a request object to ensure consistent hashing.
 * It sorts query parameters and object keys in the body.
 *
 * @param {RequestToHash} request - The raw request object.
 * @returns {object} A new, normalized request object.
 */
function normalizeRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('[HashGenerator] Invalid request object provided for normalization.');
  }

  const { method, path, body, scope } = request;

  // 1. Normalize URL: Sort query parameters
  const url = new URL(path, scope || 'http://localhost'); // Use a dummy base if scope is missing
  url.searchParams.sort();
  const normalizedPath = `${url.pathname}${url.search}`;

  // 2. Normalize Body:
  // - If it's an object, stringify it with sorted keys.
  // - If it's a string, try to parse it as JSON and normalize, otherwise use as-is.
  // - Handle other types by simple stringification.
  let normalizedBody = '';
  if (body) {
    if (typeof body === 'object') {
      // Use a replacer to sort keys recursively for deterministic output
      const replacer = (key, value) =>
        value instanceof Object && !(value instanceof Array)
          ? Object.keys(value)
              .sort()
              .reduce((sorted, innerKey) => {
                sorted[innerKey] = value[innerKey];
                return sorted;
              }, {})
          : value;
      normalizedBody = JSON.stringify(body, replacer);
    } else if (typeof body === 'string') {
      try {
        // Attempt to parse and normalize if it's a JSON string
        const parsedBody = JSON.parse(body);
        const replacer = (key, value) =>
          value instanceof Object && !(value instanceof Array)
            ? Object.keys(value)
                .sort()
                .reduce((sorted, innerKey) => {
                  sorted[innerKey] = value[innerKey];
                  return sorted;
                }, {})
            : value;
        normalizedBody = JSON.stringify(parsedBody, replacer);
      } catch (e) {
        // Not a valid JSON string, use it as is
        normalizedBody = body;
      }
    } else {
      // For other primitives (number, boolean), convert to string
      normalizedBody = String(body);
    }
  }

  return {
    method: method.toUpperCase(),
    scope: scope ? new URL(scope).origin : '', // Normalize to origin
    path: normalizedPath,
    body: normalizedBody,
  };
}

/**
 * Generates a stable SHA-256 hash from a request object.
 * The hash is created from the normalized method, scope, path, and body
 * to ensure that similar requests produce the same hash, making filenames predictable.
 *
 * @param {RequestToHash} request - The request object containing method, path, and body.
 * @returns {string} A hex-encoded SHA-256 hash string.
 * @throws {Error} If the request object is invalid.
 */
export function generateRequestHash(request) {
  try {
    const normalized = normalizeRequest(request);

    // Create a stable, canonical string representation of the request.
    // We use a separator that is unlikely to appear in the content itself.
    const canonicalString = [
      normalized.method,
      normalized.scope,
      normalized.path,
      normalized.body,
    ].join('||');

    return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
  } catch (error) {
    console.error('[HashGenerator] Failed to generate hash:', error);
    // Re-throw to be handled by the caller (e.g., the recorder)
    throw new Error(`Could not generate a stable hash for the request. ${error.message}`);
  }
}