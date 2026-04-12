/**
 * @file src/schemas/task-graph-schema.js
 * @description Defines the JSON Schema for a valid task graph configuration.
 * This schema is used by Ajv to validate the structure of task definitions
 * provided by the user, ensuring they conform to the expected format before
 * any processing begins. This prevents runtime errors due to malformed input.
 */

/**
 * @typedef {object} TaskGraphSchema
 * @property {string} $schema - The JSON Schema dialect identifier.
 * @property {string} type - The root type, which must be 'object'.
 * @property {object} properties - Defines the properties of the root object.
 * @property {object} properties.tasks - The definition for the 'tasks' object.
 * @property {string[]} required - Specifies the required properties at the root level.
 * @property {object} definitions - Contains reusable sub-schemas.
 */

/**
 * The JSON Schema definition for a task graph.
 *
 * A valid task graph is an object with a single top-level property `tasks`.
 * The `tasks` property is an object where each key is a unique task ID (string)
 * and each value is a task definition object.
 *
 * A task definition object must contain:
 * - `run`: A function to be executed. While JSON Schema can't validate the type
 *   as a function directly, we enforce its presence. The `TaskGraph` class will
 *   perform the runtime type check.
 * - `dependencies`: An optional array of strings, where each string is the ID
 *   of another task in the graph.
 *
 * @type {TaskGraphSchema}
 */
const taskGraphSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Concurrent Task Runner Graph',
  description: 'Schema for defining a graph of tasks and their dependencies.',
  type: 'object',
  properties: {
    tasks: {
      description: 'A map of task definitions, where the key is the unique task ID.',
      type: 'object',
      minProperties: 1,
      propertyNames: {
        description: 'Task IDs must be non-empty strings.',
        type: 'string',
        minLength: 1,
        pattern: '^.+$', // Disallow empty strings
      },
      additionalProperties: {
        $ref: '#/definitions/taskDefinition',
      },
    },
  },
  required: ['tasks'],
  definitions: {
    taskDefinition: {
      description: 'Defines a single task within the graph.',
      type: 'object',
      properties: {
        dependencies: {
          description: 'An array of task IDs that must complete before this task can run.',
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
          uniqueItems: true,
        },
        run: {
          description: 'The function to execute for this task. The schema validates its presence; type checking (is-function) is done at runtime.',
          // We can't truly validate `typeof === 'function'` in standard JSON Schema.
          // The presence of the key is the main structural validation we can perform here.
          // Any value is accepted, and runtime validation will handle the rest.
        },
      },
      required: ['run'],
      // Allow other properties to be present (e.g., for custom metadata),
      // but they won't be used by the core runner.
      additionalProperties: true,
    },
  },
};

export default taskGraphSchema;