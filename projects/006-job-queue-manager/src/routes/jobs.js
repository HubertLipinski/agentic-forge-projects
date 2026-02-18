/**
 * @file src/routes/jobs.js
 * @description Defines the Fastify routes for job management.
 * This module sets up the RESTful API endpoints for creating, querying, and canceling jobs.
 * It handles request validation, calls the appropriate service layer functions, and formats
 * the HTTP responses, including proper error handling and status codes.
 */

import { createJobSchema } from '../schemas/job.js';
import * as JobService from '../services/job-service.js';
import { AppError, NotFoundError, ConflictError } from '../lib/errors.js';

/**
 * Encapsulates all job-related routes and registers them with a Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 * @param {object} options - Plugin options, not used here but required by Fastify's plugin signature.
 * @param {function} done - A function to call when the plugin is fully registered.
 */
export default async function jobRoutes(fastify, options) {
  const { log: logger } = fastify;

  /**
   * POST /jobs
   * Route to create and enqueue a new job.
   * The request body must conform to the `createJobSchema`.
   */
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create and enqueue a new job.',
        tags: ['Jobs'],
        summary: 'Enqueue a new job',
        body: createJobSchema,
        response: {
          201: {
            description: 'Job created successfully.',
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              type: { type: 'string' },
              status: { type: 'string', enum: ['waiting', 'delayed'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            description: 'Invalid request body.',
            $ref: 'errorSchema#',
          },
          500: {
            description: 'Internal server error.',
            $ref: 'errorSchema#',
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const jobData = request.body;
        const newJob = await JobService.createJob(jobData);

        // Return a simplified response for the client.
        const responsePayload = {
          id: newJob.id,
          type: newJob.type,
          status: newJob.status,
          createdAt: new Date(newJob.createdAt).toISOString(),
        };

        // Use 201 Created for successful resource creation.
        // Set the Location header to point to the newly created resource.
        reply
          .code(201)
          .header('Location', `${request.protocol}://${request.hostname}/jobs/${newJob.id}`)
          .send(responsePayload);
      } catch (error) {
        logger.error({ err: error, body: request.body }, 'Failed to create job.');
        if (error instanceof AppError) {
          reply.code(error.statusCode).send({
            statusCode: error.statusCode,
            error: error.name,
            message: error.message,
          });
        } else {
          reply.code(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while creating the job.',
          });
        }
      }
    }
  );

  /**
   * GET /jobs/:jobId
   * Route to retrieve the status and details of a specific job.
   */
  fastify.get(
    '/:jobId',
    {
      schema: {
        description: 'Get the status and details of a specific job by its ID.',
        tags: ['Jobs'],
        summary: 'Get job status',
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string', format: 'uuid' },
          },
          required: ['jobId'],
        },
        response: {
          200: {
            description: 'Successful response with job details.',
            // The job object can have a flexible structure, so we allow additional properties.
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Job not found.',
            $ref: 'errorSchema#',
          },
          500: {
            description: 'Internal server error.',
            $ref: 'errorSchema#',
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { jobId } = request.params;
        const job = await JobService.getJobStatus(jobId);
        reply.code(200).send(job);
      } catch (error) {
        if (error instanceof NotFoundError) {
          logger.warn({ err: error, jobId: request.params.jobId }, 'Job not found.');
          reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: error.message,
          });
        } else {
          logger.error({ err: error, jobId: request.params.jobId }, 'Failed to get job status.');
          reply.code(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while retrieving the job status.',
          });
        }
      }
    }
  );

  /**
   * DELETE /jobs/:jobId
   * Route to cancel a job. A job can only be canceled if it is in a
   * 'waiting' or 'delayed' state.
   */
  fastify.delete(
    '/:jobId',
    {
      schema: {
        description: "Cancel a job. Only jobs in 'waiting' or 'delayed' state can be canceled.",
        tags: ['Jobs'],
        summary: 'Cancel a job',
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string', format: 'uuid' },
          },
          required: ['jobId'],
        },
        response: {
          200: {
            description: 'Job canceled successfully.',
            type: 'object',
            properties: {
              message: { type: 'string' },
              job: { type: 'object' },
            },
          },
          404: {
            description: 'Job not found.',
            $ref: 'errorSchema#',
          },
          409: {
            description: 'Conflict - Job is not in a cancelable state.',
            $ref: 'errorSchema#',
          },
          500: {
            description: 'Internal server error.',
            $ref: 'errorSchema#',
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { jobId } = request.params;
        const canceledJob = await JobService.cancelJob(jobId);
        reply.code(200).send({
          message: `Job '${jobId}' was successfully canceled.`,
          job: canceledJob,
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          logger.warn({ err: error, jobId: request.params.jobId }, 'Attempt to cancel non-existent job.');
          reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: error.message,
          });
        } else if (error instanceof ConflictError) {
          logger.warn({ err: error, jobId: request.params.jobId }, 'Job cancellation conflict.');
          reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: error.message,
          });
        } else {
          logger.error({ err: error, jobId: request.params.jobId }, 'Failed to cancel job.');
          reply.code(500).send({
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while canceling the job.',
          });
        }
      }
    }
  );
}