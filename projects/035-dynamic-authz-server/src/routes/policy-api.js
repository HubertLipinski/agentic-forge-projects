/**
 * @file src/routes/policy-api.js
 * @description Defines the CRUD API endpoints (/policies) for managing policy documents.
 * Handles validation, storage interaction, and triggers policy reloads.
 *
 * This module encapsulates all logic related to the policy management API. It uses
 * schemas for validation and interacts with the policyStore to persist changes
 * and trigger hot-reloads of the authorization cache.
 */

import { policyStore } from '../policy/store.js';
import { createPolicySchema, updatePolicySchema, paramsSchema } from '../policy/schemas.js';

/**
 * Encapsulates the policy management API routes.
 * This function is designed to be registered as a Fastify plugin.
 *
 * @param {import('fastify').FastifyInstance} fastify - The Fastify server instance.
 * @param {object} opts - Plugin options (not used in this plugin).
 */
async function policyApiRoutes(fastify, opts) {
  const commonRouteOptions = {
    prefix: '/policies',
  };

  /**
   * Handler for GET /policies
   * Retrieves a list of all policy documents from storage.
   *
   * @param {import('fastify').FastifyRequest} request - The incoming request object.
   * @param {import('fastify').FastifyReply} reply - The response object.
   */
  async function getAllPoliciesHandler(request, reply) {
    try {
      const policies = await policyStore.getAllPoliciesFromStorage();
      return reply.send(policies);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to retrieve all policies from storage.');
      // This indicates a problem with the storage backend.
      throw new Error('Could not retrieve policies.');
    }
  }

  fastify.get('/', {
    ...commonRouteOptions,
    schema: {
      summary: 'List All Policies',
      description: 'Retrieves a complete list of all policy documents currently in storage.',
      tags: ['Policy Management'],
      response: {
        200: {
          description: 'A list of all policies.',
          type: 'array',
          items: { $ref: 'policy#' },
        },
      },
    },
  }, getAllPoliciesHandler);

  /**
   * Handler for POST /policies
   * Creates a new policy document.
   *
   * @param {import('fastify').FastifyRequest} request - The incoming request object.
   * @param {import('fastify').FastifyReply} reply - The response object.
   */
  async function createPolicyHandler(request, reply) {
    const policyData = request.body;

    // Check if a policy with this ID already exists to provide a clear error.
    const existingPolicy = await policyStore.getPolicyById(policyData.id);
    if (existingPolicy) {
      return reply.code(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: `A policy with ID '${policyData.id}' already exists.`,
      });
    }

    try {
      const newPolicy = await policyStore.createPolicy(policyData);
      // The background reload is triggered by the store.
      return reply.code(201).send(newPolicy);
    } catch (error) {
      request.log.error({ err: error, policyData }, 'Failed to create new policy.');
      throw new Error('Policy creation failed.');
    }
  }

  fastify.post('/', {
    ...commonRouteOptions,
    schema: {
      summary: 'Create a New Policy',
      description: 'Adds a new policy document to the store. The policy ID must be unique.',
      tags: ['Policy Management'],
      body: { $ref: 'createPolicy#' },
      response: {
        201: {
          description: 'Policy created successfully.',
          $ref: 'policy#',
        },
        409: {
          description: 'A policy with the given ID already exists.',
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, createPolicyHandler);

  /**
   * Handler for GET /policies/:id
   * Retrieves a single policy document by its ID.
   *
   * @param {import('fastify').FastifyRequest} request - The incoming request object.
   * @param {import('fastify').FastifyReply} reply - The response object.
   */
  async function getPolicyByIdHandler(request, reply) {
    const { id } = request.params;
    const policy = await policyStore.getPolicyById(id);

    if (!policy) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Policy with ID '${id}' not found.`,
      });
    }

    return reply.send(policy);
  }

  fastify.get('/:id', {
    ...commonRouteOptions,
    schema: {
      summary: 'Get a Single Policy',
      description: 'Retrieves a specific policy document by its unique ID.',
      tags: ['Policy Management'],
      params: { $ref: 'params#' },
      response: {
        200: {
          description: 'The requested policy document.',
          $ref: 'policy#',
        },
        404: {
          description: 'Policy not found.',
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, getPolicyByIdHandler);

  /**
   * Handler for PUT /policies/:id
   * Updates an existing policy document.
   *
   * @param {import('fastify').FastifyRequest} request - The incoming request object.
   * @param {import('fastify').FastifyReply} reply - The response object.
   */
  async function updatePolicyHandler(request, reply) {
    const { id } = request.params;
    const updatePayload = request.body;

    try {
      const updatedPolicy = await policyStore.updatePolicy(id, updatePayload);

      if (!updatedPolicy) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Policy with ID '${id}' not found.`,
        });
      }

      return reply.send(updatedPolicy);
    } catch (error) {
      request.log.error({ err: error, policyId: id, updatePayload }, 'Failed to update policy.');
      throw new Error('Policy update failed.');
    }
  }

  fastify.put('/:id', {
    ...commonRouteOptions,
    schema: {
      summary: 'Update an Existing Policy',
      description: 'Updates one or more fields of an existing policy document. The ID cannot be changed.',
      tags: ['Policy Management'],
      params: { $ref: 'params#' },
      body: { $ref: 'updatePolicy#' },
      response: {
        200: {
          description: 'The fully updated policy document.',
          $ref: 'policy#',
        },
        404: {
          description: 'Policy not found.',
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, updatePolicyHandler);

  /**
   * Handler for DELETE /policies/:id
   * Deletes a policy document.
   *
   * @param {import('fastify').FastifyRequest} request - The incoming request object.
   * @param {import('fastify').FastifyReply} reply - The response object.
   */
  async function deletePolicyHandler(request, reply) {
    const { id } = request.params;

    try {
      const wasDeleted = await policyStore.deletePolicy(id);

      if (!wasDeleted) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Policy with ID '${id}' not found.`,
        });
      }

      // A 204 No Content response is appropriate for a successful deletion.
      return reply.code(204).send();
    } catch (error) {
      request.log.error({ err: error, policyId: id }, 'Failed to delete policy.');
      throw new Error('Policy deletion failed.');
    }
  }

  fastify.delete('/:id', {
    ...commonRouteOptions,
    schema: {
      summary: 'Delete a Policy',
      description: 'Permanently removes a policy document from the store.',
      tags: ['Policy Management'],
      params: { $ref: 'params#' },
      response: {
        204: {
          description: 'Policy deleted successfully.',
          type: 'null',
        },
        404: {
          description: 'Policy not found.',
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, deletePolicyHandler);
}

export default policyApiRoutes;