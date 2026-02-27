/**
 * @fileoverview Ajv JSON schema for validating the `routes.json` configuration file.
 *
 * This schema defines the expected structure and data types for the routing
 * configuration. It ensures that any `routes.json` file loaded by the application
 * is well-formed, preventing configuration-related runtime errors. The schema is
 * used by the `config-loader.js` module to validate the configuration upon
 * application start and during hot-reloads.
 */

const routesSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Webhook Relay Service Route Configuration',
  description: 'Defines the routing rules for the webhook relay service.',
  type: 'object',
  properties: {
    routes: {
      description: 'An array of route configuration objects.',
      type: 'array',
      minItems: 1,
      items: {
        $ref: '#/definitions/route',
      },
      // Ensure that each `path` property within the array is unique.
      uniqueItems: true,
    },
  },
  required: ['routes'],
  additionalProperties: false,

  definitions: {
    route: {
      description: 'A single route mapping a public path to an internal target.',
      type: 'object',
      properties: {
        path: {
          description: 'The public-facing path for the webhook (e.g., "/webhooks/github"). Must start with a slash and be a valid URL path segment.',
          type: 'string',
          pattern: '^/[/\\w\\-.~!$&\'()*+,;=:@%]+$',
          minLength: 2,
        },
        targetUrl: {
          description: 'The internal URL to which the webhook will be relayed (e.g., "http://localhost:8080/hooks/github").',
          type: 'string',
          format: 'uri',
        },
        secret: {
          description: 'Optional pre-shared secret key for HMAC-SHA256 signature validation. If provided, validation is enforced.',
          type: 'string',
          minLength: 16, // Enforce a reasonable minimum secret length for security.
        },
        retry: {
          $ref: '#/definitions/retryConfig',
        },
        forwardHeaders: {
          $ref: '#/definitions/forwardHeadersConfig',
        },
      },
      required: ['path', 'targetUrl'],
      additionalProperties: false,
    },

    retryConfig: {
      description: 'Optional configuration for the request retry mechanism.',
      type: 'object',
      properties: {
        attempts: {
          description: 'Maximum number of relay attempts, including the initial one. Defaults to 3.',
          type: 'integer',
          minimum: 1,
          maximum: 10,
        },
        initialDelay: {
          description: 'The initial delay in milliseconds before the first retry. Defaults to 1000.',
          type: 'integer',
          minimum: 100,
        },
        maxDelay: {
          description: 'The maximum possible delay between retries in milliseconds. Defaults to 30000.',
          type: 'integer',
          minimum: 100,
        },
        factor: {
          description: 'The exponential backoff factor. The delay is multiplied by this factor for each subsequent retry. Defaults to 2.',
          type: 'number',
          minimum: 1.0,
        },
      },
      additionalProperties: false,
    },

    forwardHeadersConfig: {
      description: 'Optional configuration for forwarding headers to the target URL.',
      type: 'object',
      properties: {
        include: {
          description: 'An array of header names (case-insensitive) to forward from the original request.',
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
          uniqueItems: true,
        },
        static: {
          description: 'An object of static headers to add to the relayed request. These will override any included headers with the same name.',
          type: 'object',
          propertyNames: {
            type: 'string',
            minLength: 1,
          },
          additionalProperties: {
            type: 'string',
          },
        },
      },
      additionalProperties: false,
    },
  },
};

export default routesSchema;