/**
 * src/api/routes/jobs.js
 *
 * Defines the Fastify routes for job management. This includes creating,
 * listing, retrieving, and canceling jobs. It acts as the primary interface
 * between the HTTP layer and the core job queue service.
 */

import {
  enqueueJobSchema,
  jobIdParamSchema,
  jobListQuerySchema,
  jobResponseSchema,
  jobListResponseSchema,
  errorResponseSchema
} from '../schemas.js';

/**
 * Registers the job-related routes with the Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 * @param {object} options - Plugin options.
 * @param {import('../../services/queue.js').JobQueue} options.queue - The job queue service instance.
 */
async function jobRoutes(fastify, { queue }) {
  if (!queue) {
    throw new Error('JobQueue service instance must be provided to job routes.');
  }

  // Enqueue a new job
  fastify.post('/jobs', {
    schema: {
      description: 'Enqueue a new job for background processing.',
      tags: ['Jobs'],
      summary: 'Create a new job',
      body: enqueueJobSchema,
      response: {
        202: {
          description: 'Job successfully enqueued.',
          ...jobResponseSchema
        },
        400: {
          description: 'Invalid request body.',
          ...errorResponseSchema
        },
        500: {
          description: 'Internal server error.',
          ...errorResponseSchema
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { type, payload, options = {} } = request.body;
      const job = await queue.enqueue(type, payload, options);
      // Use 202 Accepted as the job is not processed yet, just accepted for processing.
      return reply.code(202).send(job);
    } catch (error) {
      request.log.error({ err: error, body: request.body }, 'Failed to enqueue job');
      // Let the global error handler manage the response format
      throw error;
    }
  });

  // Get a specific job by its ID
  fastify.get('/jobs/:id', {
    schema: {
      description: 'Retrieve the details and status of a specific job.',
      tags: ['Jobs'],
      summary: 'Get job by ID',
      params: jobIdParamSchema,
      response: {
        200: jobResponseSchema,
        404: {
          description: 'Job not found.',
          ...errorResponseSchema
        },
        500: {
          description: 'Internal server error.',
          ...errorResponseSchema
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    const job = await queue.getJob(id);

    if (!job) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Job with ID '${id}' not found.`
      });
    }

    return job;
  });

  // List all jobs with optional filtering
  fastify.get('/jobs', {
    schema: {
      description: 'List all jobs, with optional filtering by status or type.',
      tags: ['Jobs'],
      summary: 'List jobs',
      querystring: jobListQuerySchema,
      response: {
        200: jobListResponseSchema,
        500: {
          description: 'Internal server error.',
          ...errorResponseSchema
        }
      }
    }
  }, async (request, reply) => {
    const { status, type, limit = 100, offset = 0 } = request.query;
    const jobs = await queue.listJobs({ status, type, limit, offset });
    return {
      count: jobs.length,
      limit,
      offset,
      data: jobs
    };
  });

  // Cancel a pending or running job
  fastify.post('/jobs/:id/cancel', {
    schema: {
      description: 'Attempt to cancel a pending or running job. Cancellation is not guaranteed.',
      tags: ['Jobs'],
      summary: 'Cancel a job',
      params: jobIdParamSchema,
      response: {
        200: {
          description: 'Job cancellation initiated successfully.',
          ...jobResponseSchema
        },
        404: {
          description: 'Job not found.',
          ...errorResponseSchema
        },
        409: {
          description: 'Job cannot be canceled (e.g., already completed or failed).',
          ...errorResponseSchema
        },
        500: {
          description: 'Internal server error.',
          ...errorResponseSchema
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params;
    try {
      const canceledJob = await queue.cancel(id);
      return reply.code(200).send(canceledJob);
    } catch (error) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Job with ID '${id}' not found.`
        });
      }
      if (error.message.includes('cannot be canceled')) {
        return reply.code(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: error.message
        });
      }
      request.log.error({ err: error, jobId: id }, 'Failed to cancel job');
      throw error;
    }
  });
}

export default jobRoutes;