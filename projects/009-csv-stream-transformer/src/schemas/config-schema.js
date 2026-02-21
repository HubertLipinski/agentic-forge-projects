/**
 * @file src/schemas/config-schema.js
 * @description Defines the JSON schema for the transformation configuration file.
 * This schema is used by Ajv to validate the structure and types of the user-provided
 * configuration, ensuring it adheres to the expected format for the CSV transformation pipeline.
 *
 * @author Your Name <you@example.com>
 * @license MIT
 */

/**
 * @typedef {object} ConfigSchema
 * @property {string} $schema - The JSON Schema URI.
 * @property {string} $id - A unique identifier for the schema.
 * @property {string} title - The title of the schema.
 * @property {string} description - A description of the schema's purpose.
 * @property {string} type - The root type of the schema (should be 'object').
 * @property {object} properties - The properties of the configuration object.
 * @property {string[]} required - An array of required properties.
 * @property {boolean} additionalProperties - Whether to allow properties not defined in the schema.
 */

/**
 * JSON Schema for validating the transformation configuration file.
 *
 * The configuration object can define:
 * - `csvParseOptions`: Options passed directly to the `csv-parse` library.
 * - `csvStringifyOptions`: Options passed directly to the `csv-stringify` library.
 * - `filter`: An array of rules to filter rows.
 * - `mapping`: An array of rules to map, rename, and transform columns.
 *
 * @type {ConfigSchema}
 */
const configSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://github.com/your-username/csv-stream-transformer/schemas/config.schema.json',
  title: 'CSV Stream Transformer Configuration',
  description: 'Schema for the configuration file used by the CSV Stream Transformer.',
  type: 'object',
  properties: {
    csvParseOptions: {
      description: 'Options to pass to the csv-parse stream. See csv-parse documentation for all available options.',
      type: 'object',
      properties: {
        delimiter: { type: ['string', 'array'] },
        quote: { type: ['string', 'boolean'] },
        columns: { type: ['boolean', 'array', 'function'] },
        from_line: { type: 'integer', minimum: 1 },
        // Add other relevant csv-parse options as needed
      },
      additionalProperties: true, // Allow any other valid csv-parse options
      default: {},
    },
    csvStringifyOptions: {
      description: 'Options to pass to the csv-stringify stream. See csv-stringify documentation for all available options.',
      type: 'object',
      properties: {
        delimiter: { type: 'string' },
        quote: { type: ['string', 'boolean'] },
        header: { type: 'boolean' },
        // Add other relevant csv-stringify options as needed
      },
      additionalProperties: true, // Allow any other valid csv-stringify options
      default: {},
    },
    filter: {
      description: 'An array of rules to filter rows. A row is kept only if it satisfies ALL rules.',
      type: 'array',
      items: {
        type: 'object',
        properties: {
          column: {
            description: 'The name of the column to apply the filter on.',
            type: 'string',
          },
          equals: {
            description: 'The row is kept if the column value is strictly equal to this value.',
            type: ['string', 'number', 'boolean', 'null'],
          },
          not: {
            description: 'The row is kept if the column value is not strictly equal to this value.',
            type: ['string', 'number', 'boolean', 'null'],
          },
          // Note: Custom function filters are not validatable via JSON Schema and are handled at runtime.
        },
        required: ['column'],
        oneOf: [
          { required: ['equals'] },
          { required: ['not'] },
        ],
        additionalProperties: false,
      },
      default: [],
    },
    mapping: {
      description: 'An array of rules to map, rename, and transform columns.',
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: {
            description: 'The original column name in the source CSV.',
            type: 'string',
          },
          to: {
            description: 'The new column name in the output CSV. If omitted, `from` is used.',
            type: 'string',
          },
          transform: {
            description: 'An array of value transformations to apply to the column.',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  description: 'The name of the built-in or custom transformer function.',
                  type: 'string',
                },
                // `params` can be any type, so we don't strictly validate its contents here.
                params: {
                  description: 'An array of parameters to pass to the transformer function.',
                  type: 'array',
                },
              },
              required: ['name'],
              additionalProperties: false,
            },
          },
          // Note: `customTransform` functions are not validatable via JSON Schema and are handled at runtime.
        },
        required: ['from'],
        additionalProperties: false,
      },
      minItems: 1,
    },
  },
  required: ['mapping'],
  additionalProperties: false,
};

export default configSchema;