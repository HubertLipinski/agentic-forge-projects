/**
 * @file src/config/schema.js
 * @description Defines the JSON Schema for the client configuration file.
 * This schema is used by Ajv to validate the user-provided configuration.
 */

/**
 * @typedef {import('ajv').SchemaObject} SchemaObject
 */

/**
 * JSON Schema for the REST client generator configuration file.
 *
 * This schema enforces the structure of the `*.config.json` file, ensuring
 * that all required properties are present and correctly typed before the
 * generation process begins.
 *
 * @type {SchemaObject}
 */
const configSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'REST Client Generator Configuration',
  description: 'Schema for the configuration file used to generate a REST API client.',
  type: 'object',
  properties: {
    clientClassName: {
      description: 'The name of the generated JavaScript class for the client.',
      type: 'string',
      pattern: '^[A-Z][a-zA-Z0-9]*$',
      minLength: 1,
      errorMessage: 'clientClassName must be a valid PascalCase JavaScript class name (e.g., "ApiClient").',
    },
    baseUrl: {
      description: 'The base URL for all API endpoints.',
      type: 'string',
      format: 'uri',
      pattern: '^https?://',
      errorMessage: 'baseUrl must be a valid absolute URL (e.g., "https://api.example.com/v1").',
    },
    defaultHeaders: {
      description: 'A key-value map of headers to be sent with every request.',
      type: 'object',
      additionalProperties: {
        type: 'string',
      },
      errorMessage: 'defaultHeaders must be an object where keys and values are both strings.',
    },
    endpoints: {
      description: 'A map of endpoint definitions, where the key is the method name.',
      type: 'object',
      minProperties: 1,
      patternProperties: {
        '^[a-z][a-zA-Z0-9]*$': {
          $ref: '#/definitions/endpoint',
        },
      },
      additionalProperties: false,
      errorMessage: {
        minProperties: 'The "endpoints" object must contain at least one endpoint definition.',
        patternProperties: 'Each key in the "endpoints" object must be a valid camelCase JavaScript method name (e.g., "getUserById").',
        additionalProperties: 'Endpoint keys must be valid camelCase JavaScript method names.',
      },
    },
  },
  required: ['clientClassName', 'baseUrl', 'endpoints'],
  additionalProperties: false,
  errorMessage: {
    required: {
      clientClassName: 'The "clientClassName" property is required.',
      baseUrl: 'The "baseUrl" property is required.',
      endpoints: 'The "endpoints" property is required.',
    },
    additionalProperties: 'The configuration object contains unknown properties. Allowed properties are: "clientClassName", "baseUrl", "defaultHeaders", "endpoints".',
  },

  definitions: {
    endpoint: {
      description: 'Defines a single API endpoint and its corresponding client method.',
      type: 'object',
      properties: {
        method: {
          description: 'The HTTP method for the request.',
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
          errorMessage: 'The "method" property must be a valid uppercase HTTP verb (e.g., "GET", "POST").',
        },
        path: {
          description: 'The URL path for the endpoint, relative to the baseUrl. Supports path parameters like /users/:id.',
          type: 'string',
          pattern: '^/.*',
          errorMessage: 'The "path" property must be a string starting with a "/" (e.g., "/users/:id").',
        },
        description: {
          description: 'A description of the endpoint, used for generating JSDoc comments.',
          type: 'string',
        },
        // 'params' is a deprecated alias for 'queryParams'
        params: {
          $ref: '#/definitions/queryParams',
          description: 'DEPRECATED. Use "queryParams" instead. Defines the available query string parameters.',
        },
        queryParams: {
          $ref: '#/definitions/queryParams',
          description: 'Defines the available query string parameters.',
        },
        body: {
          description: 'Specifies that the endpoint expects a request body. Set to true for a generic body, or provide a schema for validation (not yet implemented).',
          type: 'boolean',
          errorMessage: 'The "body" property, if present, must be a boolean value (true).',
        },
      },
      required: ['method', 'path'],
      additionalProperties: false,
      errorMessage: {
        required: {
          method: 'Each endpoint must have a "method" property.',
          path: 'Each endpoint must have a "path" property.',
        },
        additionalProperties: 'Endpoint definition contains unknown properties. Allowed properties are: "method", "path", "description", "queryParams", and "body".',
      },
    },
    queryParams: {
      description: 'An array of strings representing the names of the allowed query parameters.',
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-zA-Z0-9_]+$',
        minLength: 1,
      },
      uniqueItems: true,
      errorMessage: {
        type: 'The "queryParams" property must be an array of strings.',
        items: 'Each item in "queryParams" must be a non-empty alphanumeric string.',
        uniqueItems: 'Query parameter names must be unique within the "queryParams" array.',
      },
    },
  },
};

export default configSchema;