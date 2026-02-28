import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * @fileoverview Defines and exports JSON schemas for validating job definitions
 * and application configuration using the AJV library. This centralized schema
 * management ensures data consistency and provides clear, enforceable contracts
 * for various data structures used throughout the Adaptive Scraper Cluster.
 *
 * @see {@link https://ajv.js.org/|AJV Documentation}
 */

/**
 * A pre-configured AJV instance for consistent validation across the application.
 * - `allErrors: true`: Collects all validation errors, not just the first one.
 * - `addFormats('uri')`: Adds support for the 'uri' format, crucial for validating URLs.
 *
 * @type {Ajv}
 */
const ajv = new Ajv({ allErrors: true });
addFormats(ajv, ['uri']);

/**
 * JSON Schema for a single scraping job definition.
 * This schema validates the structure of jobs submitted to the cluster, ensuring
 * they contain all necessary information for a worker to execute them.
 *
 * @constant
 * @type {object}
 */
export const jobSchema = {
  $id: 'asc/job',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'A unique identifier for the job.',
      minLength: 1,
    },
    url: {
      type: 'string',
      format: 'uri',
      description: 'The target URL to scrape.',
    },
    parser: {
      type: 'string',
      description: "The name of the parser to use (e.g., 'html-cheerio').",
      enum: ['html-cheerio', 'json-passthrough'],
      default: 'html-cheerio',
    },
    priority: {
      type: 'integer',
      description: 'Job priority (higher numbers are processed first).',
      minimum: 0,
      default: 0,
    },
    metadata: {
      type: 'object',
      description: 'Arbitrary user-defined data to be passed through to the result.',
      additionalProperties: true,
      default: {},
    },
    http: {
      type: 'object',
      description: 'HTTP request-specific settings.',
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
          default: 'GET',
        },
        headers: {
          type: 'object',
          description: 'Custom HTTP headers to send with the request.',
          additionalProperties: { type: 'string' },
        },
        body: {
          description: 'Request body for methods like POST or PUT.',
          anyOf: [{ type: 'string' }, { type: 'object' }],
        },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'url'],
  additionalProperties: false,
};

/**
 * JSON Schema for an array of scraping jobs.
 * This is typically used when submitting a batch of jobs in a single file.
 *
 * @constant
 * @type {object}
 */
export const jobBatchSchema = {
  $id: 'asc/jobBatch',
  type: 'array',
  items: { $ref: 'asc/job' },
  minItems: 1,
};

/**
 * JSON Schema for the main application configuration file.
 * This schema validates the structure of `config.json` or equivalent environment
 * variables, ensuring the controller and workers are configured correctly.
 *
 * @constant
 * @type {object}
 */
export const configSchema = {
  $id: 'asc/config',
  type: 'object',
  properties: {
    redis: {
      type: 'object',
      description: 'Redis connection settings.',
      properties: {
        host: { type: 'string', default: '127.0.0.1' },
        port: { type: 'integer', minimum: 1, maximum: 65535, default: 6379 },
        password: { type: 'string' },
        db: { type: 'integer', minimum: 0, default: 0 },
        keyPrefix: { type: 'string', default: 'asc:' },
      },
      required: ['host', 'port'],
      additionalProperties: false,
    },
    logging: {
      type: 'object',
      description: 'Logging configuration.',
      properties: {
        level: {
          type: 'string',
          enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
          default: 'info',
        },
        pretty: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
    proxies: {
      type: 'array',
      description: 'A list of proxy URLs to rotate through.',
      items: { type: 'string', format: 'uri' },
      minItems: 1,
    },
    userAgents: {
      type: 'array',
      description: 'A list of User-Agent strings to rotate through.',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
    },
    governor: {
      type: 'object',
      description: 'Settings for the feedback governor (adaptive throttling).',
      properties: {
        initialDelay: {
          type: 'integer',
          description: 'Initial delay between requests in milliseconds.',
          minimum: 0,
          default: 1000,
        },
        maxDelay: {
          type: 'integer',
          description: 'Maximum delay between requests in milliseconds.',
          minimum: 0,
          default: 30000,
        },
        backoffFactor: {
          type: 'number',
          description: 'Multiplier for increasing delay upon block detection.',
          exclusiveMinimum: 1,
          default: 1.5,
        },
        cooldownFactor: {
          type: 'number',
          description: 'Divisor for decreasing delay after a period of success.',
          exclusiveMinimum: 1,
          default: 1.1,
        },
        blockDetection: {
          type: 'object',
          description: 'Rules for detecting if a request was blocked.',
          properties: {
            statusCodes: {
              type: 'array',
              items: { type: 'integer' },
              default: [403, 429, 503],
            },
            bodyKeywords: {
              type: 'array',
              items: { type: 'string' },
              default: ['captcha', 'blocked', 'are you a robot'],
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    worker: {
      type: 'object',
      description: 'Settings specific to worker nodes.',
      properties: {
        concurrency: {
          type: 'integer',
          description: 'Number of concurrent scraping tasks per worker.',
          minimum: 1,
          default: 5,
        },
      },
      additionalProperties: false,
    },
    controller: {
      type: 'object',
      description: 'Settings specific to the controller node.',
      properties: {
        workerTimeout: {
          type: 'integer',
          description: 'Time in seconds before an unresponsive worker is considered dead.',
          minimum: 1,
          default: 60,
        },
        metricsUpdateInterval: {
          type: 'integer',
          description: 'Interval in seconds for logging cluster metrics.',
          minimum: 1,
          default: 30,
        },
      },
      additionalProperties: false,
    },
  },
  required: ['redis', 'proxies', 'userAgents'],
  additionalProperties: false,
};

// Pre-compile schemas for performance. AJV caches compiled schemas,
// so subsequent calls with the same schema are instantaneous.
ajv.addSchema(jobSchema);
ajv.addSchema(jobBatchSchema);
ajv.addSchema(configSchema);

/**
 * A centralized validation utility function.
 *
 * It takes data and a schema ID, validates the data against the corresponding
 * pre-compiled schema, and returns a structured result. This approach
 * encapsulates AJV's logic and provides a consistent error handling mechanism.
 *
 * @param {string} schemaId - The `$id` of the schema to validate against (e.g., 'asc/job').
 * @param {*} data - The data to be validated.
 * @returns {{isValid: boolean, errors: string | null}} An object indicating validation success.
 * If invalid, `errors` contains a formatted, human-readable string of all validation errors.
 */
export function validate(schemaId, data) {
  const validator = ajv.getSchema(schemaId);
  if (!validator) {
    // This is a developer error, so we throw immediately.
    throw new Error(`Schema with id "${schemaId}" not found.`);
  }

  const isValid = validator(data);

  if (isValid) {
    return { isValid: true, errors: null };
  }

  // Format errors into a more readable string.
  const errorMessages =
    validator.errors
      ?.map((err) => `[${err.instancePath || 'root'}] ${err.message}`)
      .join('; ') ?? 'Unknown validation error';

  return { isValid: false, errors: errorMessages };
}