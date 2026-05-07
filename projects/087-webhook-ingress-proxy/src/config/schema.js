/**
 * @fileoverview Defines the JSON schema for the main application configuration file.
 * This schema ensures that the configuration structure is valid, preventing
 * common errors and providing clear validation feedback to the user. It is used
 * by `src/config/loader.js` to validate the configuration at startup.
 *
 * The schema is designed to be comprehensive, covering all possible settings for
 * server options, routes, validation, transformation, and forwarding targets.
 * Using a detailed schema like this enables features like default values and
 * self-documentation of the configuration format.
 */

const httpMethod = {
  type: 'string',
  enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
};

const headerMatcher = {
  type: 'object',
  description: 'A key-value map of headers to match. The request must contain all specified headers with the exact values.',
  additionalProperties: { type: 'string' },
};

const queryMatcher = {
  type: 'object',
  description: 'A key-value map of query parameters to match. The request must contain all specified query parameters with the exact values.',
  additionalProperties: { type: 'string' },
};

const signatureValidation = {
  type: 'object',
  description: 'Configuration for verifying request signatures (e.g., HMAC).',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Whether signature validation is enabled for this route.',
      default: true,
    },
    algorithm: {
      type: 'string',
      description: 'The HMAC algorithm to use (e.g., "sha256", "sha1"). Must be a valid algorithm supported by Node.js crypto module.',
      examples: ['sha256', 'sha1'],
    },
    secret: {
      type: 'string',
      description: 'The secret key used for generating the HMAC signature. Can be an environment variable name (e.g., "${GITHUB_WEBHOOK_SECRET}").',
      minLength: 1,
    },
    header: {
      type: 'string',
      description: 'The name of the HTTP header containing the signature.',
      default: 'X-Hub-Signature-256',
      examples: ['X-Hub-Signature-256', 'Stripe-Signature'],
    },
  },
  required: ['algorithm', 'secret'],
  if: {
    properties: { enabled: { const: true } },
  },
  then: {
    required: ['algorithm', 'secret'],
  },
};

const payloadValidation = {
  type: 'object',
  description: 'Configuration for validating the request payload against a JSON Schema.',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Whether JSON schema validation is enabled for this route.',
      default: true,
    },
    schema: {
      type: 'object',
      description: 'The JSON Schema object to validate the request body against.',
      minProperties: 1,
    },
  },
  if: {
    properties: { enabled: { const: true } },
  },
  then: {
    required: ['schema'],
  },
};

const transformation = {
  type: 'object',
  description: 'Configuration for transforming the payload using a JSONata expression.',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Whether payload transformation is enabled for this route.',
      default: true,
    },
    expression: {
      type: 'string',
      description: 'The JSONata expression to apply to the incoming payload.',
      minLength: 1,
      examples: ["{'event_type': type, 'data': payload}"],
    },
  },
  if: {
    properties: { enabled: { const: true } },
  },
  then: {
    required: ['expression'],
  },
};

const retryPolicy = {
  type: 'object',
  description: 'Retry policy for forwarding requests to this target.',
  properties: {
    enabled: {
      type: 'boolean',
      description: 'Whether to enable retries for this target.',
      default: true,
    },
    maxRetries: {
      type: 'integer',
      description: 'Maximum number of retry attempts.',
      minimum: 1,
      maximum: 10,
      default: 3,
    },
    initialInterval: {
      type: 'integer',
      description: 'Initial delay in milliseconds before the first retry.',
      minimum: 100,
      default: 1000,
    },
    maxInterval: {
      type: 'integer',
      description: 'Maximum delay in milliseconds between retries.',
      minimum: 1000,
      default: 30000,
    },
    backoffFactor: {
      type: 'number',
      description: 'The multiplier for exponential backoff (e.g., 2 for doubling the delay).',
      minimum: 1.1,
      default: 2,
    },
    jitter: {
      type: 'boolean',
      description: 'Whether to add random jitter to the retry delay to avoid thundering herd problems.',
      default: true,
    },
  },
};

const forwardTarget = {
  type: 'object',
  description: 'A single downstream service to forward the webhook to.',
  properties: {
    id: {
      type: 'string',
      description: 'A unique identifier for this target, used for logging.',
      pattern: '^[a-zA-Z0-9-_]+$',
    },
    url: {
      type: 'string',
      description: 'The URL of the downstream service. Can be an environment variable (e.g., "${USER_SERVICE_URL}").',
      format: 'uri',
    },
    method: httpMethod,
    headers: {
      type: 'object',
      description: 'Static headers to add to the forwarded request.',
      additionalProperties: { type: 'string' },
    },
    retry: retryPolicy,
  },
  required: ['id', 'url'],
};

const route = {
  type: 'object',
  description: 'Defines a single webhook route, its matching criteria, and its forwarding behavior.',
  properties: {
    id: {
      type: 'string',
      description: 'A unique identifier for the route, used for logging and caching.',
      pattern: '^[a-zA-Z0-9-_]+$',
    },
    path: {
      type: 'string',
      description: 'The URL path to match for incoming webhooks (e.g., "/webhooks/github").',
      pattern: '^/',
    },
    methods: {
      type: 'array',
      description: 'A list of HTTP methods to accept for this route.',
      items: httpMethod,
      minItems: 1,
      uniqueItems: true,
      default: ['POST'],
    },
    match: {
      type: 'object',
      description: 'Optional criteria for more specific request matching.',
      properties: {
        headers: headerMatcher,
        query: queryMatcher,
        payload: {
          type: 'string',
          description: 'A JSONata expression that must evaluate to a truthy value for the route to match.',
          minLength: 1,
        },
      },
      minProperties: 1,
    },
    validation: {
      type: 'object',
      description: 'Validation rules to apply to the incoming request.',
      properties: {
        signature: signatureValidation,
        payload: payloadValidation,
      },
    },
    transform: transformation,
    forward: {
      type: 'object',
      description: 'Configuration for forwarding the request to downstream services.',
      properties: {
        targets: {
          type: 'array',
          description: 'A list of one or more downstream targets to forward the webhook to.',
          items: forwardTarget,
          minItems: 1,
        },
      },
      required: ['targets'],
    },
  },
  required: ['id', 'path', 'forward'],
};

/**
 * The main JSON schema for the entire configuration file.
 * It defines the top-level structure, including server options and the list of routes.
 *
 * @type {import('ajv').SchemaObject}
 */
export const configSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Webhook Ingress Proxy Configuration',
  description: 'Schema for the main configuration file of the webhook ingress proxy.',
  type: 'object',
  properties: {
    server: {
      type: 'object',
      description: 'Global server configuration settings.',
      properties: {
        host: {
          type: 'string',
          description: 'The host address for the server to listen on.',
          default: '0.0.0.0',
        },
        port: {
          type: 'integer',
          description: 'The port for the server to listen on. Can be an environment variable (e.g., "${PORT}").',
          minimum: 1,
          maximum: 65535,
          default: 3000,
        },
        logLevel: {
          type: 'string',
          description: 'The logging level for the application.',
          enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
          default: 'info',
        },
      },
    },
    routes: {
      type: 'array',
      description: 'A list of all webhook routes the proxy will handle.',
      items: route,
      minItems: 1,
    },
  },
  required: ['routes'],
};