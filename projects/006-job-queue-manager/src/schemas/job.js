/**
 * @file Defines the JSON schemas for job-related operations, primarily for validating
 * incoming job creation requests. These schemas are used by Ajv to ensure data
* integrity and consistency.
 *
 * @module src/schemas/job
 */

/**
 * @constant {object} createJobSchema
 * @description JSON schema for validating the body of a POST request to create a new job.
 * This schema enforces the structure and data types for all job properties,
 * ensuring that only valid jobs can be enqueued.
 *
 * @property {object} type - The overall schema type, must be 'object'.
 * @property {object} properties - Defines the individual properties of a job object.
 * @property {object} properties.type - The job type, a string used by workers to identify
 *   the task to be executed (e.g., 'send-email', 'process-image').
 *   - `type`: 'string'
 *   - `minLength`: 1 (cannot be empty)
 *   - `pattern`: '^[a-zA-Z0-9_-]+$' (allows alphanumeric characters, underscores, and hyphens)
 *
 * @property {object} properties.payload - An object containing the data required for the job.
 *   Its structure is flexible (`type: 'object'`) to accommodate different job types.
 *
 * @property {object} properties.priority - The job's priority. Higher numbers are processed first.
 *   - `type`: 'integer'
 *   - `default`: 0
 *   - `minimum`: -10
 *   - `maximum`: 10
 *
 * @property {object} properties.delay - A delay in milliseconds before the job becomes available
 *   for processing. Useful for scheduling jobs in the future.
 *   - `type`: 'integer'
 *   - `default`: 0
 *   - `minimum`: 0 (cannot be negative)
 *   - `maximum`: 86400000 (24 hours) - A sensible upper limit to prevent very long delays.
 *
 * @property {object} properties.retry - Configuration for automatic retries on failure.
 *   - `type`: 'object'
 *   - `properties`:
 *     - `maxAttempts`: Maximum number of times to retry the job.
 *       - `type`: 'integer', `default`: 3, `minimum`: 0, `maximum`: 10
 *     - `backoff`: The base delay in milliseconds for exponential backoff.
 *       - `type`: 'integer', `default`: 1000, `minimum`: 100, `maximum`: 60000
 *   - `default`: `{ maxAttempts: 3, backoff: 1000 }`
 *
 * @property {object} properties.webhook - Configuration for notifying an external service.
 *   - `type`: 'object'
 *   - `properties`:
 *     - `url`: The URL to which a POST request will be sent on job completion or failure.
 *       - `type`: 'string', `format`: 'uri'
 *     - `headers`: Optional custom headers to include in the webhook request.
 *       - `type`: 'object', `additionalProperties`: { `type`: 'string' }
 *   - `required`: ['url']
 *
 * @property {string[]} required - Specifies the mandatory properties for a valid job.
 *   - `['type', 'payload']`
 */
export const createJobSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      description: 'A string identifier for the type of job to be processed.',
      minLength: 1,
      // A simple pattern to enforce clean job type names.
      pattern: '^[a-zA-Z0-9_-]+$',
    },
    payload: {
      type: 'object',
      description: 'The data required by the worker to execute the job.',
      // We allow any object structure here as it's job-type specific.
      // Specific workers can implement their own payload validation if needed.
      default: {},
    },
    priority: {
      type: 'integer',
      description: 'Job priority. Higher numbers are processed sooner. Range: -10 to 10.',
      default: 0,
      minimum: -10,
      maximum: 10,
    },
    delay: {
      type: 'integer',
      description: 'Delay in milliseconds before the job is available for processing.',
      default: 0,
      minimum: 0,
      maximum: 86400000, // 24 hours in ms
    },
    retry: {
      type: 'object',
      description: 'Configuration for automatic retries on failure.',
      properties: {
        maxAttempts: {
          type: 'integer',
          description: 'Maximum number of retry attempts.',
          default: 3,
          minimum: 0,
          maximum: 10,
        },
        backoff: {
          type: 'integer',
          description: 'Base delay in milliseconds for exponential backoff.',
          default: 1000,
          minimum: 100,
          maximum: 60000, // 1 minute
        },
      },
      default: {}, // Ajv will apply defaults from properties
    },
    webhook: {
      type: 'object',
      description: 'Webhook to call upon job completion or failure.',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to receive the webhook POST request.',
          format: 'uri', // Ensures a valid URI format
        },
        headers: {
          type: 'object',
          description: 'Optional custom headers for the webhook request.',
          // Allows any string key-value pairs.
          additionalProperties: { type: 'string' },
          default: {},
        },
      },
      required: ['url'],
    },
  },
  required: ['type', 'payload'],
};

// This file primarily exports schema definitions, so no other logic is needed.
// Other schemas, e.g., for querying job status or for worker-specific payloads,
// could be added here in a larger application.