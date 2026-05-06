/**
 * @file src/analyzer/endpoint-analyzer.js
 * @description Analyzes parsed AST and JSDoc data to build a structured representation of each API endpoint.
 *
 * This module is the bridge between parsing and code generation. It takes the raw output
 * from the AST parser (function nodes and their JSDoc comments) and the JSDoc parser
 * (structured comment data), and synthesizes them into a coherent, high-level
 * model of an API endpoint. This model includes the endpoint's path, HTTP method,
 * parameters (from path, query, and body), and all possible success and error
 * responses. This structured representation is the "source of truth" for the
 * code generation phase.
 */

import path from 'node:path';
import { parseJSDoc } from '../parser/jsdoc-parser.js';

/**
 * Analyzes a list of documented nodes (from ast-parser) to produce a structured
 * list of API endpoints.
 *
 * It filters out any functions that don't have a `@route` tag, as those are not
 * considered API endpoints. For each valid endpoint, it synthesizes information
 * from the AST node and the parsed JSDoc to create a complete endpoint definition.
 *
 * @param {Array<{name: string, comment: string, node: object, filePath: string}>} documentedNodes
 *        An array of function/method nodes with their associated JSDoc comments.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of endpoint objects.
 *          Each object represents a fully defined API endpoint.
 * @throws {Error} If documentedNodes is not a valid array.
 */
export async function analyzeEndpoints(documentedNodes) {
  if (!Array.isArray(documentedNodes)) {
    throw new Error('Input `documentedNodes` must be an array.');
  }

  const endpoints = [];

  for (const nodeInfo of documentedNodes) {
    const jsdoc = parseJSDoc(nodeInfo.comment);

    // An endpoint is only valid if it has a @route tag.
    if (!jsdoc?.route) {
      continue;
    }

    try {
      const endpoint = buildEndpoint(nodeInfo, jsdoc);
      endpoints.push(endpoint);
    } catch (error) {
      // Log the error with context and continue processing other endpoints.
      console.warn(
        `Skipping endpoint in "${nodeInfo.filePath}" due to analysis error: ${error.message}`,
      );
    }
  }

  return endpoints;
}

/**
 * Constructs a single, detailed endpoint object from its AST and JSDoc info.
 *
 * @param {object} nodeInfo - The node information from `ast-parser`.
 * @param {object} jsdoc - The parsed JSDoc object from `jsdoc-parser`.
 * @returns {object} A structured endpoint object.
 * @throws {Error} If essential information (like route) is missing or invalid.
 */
function buildEndpoint(nodeInfo, jsdoc) {
  const { name: functionName, filePath } = nodeInfo;
  const { route, description, params, returns, throws } = jsdoc;

  if (!route || !route.method || !route.path) {
    throw new Error(`Invalid or missing @route tag for function "${functionName}".`);
  }

  const pathParams = extractPathParameters(route.path);

  const endpoint = {
    handlerName: functionName,
    description: description ?? '',
    method: route.method.toLowerCase(),
    path: route.path,
    // Relative path from a conventional 'src' or root to the service file.
    // e.g., 'services/user-service.js'
    servicePath: getRelativeServicePath(filePath),
    parameters: {
      path: [],
      query: [],
      body: null, // An endpoint can have at most one body schema.
    },
    responses: [],
  };

  // Categorize @param tags into path, query, or body parameters.
  for (const param of params) {
    categorizeParameter(param, pathParams, endpoint.parameters);
  }

  // Process success responses from @returns tags.
  for (const ret of returns) {
    endpoint.responses.push({
      status: ret.status,
      description: ret.description,
      schema: parseTypeString(ret.type),
      isError: false,
    });
  }

  // Process error responses from @throws tags.
  for (const thr of throws) {
    endpoint.responses.push({
      status: thr.status,
      description: thr.description,
      schema: parseTypeString(thr.type),
      isError: true,
    });
  }

  return endpoint;
}

/**
 * Categorizes a JSDoc `@param` tag into path, query, or body.
 * - If the param name matches a path segment (e.g., `:id`), it's a path param.
 * - If the param name is 'body' or 'requestBody', it's a body param.
 * - Otherwise, it's treated as a query parameter.
 *
 * @param {object} param - The parsed parameter object from `jsdoc-parser`.
 * @param {Set<string>} pathParams - A Set of parameter names extracted from the route path.
 * @param {object} parameters - The `parameters` object of the endpoint being built.
 */
