/**
 * @file config/schema.js
 * @description Defines the JSON Schema for site configuration files.
 * This schema is used by Ajv to validate the structure and content of each
 * site-specific configuration (e.g., `sites/amazon-product.yaml`).
 * It ensures that all required properties are present and correctly typed,
 * maintaining data integrity and preventing runtime errors from malformed configs.
 */

/**
 * @typedef {object} SiteConfigSchema
 * @property {string} $schema - The JSON Schema URI.
 * @property {string} title - A human-readable title for the schema.
 * @property {string} description - A detailed description of the schema's purpose.
 * @property {string} type - The root type of the object, must be 'object'.
 * @property {object} properties - Defines the properties of the configuration object.
 * @property {string[]} required - An array of required property names.
 * @property {boolean} additionalProperties - Whether to allow properties not defined in the schema.
 */

/**
 * JSON Schema for validating site configuration files.
 *
 * @type {SiteConfigSchema}
 */
const siteConfigSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'E-Commerce Site Scraper Configuration',
  description: 'Defines the structure for a site-specific scraper configuration, including URL patterns and CSS selectors for data extraction.',
  type: 'object',

  properties: {
    name: {
      description: 'A unique, human-readable name for the e-commerce site (e.g., "Amazon", "Best Buy").',
      type: 'string',
      minLength: 1,
    },
    urlPattern: {
      description: 'A regular expression (as a string) to match product page URLs for this site. The regex should be properly escaped for YAML/JSON.',
      type: 'string',
      format: 'regex',
      minLength: 1,
    },
    selectors: {
      description: 'A map of CSS selectors used to extract product data from the page.',
      type: 'object',
      properties: {
        name: {
          description: 'Selector configuration for the product name/title.',
          $ref: '#/definitions/selectorConfig',
        },
        price: {
          description: 'Selector configuration for the product price.',
          $ref: '#/definitions/selectorConfig',
        },
        stock: {
          description: 'Optional selector configuration for the product stock status text.',
          $ref: '#/definitions/selectorConfig',
        },
      },
      required: ['name', 'price'],
      additionalProperties: false,
    },
    stock: {
      description: 'Configuration for interpreting stock availability text.',
      type: 'object',
      properties: {
        inStockStrings: {
          description: 'An array of strings that, if found in the extracted stock text, indicate the product is in stock. The check is case-insensitive.',
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
          minItems: 1,
          uniqueItems: true,
        },
      },
      required: ['inStockStrings'],
      additionalProperties: false,
    },
  },

  required: ['name', 'urlPattern', 'selectors'],
  additionalProperties: false,

  definitions: {
    selectorConfig: {
      description: 'Defines a CSS selector and the method to extract data from the matched element.',
      type: 'object',
      properties: {
        selector: {
          description: 'The CSS selector to target the element.',
          type: 'string',
          minLength: 1,
        },
        method: {
          description: "The method to use for extraction. 'text' gets the element's text content, 'attr' gets a specific attribute value.",
          type: 'string',
          enum: ['text', 'attr'],
          default: 'text',
        },
        attribute: {
          description: "The name of the attribute to extract when method is 'attr' (e.g., 'content', 'data-price').",
          type: 'string',
          minLength: 1,
        },
      },
      required: ['selector'],
      additionalProperties: false,
      // 'attribute' is required only if 'method' is 'attr'.
      // This is a more advanced validation rule.
      if: {
        properties: { method: { const: 'attr' } },
      },
      then: {
        required: ['selector', 'attribute'],
      },
    },
  },
};

export default siteConfigSchema;