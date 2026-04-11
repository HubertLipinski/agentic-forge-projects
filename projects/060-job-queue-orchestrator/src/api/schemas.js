/**
 * src/api/schemas.js
 *
 * Defines Ajv JSON schemas for API request and response validation.
 *
 * This module centralizes all data contracts for the REST API, ensuring
 * that incoming requests are well-formed and outgoing responses adhere to a
 * consistent structure. Using schemas improves API robustness, provides clear
 * documentation, and enables Fastify to optimize request parsing and serialization.
 *
 * Schemas are defined for:
 * - Creating a new job (request body)
 * - Job ID path parameter
 * - Job list query parameters
 * - Standard job object response
 * - Job list response (paginated)
 * - Standard error response
 */

// --- Shared Definitions ---

/**
 * Reusable definition for a job ID.
 * Used in path parameters and response objects.
 * @type {object}
 */
const jobId = {
  type: 'string',
  description: 'The unique identifier for the job.',
  // Example using nanoid format. Adjust if ID generation changes.
  pattern: '^[a-zA-Z0-9_-]{21}$',
  example: 'Uakgb_J5m9g-0JDMbcJqL',
};

/**
 * Reusable definition for the job status enum.
 * @type {object}
 */
const jobStatus = {
  type: 'string',
  description: 'The current status of the job.',
  enum: ['pending', 'running', 'completed', 'failed', 'canceled'],
  example: 'pending',
};

/**
 * Reusable definition for job history entries.
 * @type {object}
 */
const jobHistoryEntry = {
  type: 'object',
  properties: {
    status: jobStatus,
    timestamp: { type: 'string', format: 'date-time' },
    reason: { type: 'string', nullable: true },
  },
  required: ['status', 'timestamp'],
};

// --- Request Schemas ---

/**
 * Schema for the `POST /jobs` request body.
 * Validates the data required to enqueue a new job.
 * @type {object}
 */
export const enqueueJobSchema = {
  $id: 'enqueueJob',
  type: 'object',
  properties: {
    type: {
      type: 'string',
      description: 'The type of job to execute (e.g., "process-video").',
      minLength: 1,
      maxLength: 100,
      pattern: '^[a-zA-Z0-9_-]+$',
      example: 'image-resize',
    },
    payload: {
      type: 'object',
      description: 'The data payload required for the job execution.',
      properties: {},
      additionalProperties: true,
      default: {},
      example: {
        sourceUrl: 'https://example.com/image.jpg',
        width: 800,
        height: 600,
      },
    },
    options: {
      type: 'object',
      description: 'Optional settings for this specific job.',
      properties: {
        maxRetries: {
          type: 'integer',
          description: 'Override the default maximum number of retries.',
          minimum: 0,
          maximum: 10,
        },
        webhookUrl: {
          type: 'string',
          description: 'A URL to notify upon job completion or failure.',
          format: 'uri',
          maxLength: 2048,
        },
        ttl: {
          type: 'integer',
          description: 'Time-to-live in seconds for the job record after final state (completed/failed).',
          minimum: 60, // 1 minute
        },
      },
      additionalProperties: false,
      default: {},
    },
  },
  required: ['type'],
};

/**
 * Schema for the `:id` path parameter.
 * @type {object}
 */
export const jobIdParamSchema = {
  $id: 'jobIdParam',
  type: 'object',
  properties: {
    id: jobId,
  },
  required: ['id'],
};

/**
 * Schema for the `GET /jobs` querystring parameters.
 * Validates filtering and pagination options.
 * @type {object}
 */
export const jobListQuerySchema = {
  $id: 'jobListQuery',
  type: 'object',
  properties: {
    status: jobStatus,
    type: {
      type: 'string',
      description: 'Filter jobs by type.',
      minLength: 1,
      maxLength: 100,
    },
    limit: {
      type: 'integer',
      description: 'The maximum number of jobs to return.',
      default: 100,
      minimum: 1,
      maximum: 1000,
    },
    offset: {
      type: 'integer',
      description: 'The number of jobs to skip for pagination.',
      default: 0,
      minimum: 0,
    },
  },
  additionalProperties: false,
};

// --- Response Schemas ---

/**
 * Schema for a single job object in API responses.
 * This represents the full, detailed state of a job.
 * @type {object}
 */
export const jobResponseSchema = {
  $id: 'jobResponse',
  type: 'object',
  properties: {
    id: jobId,
    type: { type: 'string' },
    status: jobStatus,
    payload: { type: 'object', additionalProperties: true, nullable: true },
    output: { type: 'object', additionalProperties: true, nullable: true },
    error: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        message: { type: 'string' },
        stack: { type: 'string' },
      },
      nullable: true,
    },
    options: {
      type: 'object',
      properties: {
        maxRetries: { type: 'integer' },
        webhookUrl: { type: 'string', format: 'uri', nullable: true },
        ttl: { type: 'integer', nullable: true },
      },
    },
    history: {
      type: 'array',
      items: jobHistoryEntry,
    },
    attempts: { type: 'integer', minimum: 0 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    runAt: { type: 'string', format: 'date-time' },
    startedAt: { type: 'string', format: 'date-time', nullable: true },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    failedAt: { type: 'string', format: 'date-time', nullable: true },
    canceledAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

/**
 * Schema for the `GET /jobs` response body.
 * Represents a paginated list of job objects.
 * @type {object}
 */
export const jobListResponseSchema = {
  $id: 'jobListResponse',
  type: 'object',
  properties: {
    count: {
      type: 'integer',
      description: 'The number of items in the current result set.',
    },
    limit: {
      type: 'integer',
      description: 'The pagination limit used for the request.',
    },
    offset: {
      type: 'integer',
      description: 'The pagination offset used for the request.',
    },
    data: {
      type: 'array',
      items: { $ref: 'jobResponse' },
    },
  },
};

/**
 * Standard schema for API error responses.
 * Ensures a consistent error format across all endpoints.
 * @type {object}
 */
export const errorResponseSchema = {
  $id: 'errorResponse',
  type: 'object',
  properties: {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
};