/**
 * @file src/policy/schemas.js
 * @description Contains AJV JSON schemas for validating the structure of incoming policies
 * during create/update operations, ensuring policy integrity.
 *
 * These schemas are used by the policy API endpoints to validate payloads,
 * preventing malformed or invalid policy documents from being stored and used by the engine.
 * This is a critical step for maintaining the stability and predictability of the
 * authorization service.
 */

/**
 * A reusable schema for a policy ID.
 * It must be a non-empty string, typically used as a path parameter.
 * Example: "user-read-own-data"
 * @type {import('ajv').SchemaObject}
 */
const policyIdSchema = {
  type: 'string',
  minLength: 1,
  pattern: '^[a-zA-Z0-9_-]+$', // Alphanumeric, hyphen, underscore
};

/**
 * The core JSON schema for a single policy document.
 * This schema defines the required structure for a valid policy.
 *
 * A policy consists of:
 * - `id`: A unique identifier for the policy.
 * - `description`: A human-readable explanation of what the policy does.
 * - `condition`: The `json-logic` rule that will be evaluated. This is the heart of the policy.
 * - `metadata`: An optional object for storing arbitrary key-value pairs, useful for grouping or annotating policies.
 *
 * The `condition` is defined as a generic object because `json-logic` rules have a highly
 * dynamic and nested structure that is difficult to type strictly with JSON Schema
 * without being overly restrictive. The primary validation is that it must be an object.
 * The engine itself is responsible for the actual interpretation of the logic.
 *
 * @type {import('ajv').SchemaObject}
 */
const policySchema = {
  $id: 'policy', // A unique identifier for this schema
  type: 'object',
  properties: {
    id: policyIdSchema,
    description: {
      type: 'string',
      minLength: 1,
      description: 'A human-readable explanation of the policy rule.',
    },
    condition: {
      type: 'object',
      minProperties: 1, // A condition object cannot be empty, e.g., {}
      description: 'The JSON Logic rule to be evaluated for this policy.',
    },
    metadata: {
      type: 'object',
      additionalProperties: true, // Allows any key-value pairs
      description: 'Optional key-value pairs for custom annotations or grouping.',
      nullable: true, // Allows metadata to be explicitly set to null
    },
  },
  required: ['id', 'description', 'condition'],
  additionalProperties: false, // Disallow any properties not defined in the schema
};

/**
 * Schema for the body of a `POST /policies` request (creating a new policy).
 * It's identical to the base policy schema.
 * @type {import('ajv').SchemaObject}
 */
const createPolicySchema = {
  ...policySchema,
  $id: 'createPolicy',
};

/**
 * Schema for the body of a `PUT /policies/:id` request (updating an existing policy).
 * The `id` is not allowed in the body because it's specified in the URL path
 * and should not be changed during an update.
 * @type {import('ajv').SchemaObject}
 */
const updatePolicySchema = {
  $id: 'updatePolicy',
  type: 'object',
  properties: {
    // 'id' is intentionally omitted from the update payload.
    description: policySchema.properties.description,
    condition: policySchema.properties.condition,
    metadata: policySchema.properties.metadata,
  },
  // At least one property must be provided for an update.
  minProperties: 1,
  required: [], // No single property is required, but the object can't be empty.
  additionalProperties: false,
};

/**
 * Schema for validating the parameters of API requests, like URL params.
 * @type {import('ajv').SchemaObject}
 */
const paramsSchema = {
  $id: 'params',
  type: 'object',
  properties: {
    id: policyIdSchema,
  },
  required: ['id'],
};

/**
 * A collection of all schemas, keyed by their `$id`.
 * This allows for easy retrieval and registration with AJV in the server setup.
 */
const schemas = {
  [policySchema.$id]: policySchema,
  [createPolicySchema.$id]: createPolicySchema,
  [updatePolicySchema.$id]: updatePolicySchema,
  [paramsSchema.$id]: paramsSchema,
};

export default schemas;
export { policySchema, createPolicySchema, updatePolicySchema, paramsSchema };