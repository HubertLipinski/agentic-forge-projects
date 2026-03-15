/**
 * @file src/generator/preparer.js
 * @description Prepares the data model for the template engine by processing the validated config.
 * It transforms endpoint definitions into a structure that's easy for Mustache to render,
 * for example, by creating parameter lists and identifying parameter types.
 */

/**
 * A custom error class for issues found during the preparation phase.
 */
class PreparationError extends Error {
  /**
   * @param {string} message - A descriptive error message.
   */
  constructor(message) {
    super(message);
    this.name = 'PreparationError';
  }
}

/**
 * Extracts path parameter names from a URL path string (e.g., /users/:id -> ['id']).
 *
 * @param {string} path - The URL path, which may contain parameters like `:id`.
 * @returns {string[]} An array of path parameter names.
 */
const getPathParams = (path) => {
  // A regular expression to find all occurrences of /:paramName
  // It captures the 'paramName' part.
  const paramRegex = /:([a-zA-Z0-9_]+)/g;
  const matches = path.matchAll(paramRegex);
  return Array.from(matches, match => match[1]);
};

/**
 * Processes a single endpoint definition from the configuration.
 *
 * This function transforms the raw endpoint config into a structured object
 * suitable for the `method.mustache` template. It identifies path, query,
 * and body parameters, and formats them for JSDoc generation and method implementation.
 *
 * @param {string} methodName - The name of the client method to be generated (e.g., 'getUserById').
 * @param {object} endpointConfig - The configuration for a single endpoint.
 * @returns {object} A prepared data object for the endpoint.
 * @throws {PreparationError} If there are conflicts or inconsistencies in the endpoint definition.
 */
const prepareEndpoint = (methodName, endpointConfig) => {
  const { method, path, description, body = false } = endpointConfig;
  // The schema allows 'params' as a deprecated alias for 'queryParams'.
  // We normalize it here, giving 'queryParams' precedence.
  const queryParamsConfig = endpointConfig.queryParams ?? endpointConfig.params ?? [];

  const pathParamNames = getPathParams(path);
  const queryParamNames = queryParamsConfig;

  // --- Parameter Validation ---
  // Check for name collisions between path and query parameters.
  const pathParamSet = new Set(pathParamNames);
  const queryParamSet = new Set(queryParamNames);
  const intersection = [...pathParamSet].filter(param => queryParamSet.has(param));

  if (intersection.length > 0) {
    throw new PreparationError(
      `Endpoint "${methodName}" has conflicting parameter names used in both path and query: [${intersection.join(', ')}].`
    );
  }

  if (body && pathParamSet.has('body')) {
    throw new PreparationError(`Endpoint "${methodName}" cannot have a path parameter named "body" when a request body is expected.`);
  }
  if (body && queryParamSet.has('body')) {
    throw new PreparationError(`Endpoint "${methodName}" cannot have a query parameter named "body" when a request body is expected.`);
  }

  // --- Parameter Structuring for Template ---
  const pathParams = pathParamNames.map(name => ({
    name,
    type: 'string | number',
    description: `The '${name}' path parameter.`,
  }));

  const queryParams = queryParamNames.map(name => ({
    name,
    type: 'string | number | (string | number)[]',
    description: `The '${name}' query parameter.`,
  }));

  const bodyParam = body ? [{
    name: 'body',
    type: 'object',
    description: 'The JSON request body.',
  }] : [];

  const allParams = [...pathParams, ...queryParams, ...bodyParam].map((param, index, arr) => ({
    ...param,
    isLast: index === arr.length - 1,
  }));

  // Mark the last item in sub-arrays for template logic (e.g., trailing commas)
  const markLast = (arr) => arr.map((p, i) => ({ ...p, isLast: i === arr.length - 1 }));

  return {
    methodName,
    description,
    httpMethod: method,
    rawPath: path,
    hasBody: body,
    hasPathParams: pathParams.length > 0,
    hasQueryParams: queryParams.length > 0,
    pathParams: markLast(pathParams),
    queryParams: markLast(queryParams),
    allParams,
  };
};

/**
 * Prepares the complete data model for the template engine.
 *
 * This function takes the validated configuration and transforms it into a
 * comprehensive object that the Mustache engine can use to render the client
 * and method templates. It orchestrates the preparation of each endpoint.
 *
 * @param {object} validatedConfig - The configuration object, assumed to be valid.
 * @param {string} sourceFile - The path to the original config file, for documentation.
 * @returns {object} The final data model ready for rendering.
 */
export const prepareTemplateData = (validatedConfig, sourceFile) => {
  const { clientClassName, baseUrl, defaultHeaders = {}, endpoints } = validatedConfig;

  const preparedEndpoints = Object.entries(endpoints).map(([methodName, endpointConfig]) =>
    prepareEndpoint(methodName, endpointConfig)
  );

  const preparedHeaders = Object.entries(defaultHeaders).map(([key, value]) => ({
    key,
    value,
  }));

  return {
    clientClassName,
    baseUrl,
    // The client template has a hardcoded description if none is provided.
    // This property is for a potential future feature in the schema.
    clientDescription: validatedConfig.description,
    defaultHeaders: preparedHeaders,
    endpoints: preparedEndpoints,
    generationTimestamp: new Date().toISOString(),
    sourceFile,
  };
};