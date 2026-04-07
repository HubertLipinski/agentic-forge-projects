/**
 * @file lib/rule-validator.js
 * @description A service that uses AJV to validate the structure of routing rule configurations.
 * This module ensures that any rules provided to the StreamRouter are well-formed
 * before they are used, preventing runtime errors due to misconfiguration.
 */

import Ajv from 'ajv';
import { RuleValidationError } from './utils/errors.js';

/**
 * Defines the JSON Schema for a single routing rule.
 * A rule must have:
 * - `name`: A unique identifier for the rule.
 * - `type`: The engine to use for evaluation ('jsonpath' or 'regex').
 * - `expression`: The criteria for matching (a string).
 * - `destination`: A writable stream where matching data should be sent.
 *
 * @private
 * @constant {object}
 */
const ruleSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1,
      description: 'A unique name for the rule.'
    },
    type: {
      type: 'string',
      enum: ['jsonpath', 'regex'],
      description: "The type of rule engine to use ('jsonpath' or 'regex')."
    },
    expression: {
      type: 'string',
      minLength: 1,
      description: 'The expression to evaluate (e.g., a JSONPath string or a RegExp pattern).'
    },
    destination: {
      type: 'object',
      properties: {
        // Check if it's a stream-like object by looking for the 'write' method.
        // This is a duck-typing approach, as there's no primitive JSON Schema type for streams.
        write: {
          instanceof: 'Function',
          description: 'The destination must be a Writable stream or an object with a `write` method.'
        }
      },
      required: ['write'],
      errorMessage: 'The "destination" property must be a valid Writable stream.'
    }
  },
  required: ['name', 'type', 'expression', 'destination'],
  additionalProperties: false,
  errorMessage: {
    type: 'A rule must be a valid object.',
    required: 'A rule must have the required properties: name, type, expression, and destination.',
    additionalProperties: 'A rule must not have properties other than name, type, expression, and destination.'
  }
};

/**
 * Defines the JSON Schema for the top-level rules array.
 * It must be an array of unique rule objects.
 *
 * @private
 * @constant {object}
 */
const rulesArraySchema = {
  type: 'array',
  items: ruleSchema,
  minItems: 1,
  uniqueItems: true, // Ensures no duplicate rules in the array.
  errorMessage: {
    type: 'The "rules" configuration must be an array.',
    minItems: 'The "rules" array must contain at least one rule.',
    uniqueItems: 'Rules within the "rules" array must be unique.'
  }
};

/**
 * A singleton instance of Ajv, configured for rule validation.
 * - `allErrors: true` collects all validation errors, not just the first one.
 * - `strict: false` is set to allow `instanceof` keyword, which is not part of the standard JSON Schema spec but is useful here.
 * - `ajv-errors` is used for custom error messages.
 *
 * @private
 * @type {Ajv}
 */
const ajv = new Ajv({
  allErrors: true,
  strict: false // Allow `instanceof` keyword
});

// Add `instanceof` keyword support for checking stream-like objects
ajv.addKeyword('instanceof', {
  compile: (schema) => (data) => {
    if (schema === 'Function') {
      return typeof data === 'function';
    }
    return false;
  }
});

/**
 * A service class responsible for validating routing rule configurations.
 * It uses a pre-compiled AJV validator for efficiency.
 *
 * @class RuleValidator
 */
export class RuleValidator {
  /**
   * @private
   * @type {import('ajv').ValidateFunction}
   */
  #validateFn;

  /**
   * Creates an instance of RuleValidator.
   * The constructor pre-compiles the validation schema for performance.
   */
  constructor() {
    this.#validateFn = ajv.compile(rulesArraySchema);
  }

  /**
   * Validates an array of rule configurations against the predefined JSON schema.
   *
   * @param {Array<object>} rules - The array of rule objects to validate.
   * @throws {RuleValidationError} If the validation fails. The error contains detailed
   *   information about what went wrong.
   * @returns {void} Does not return a value if validation is successful.
   */
  validate(rules) {
    const isValid = this.#validateFn(rules);

    if (!isValid) {
      const errorMessages = this.#formatErrors(this.#validateFn.errors);
      const errorMessage = `Rule configuration validation failed: ${errorMessages.join('; ')}`;

      throw new RuleValidationError(errorMessage, this.#validateFn.errors);
    }
  }

  /**
   * Formats AJV error objects into human-readable strings.
   *
   * @private
   * @param {Array<import('ajv').ErrorObject>} errors - An array of error objects from AJV.
   * @returns {Array<string>} An array of formatted, human-readable error messages.
   */
  #formatErrors(errors = []) {
    return errors.map(error => {
      const path = error.instancePath ? `Rule at index ${error.instancePath.split('/')[1] || 'unknown'}` : 'Configuration';
      let message = error.message || 'has an unknown validation error';

      // Provide more specific messages for common cases.
      if (error.keyword === 'required') {
        message = `is missing required property '${error.params.missingProperty}'`;
      } else if (error.keyword === 'additionalProperties') {
        message = `has an unexpected property '${error.params.additionalProperty}'`;
      } else if (error.keyword === 'enum') {
        message = `property '${error.instancePath.split('/').pop()}' must be one of [${error.params.allowedValues.join(', ')}]`;
      } else if (error.instancePath.endsWith('/destination/write')) {
        message = 'property "destination" must be a valid Writable stream';
      }

      return `${path} ${message}.`;
    });
  }
}