function categorizeParameter(param, pathParams, parameters) {
  const paramName = param.name.split('.')[0]; // Handle dot notation like `user.id`

  if (pathParams.has(paramName)) {
    parameters.path.push({
      name: paramName,
      schema: parseTypeString(param.type),
      description: param.description,
    });
  } else if (paramName === 'body' || paramName === 'requestBody') {
    if (parameters.body) {
      // Prevent defining multiple body schemas for a single endpoint.
      console.warn(
        `Multiple body definitions found (@param body, @param requestBody). Using the first one.`,
      );
      return;
    }
    parameters.body = {
      schema: parseTypeString(param.type),
      description: param.description,
    };
  } else {
    parameters.query.push({
      name: param.name, // Keep original name for query (e.g., 'user.id')
      schema: parseTypeString(param.type),
      description: param.description,
      required: !param.optional,
    });
  }
}

/**
 * Extracts parameter names from an Express-style route path string.
 * Example: `/users/:id/posts/:postId` -> `Set{'id', 'postId'}`
 *
 * @param {string} routePath - The route path string.
 * @returns {Set<string>} A Set containing the names of the path parameters.
 */
function extractPathParameters(routePath) {
  const params = new Set();
  // Regex to find segments like `:id` or `:_id` or `:userId`. It captures the name without the colon.
  const matches = routePath.matchAll(/:([a-zA-Z0-9_]+)/g);
  for (const match of matches) {
    params.add(match[1]);
  }
  return params;
}

/**
 * Parses the JSDoc type string into a JSON schema object.
 * This handles simple types and object literals.
 * Example: `{type: 'string', minLength: 2}` -> `{ "type": "string", "minLength": 2 }`
 * Example: `string` -> `{ "type": "string" }`
 *
 * @param {string} typeString - The type string from a JSDoc tag (e.g., `@param {string}`).
 * @returns {object | null} A JSON schema object, or null if the type is empty or invalid.
 */
function parseTypeString(typeString) {
  if (!typeString || typeString === 'void' || typeString === 'undefined') {
    return null;
  }

  const trimmedType = typeString.trim();

  // Case 1: It's an object literal, e.g., `{type: 'string', ...}`
  if (trimmedType.startsWith('{') && trimmedType.endsWith('}')) {
    try {
      // A safe-eval-like approach for JSON-like object literals.
      // This is more flexible than JSON.parse as it allows unquoted keys.
      // It constructs a new Function that returns the object.
      const obj = new Function(`return ${trimmedType}`)();
      return obj;
    } catch (e) {
      console.warn(`Could not parse JSDoc type as an object: ${typeString}`);
      // Fallback to treating it as a literal string type.
      return { type: 'object' };
    }
  }

  // Case 2: It's a simple type name, e.g., `string`, `number`, `MyType`
  // We map common JS types to JSON schema types.
  const typeMap = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    object: 'object',
    array: 'array',
  };

  const lowerType = trimmedType.toLowerCase();
  if (typeMap[lowerType]) {
    return { type: typeMap[lowerType] };
  }

  // For custom types or unhandled primitives, we can't infer a schema.
  // We return a generic object schema as a reasonable default.
  // A more advanced implementation could look up these types.
  return { type: 'object' };
}

/**
 * Calculates a relative path for the service file, suitable for import statements
 * in the generated code. It tries to find a common root like `src` or `source`.
 *
 * @param {string} absoluteFilePath - The absolute path to the service file.
 * @returns {string} A relative path, e.g., `services/user-service.js`.
 */
function getRelativeServicePath(absoluteFilePath) {
  const pathParts = absoluteFilePath.split(path.sep);
  const srcIndex = pathParts.lastIndexOf('src');
  const servicesIndex = pathParts.lastIndexOf('services');

  let relativeRootIndex = -1;
  if (srcIndex !== -1) {
    relativeRootIndex = srcIndex + 1;
  } else if (servicesIndex !== -1) {
    relativeRootIndex = servicesIndex;
  }

  if (relativeRootIndex !== -1) {
    return path.join(...pathParts.slice(relativeRootIndex));
  }

  // Fallback: return the filename if no common root is found.
  return path.basename(absoluteFilePath);
}